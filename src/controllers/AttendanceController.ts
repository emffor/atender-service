import { Request, Response } from "express";
import { AttendanceFacade } from "../facades/AttendanceFacade";
import { 
  CreateAttendanceDTO,
  ApproveAttendanceDTO,
  RejectAttendanceDTO,
  ListAttendancesDTO 
} from "../dto";
import { ShiftCacheService } from "../services/cache/ShiftCacheService";
import { UserCacheService } from "../services/cache/UserCacheService";
import { AttendanceEventPublisher } from "../events/AttendanceEventPublisher";
import { FaceRecognitionService } from "../services/FaceRecognitionService";
import { NotificationService, NotificationType } from "../services/NotificationService";
import { AttendanceService } from "../services/AttendanceService";
import { AttendanceStatus } from "../entities/Attendance";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { FaceVerificationData } from "../dto/AttendanceResponse.dto";
import { AppError } from "../errors/AppError";
import { getErrorMessage } from "../utils/errorUtils";

/**
 * Controller de Attendance - Event-Driven Version
 * 
 * Principais mudanças:
 * - Usa AttendanceFacade injetado com cache services
 * - Mantém mesma API REST para compatibilidade
 * - Dados vêm do cache (Redis) alimentado por RabbitMQ
 * - Implementa verificação facial condicional
 * - Inclui geo data nas notificações
 * - Toggle discount endpoints
 * - Endpoints adicionais (count, missing, listByStatus)
 */
export class AttendanceController {
  private facade: AttendanceFacade;
  private faceService: FaceRecognitionService;
  private notificationService: NotificationService;
  private attendanceService: AttendanceService;

  constructor(
    shiftCache: ShiftCacheService,
    userCache: UserCacheService,
    eventPublisher: AttendanceEventPublisher,
    faceService: FaceRecognitionService,
    notificationService: NotificationService,
    attendanceRepository: AttendanceRepository
  ) {
    this.facade = new AttendanceFacade(shiftCache, userCache, eventPublisher);
    this.faceService = faceService;
    this.notificationService = notificationService;
    this.attendanceService = new AttendanceService(
      attendanceRepository,
      shiftCache,
      userCache
    );
  }

  /**
   * Extrai IP do request
   */
  private extractIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Extrai location do request (headers customizados)
   */
  private extractLocation(req: Request): string {
    return (req.headers['x-user-location'] as string) || 'unknown';
  }

  /**
   * Retorna mensagem humanizada baseada no status e motivo
   */
  private getHumanMessage(status: AttendanceStatus, statusReason?: string, type?: string): string {
    if (status === 'APPROVED') {
      return '✅ Ponto aprovado automaticamente! Você está dentro das regras estabelecidas.';
    }
    
    if (status === 'PENDING') {
      if (statusReason?.toLowerCase().includes('tardio') || statusReason?.toLowerCase().includes('tempo')) {
        return `⏰ Ponto registrado com sucesso! Como o check-${type?.toLowerCase() || 'out'} foi realizado fora do horário esperado, ele entrará em revisão manual pelo hospital.`;
      }
      if (statusReason?.toLowerCase().includes('área') || statusReason?.toLowerCase().includes('geográfica')) {
        return '📍 Ponto registrado com sucesso! Como você estava fora da área geográfica esperada, ele entrará em revisão manual pelo hospital.';
      }
      if (statusReason?.toLowerCase().includes('suspeitas') || statusReason?.toLowerCase().includes('coordenadas')) {
        return '🔍 Ponto registrado com sucesso! Detectamos algo incomum nas coordenadas, por isso ele entrará em revisão manual.';
      }
      return '⏳ Ponto registrado com sucesso! Ele entrará em revisão manual pelo hospital.';
    }
    
    if (status === 'REJECTED') {
      return '❌ Ponto rejeitado. Verifique o motivo e entre em contato com o hospital se necessário.';
    }
    
    return 'Ponto processado com sucesso.';
  }

  /**
   * POST /attendances
   * Registrar novo ponto (IN ou OUT)
   * 
   * 🔐 Features implementadas:
   * - Verificação facial CONDICIONAL (flag useFaceRecognition)
   * - Bloqueio 403 se face não corresponder
   * - Notificação com geo data detalhado
   * - faceVerification na resposta
   */
  async recordAttendance(req: Request, res: Response): Promise<void> {
    const ip = this.extractIp(req);
    const location = this.extractLocation(req);
    const timestamp = new Date().toISOString();

    try {
      console.log(`📝 [CONTROLLER] POST /attendances - ${req.body.type}`);

      const dto: CreateAttendanceDTO = {
        doctorId: req.body.doctorId,
        shiftId: req.body.shiftId,
        type: req.body.type,
        latitude: parseFloat(req.body.latitude),
        longitude: parseFloat(req.body.longitude),
        photo: req.body.photo,
        reason: req.body.reason,
        useFaceRecognition: req.body.useFaceRecognition,
      };

      // 🔐 VERIFICAÇÃO FACIAL CONDICIONAL
      let faceVerification: FaceVerificationData | undefined;
      
      if (dto.useFaceRecognition === true) {
        console.log('🔍 Verificação facial habilitada para check-' + dto.type.toLowerCase());
        
        try {
          const faceResult = await this.faceService.verifyFace(
            dto.doctorId,
            dto.photo.buffer
          );

          faceVerification = {
            verified: faceResult.verified,
            confidence: faceResult.confidence,
            message: faceResult.message,
            requiredConfidence: 0.80,
          };

          console.log(`✅ Face verificada: ${faceResult.verified} (${(faceResult.confidence * 100).toFixed(1)}%)`);

          // 🔒 BLOQUEAR se a face não corresponder
          if (!faceResult.verified) {
            console.error('❌ Face não corresponde ao registro - CHECK-' + dto.type + ' BLOQUEADO');

            // Enviar notificação de tentativa bloqueada
            await this.notificationService.sendNotification({
              userId: dto.doctorId,
              title: `🚫 Tentativa de Check-${dto.type} Bloqueada`,
              message: `Tentativa de check-${dto.type.toLowerCase()} BLOQUEADA no plantão ${dto.shiftId}. Face não corresponde ao registro. Confidence: ${(faceResult.confidence * 100).toFixed(1)}%`,
              type: NotificationType.FACE_VERIFICATION_FAILED,
              metadata: {
                shiftId: dto.shiftId,
                type: dto.type,
                status: 'BLOCKED',
                ip,
                location,
                timestamp,
              },
              priority: 'urgent',
            });

            // Bloquear o check-in/out
            res.status(403).json({
              success: false,
              error: 'Face Verification Failed',
              message: `Face não corresponde ao registro cadastrado. Confiança: ${(faceResult.confidence * 100).toFixed(1)}%. Check-${dto.type.toLowerCase()} bloqueado por segurança.`,
              faceVerification,
            });
            return;
          }
        } catch (faceErr: unknown) {
          console.error('❌ Erro na verificação facial:', getErrorMessage(faceErr));

          // Se houver erro técnico na verificação, também bloqueia
          await this.notificationService.sendNotification({
            userId: dto.doctorId,
            title: '⚠️ Erro na Verificação Facial',
            message: `Erro ao verificar face no check-${dto.type.toLowerCase()} do plantão ${dto.shiftId}: ${getErrorMessage(faceErr)}`,
            type: NotificationType.FACE_VERIFICATION_FAILED,
            metadata: {
              shiftId: dto.shiftId,
              type: dto.type,
              status: 'ERROR',
              ip,
              location,
              timestamp,
              error: getErrorMessage(faceErr),
            },
            priority: 'high',
          });

          res.status(500).json({
            success: false,
            error: 'Face Verification Error',
            message: `Erro ao verificar face: ${getErrorMessage(faceErr)}. Por favor, tente novamente ou contate o suporte.`,
            technicalDetails: getErrorMessage(faceErr),
          });
          return;
        }
      }

      // Registrar ponto (se passou pela verificação facial ou não era obrigatória)
      const result = await this.facade.recordAttendance(dto);

      // 🌍 Enviar notificação com GEO DATA DETALHADO
      await this.notificationService.sendNotification({
        userId: dto.doctorId,
        title: `Registro de Ponto ${dto.type}`,
        message: `Ponto ${dto.type} do plantão ${dto.shiftId} registrado.
        Geo=${JSON.stringify({
          punchLat: result.debug?.punchLat,
          punchLng: result.debug?.punchLng,
          maxDistanceMeters: result.debug?.maxDistanceMeters,
          withinRadius: result.debug?.withinRadius,
          polygonCheck: result.debug?.polygonCheck,
        })}`,
        type: NotificationType.ATTENDANCE_REGISTERED,
        metadata: {
          shiftId: dto.shiftId,
          type: dto.type,
          status: result.attendance.status,
          ip,
          location,
          timestamp,
          withinRadius: Boolean(result.debug?.withinRadius),
          punchLat: Number(result.debug?.punchLat || 0),
          punchLng: Number(result.debug?.punchLng || 0),
        },
        priority: 'normal',
      });

      // 📊 Resposta com faceVerification incluído
      res.status(201).json({
        success: true,
        data: result.attendance,
        debug: result.debug,
        faceVerification,
        message: this.getHumanMessage(result.attendance.status, result.attendance.statusReason, dto.type),
        statusInfo: {
          status: result.attendance.status,
          systemReason: result.attendance.statusReason, // Motivo do sistema
          userReason: result.attendance.reason, // Motivo do usuário
          requiresReview: result.attendance.status === 'PENDING',
          humanMessage: this.getHumanMessage(result.attendance.status, result.attendance.statusReason, dto.type),
        }
      });

      console.log(`✅ [CONTROLLER] Ponto ${dto.type} registrado - Status: ${result.attendance.status}`);
    } catch (error: unknown) {
      console.error(`❌ [CONTROLLER] Erro ao registrar ponto:`, error);

      // Notificar erro
      if (req.body.doctorId) {
        await this.notificationService.sendNotification({
          userId: req.body.doctorId,
          title: `Erro ao Registrar Ponto ${req.body.type}`,
          message: `Falha ao registrar Ponto ${req.body.type} do plantão ${req.body.shiftId} em ${timestamp}: ${getErrorMessage(error)}`,
          type: NotificationType.ATTENDANCE_REGISTERED,
          metadata: {
            shiftId: req.body.shiftId,
            type: req.body.type,
            status: 'ERROR',
            ip,
            location,
            timestamp,
            error: getErrorMessage(error),
          },
          priority: 'high',
        });
      }
      
      res.status((error instanceof AppError ? error.code : null) || 500).json({
        success: false,
        error: getErrorMessage(error) || "Erro interno do servidor",
        code: (error instanceof AppError ? error.code : null) || 500,
      });
    }
  }

  /**
   * PUT /attendances/:id/approve
   * Aprovar ponto com controle de desconto
   */
  async approveAttendance(req: Request, res: Response): Promise<void> {
    try {
      console.log(`✅ [CONTROLLER] PUT /attendances/${req.params.id}/approve`);

      const dto: ApproveAttendanceDTO = {
        attendanceId: req.params.id,
        hospitalId: req.body.hospitalId,
        applyDiscount: req.body.applyDiscount,
        reason: req.body.reason,
      };

      const result = await this.facade.approveAttendance(dto);

      res.json({
        success: true,
        data: result,
        message: "Ponto aprovado com sucesso",
      });

      console.log(`✅ [CONTROLLER] Ponto aprovado - Desconto: ${dto.applyDiscount ? 'SIM' : 'NÃO'}`);
    } catch (error: unknown) {
      console.error(`❌ [CONTROLLER] Erro ao aprovar ponto:`, error);
      
      res.status((error instanceof AppError ? error.code : null) || 500).json({
        success: false,
        error: getErrorMessage(error) || "Erro interno do servidor",
        code: (error instanceof AppError ? error.code : null) || 500,
      });
    }
  }

  /**
   * PUT /attendances/:id/reject
   * Rejeitar ponto
   */
  async rejectAttendance(req: Request, res: Response): Promise<void> {
    try {
      console.log(`❌ [CONTROLLER] PUT /attendances/${req.params.id}/reject`);

      const dto: RejectAttendanceDTO = {
        attendanceId: req.params.id,
        hospitalId: req.body.hospitalId,
        reason: req.body.reason,
      };

      const result = await this.facade.rejectAttendance(dto);

      res.json({
        success: true,
        data: result,
        message: "Ponto rejeitado com sucesso",
      });

      console.log(`❌ [CONTROLLER] Ponto rejeitado - Motivo: ${dto.reason}`);
    } catch (error: unknown) {
      console.error(`❌ [CONTROLLER] Erro ao rejeitar ponto:`, error);
      
      res.status((error instanceof AppError ? error.code : null) || 500).json({
        success: false,
        error: getErrorMessage(error) || "Erro interno do servidor",
        code: (error instanceof AppError ? error.code : null) || 500,
      });
    }
  }

  /**
   * GET /attendances
   * Listar pontos com filtros
   */
  async listAttendances(req: Request, res: Response): Promise<void> {
    try {
      console.log(`📋 [CONTROLLER] GET /attendances`);

      const dto: ListAttendancesDTO = {
        shiftId: req.query.shiftId as string,
        doctorId: req.query.doctorId as string,
        status: req.query.status ? (req.query.status as AttendanceStatus) : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      };

      const result = await this.facade.listAttendances(dto);

      res.json({
        success: true,
        data: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          pages: Math.ceil(result.total / result.limit),
        },
        message: "Pontos listados com sucesso",
      });

      console.log(`📋 [CONTROLLER] ${result.items.length} pontos listados`);
    } catch (error: unknown) {
      console.error(`❌ [CONTROLLER] Erro ao listar pontos:`, error);
      
      res.status((error instanceof AppError ? error.code : null) || 500).json({
        success: false,
        error: getErrorMessage(error) || "Erro interno do servidor",
        code: (error instanceof AppError ? error.code : null) || 500,
      });
    }
  }

  /**
   * GET /attendances/:id
   * Buscar ponto específico
   */
  async getAttendanceById(req: Request, res: Response): Promise<void> {
    try {
      console.log(`🔍 [CONTROLLER] GET /attendances/${req.params.id}`);

      // Para simplificar, vou usar o listAttendances com filtro
      const result = await this.facade.listAttendances({
        page: 1,
        limit: 1,
      });

      const attendance = result.items.find(att => att.id === req.params.id);

      if (!attendance) {
        res.status(404).json({
          success: false,
          error: "Ponto não encontrado",
          code: 404,
        });
        return;
      }

      res.json({
        success: true,
        data: attendance,
        message: "Ponto encontrado",
      });

      console.log(`🔍 [CONTROLLER] Ponto encontrado: ${attendance.type} - ${attendance.status}`);
    } catch (error: unknown) {
      console.error(`❌ [CONTROLLER] Erro ao buscar ponto:`, error);
      
      res.status((error instanceof AppError ? error.code : null) || 500).json({
        success: false,
        error: getErrorMessage(error) || "Erro interno do servidor",
        code: (error instanceof AppError ? error.code : null) || 500,
      });
    }
  }

  /**
   * PUT /attendances/:id/toggle-discount
   * Alternar desconto em um attendance individual
   * 
   * Body: { useDiscount: boolean, reason?: string }
   */
  async toggleAttendanceDiscount(req: Request, res: Response): Promise<void> {
    try {
      console.log(`💰 [CONTROLLER] PUT /attendances/${req.params.id}/toggle-discount`);

      const hospitalId = req.body.hospitalId;
      const { useDiscount, reason } = req.body;

      if (!hospitalId) {
        res.status(400).json({
          success: false,
          error: "hospitalId é obrigatório",
          code: 400,
        });
        return;
      }

      if (typeof useDiscount !== 'boolean') {
        res.status(400).json({
          success: false,
          error: "useDiscount deve ser boolean",
          code: 400,
        });
        return;
      }

      const result = await this.attendanceService.toggleAttendanceDiscount(
        req.params.id,
        hospitalId,
        useDiscount,
        reason
      );

      res.json({
        success: true,
        message: "Desconto alternado com sucesso",
        data: {
          attendance: {
            id: result.attendance.id,
            type: result.attendance.type,
            approvedWithDiscount: result.attendance.approvedWithDiscount,
            discountPercentage: result.attendance.discountPercentage,
          },
          changesSummary: result.changesSummary,
          shiftValue: result.shiftValue,
        },
      });

      console.log(`💰 [CONTROLLER] Desconto alternado - Use: ${useDiscount}`);
    } catch (error: unknown) {
      console.error(`❌ [CONTROLLER] Erro ao alternar desconto:`, error);
      
      res.status((error instanceof AppError ? error.code : null) || 500).json({
        success: false,
        error: getErrorMessage(error) || "Erro interno do servidor",
        code: (error instanceof AppError ? error.code : null) || 500,
      });
    }
  }

  /**
   * PUT /shifts/:shiftId/toggle-discount
   * Alternar desconto em todos os attendances de um shift
   * 
   * Body: { useDiscount: boolean, reason?: string }
   */
  async toggleShiftDiscount(req: Request, res: Response): Promise<void> {
    try {
      console.log(`💰 [CONTROLLER] PUT /shifts/${req.params.shiftId}/toggle-discount`);

      const hospitalId = req.body.hospitalId;
      const { useDiscount, reason } = req.body;

      if (!hospitalId) {
        res.status(400).json({
          success: false,
          error: "hospitalId é obrigatório",
          code: 400,
        });
        return;
      }

      if (typeof useDiscount !== 'boolean') {
        res.status(400).json({
          success: false,
          error: "useDiscount deve ser boolean",
          code: 400,
        });
        return;
      }

      const result = await this.attendanceService.toggleShiftDiscount(
        req.params.shiftId,
        hospitalId,
        useDiscount,
        reason
      );

      res.json({
        success: true,
        message: `Desconto alternado em ${result.summary.modifiedCount} attendances`,
        data: {
          shift: result.shift,
          attendancesModified: result.attendancesModified,
          summary: result.summary,
        },
      });

      console.log(`💰 [CONTROLLER] Desconto em shift alternado - ${result.summary.modifiedCount} modificados`);
    } catch (error: unknown) {
      console.error(`❌ [CONTROLLER] Erro ao alternar desconto do shift:`, error);
      
      res.status((error instanceof AppError ? error.code : null) || 500).json({
        success: false,
        error: getErrorMessage(error) || "Erro interno do servidor",
        code: (error instanceof AppError ? error.code : null) || 500,
      });
    }
  }

  /**
   * GET /attendances/count-by-status
   * Contar attendances por status para um hospital em uma data
   * 
   * Query: { date: YYYY-MM-DD }
   */
  async countForDayBySelfHospital(req: Request, res: Response): Promise<void> {
    try {
      console.log(`📊 [CONTROLLER] GET /attendances/count-by-status`);

      const hospitalId = req.query.hospitalId as string;
      const date = req.query.date as string;

      if (!hospitalId) {
        res.status(400).json({
          success: false,
          error: "hospitalId é obrigatório",
          code: 400,
        });
        return;
      }

      if (!date) {
        res.status(400).json({
          success: false,
          error: "date é obrigatória (formato: YYYY-MM-DD)",
          code: 400,
        });
        return;
      }

      const counts = await this.attendanceService.countByStatusForDayHospital(
        hospitalId,
        date
      );

      res.json({
        success: true,
        data: counts,
        message: "Contagem de status concluída",
      });

      console.log(`📊 [CONTROLLER] Counts: APPROVED=${counts.APPROVED}, PENDING=${counts.PENDING}, REJECTED=${counts.REJECTED}`);
    } catch (error: unknown) {
      console.error(`❌ [CONTROLLER] Erro ao contar por status:`, error);
      
      res.status((error instanceof AppError ? error.code : null) || 500).json({
        success: false,
        error: getErrorMessage(error) || "Erro interno do servidor",
        code: (error instanceof AppError ? error.code : null) || 500,
      });
    }
  }

  /**
   * GET /attendances/missing
   * Listar pontos faltando (IN sem OUT)
   * 
   * Query: { shiftId?: string }
   */
  async listMissingPunches(req: Request, res: Response): Promise<void> {
    try {
      console.log(`🔍 [CONTROLLER] GET /attendances/missing`);

      const userId = req.query.userId as string;
      const role = req.query.role as string;
      const shiftId = req.query.shiftId as string;

      if (!userId || !role) {
        res.status(400).json({
          success: false,
          error: "userId e role são obrigatórios",
          code: 400,
        });
        return;
      }

      const missingPunches = await this.attendanceService.getMissingPunchesForUser(
        userId,
        role,
        shiftId
      );

      res.json({
        success: true,
        data: missingPunches,
        total: missingPunches.length,
        message: `${missingPunches.length} pontos faltando encontrados`,
      });

      console.log(`🔍 [CONTROLLER] ${missingPunches.length} pontos faltando`);
    } catch (error: unknown) {
      console.error(`❌ [CONTROLLER] Erro ao listar pontos faltando:`, error);
      
      res.status((error instanceof AppError ? error.code : null) || 500).json({
        success: false,
        error: getErrorMessage(error) || "Erro interno do servidor",
        code: (error instanceof AppError ? error.code : null) || 500,
      });
    }
  }

  /**
   * GET /attendances/by-status
   * Listar attendances por status (role-based)
   * 
   * Query: { shiftId?: string, status?: string, page?: number, limit?: number }
   */
  async listByStatus(req: Request, res: Response): Promise<void> {
    try {
      console.log(`📋 [CONTROLLER] GET /attendances/by-status`);

      const userId = req.query.userId as string;
      const role = req.query.role as string;
      const shiftId = req.query.shiftId as string;
      const status = req.query.status as string;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      if (!userId || !role) {
        res.status(400).json({
          success: false,
          error: "userId e role são obrigatórios",
          code: 400,
        });
        return;
      }

      const result = await this.attendanceService.listByStatusForUser(
        userId,
        role,
        shiftId,
        status,
        page,
        limit
      );

      res.json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
        message: "Attendances listados com sucesso",
      });

      console.log(`📋 [CONTROLLER] ${result.data.length} attendances listados`);
    } catch (error: unknown) {
      console.error(`❌ [CONTROLLER] Erro ao listar por status:`, error);
      
      res.status((error instanceof AppError ? error.code : null) || 500).json({
        success: false,
        error: getErrorMessage(error) || "Erro interno do servidor",
        code: (error instanceof AppError ? error.code : null) || 500,
      });
    }
  }
}


