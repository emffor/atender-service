import { AppDataSource } from "../config/database";
import { Attendance, AttendanceStatus, AttendanceType } from "../entities/Attendance";
import { AppError } from "../errors/AppError";

// DTOs
import {
  CreateAttendanceDTO,
  ApproveAttendanceDTO,
  RejectAttendanceDTO,
  ListAttendancesDTO,
} from "../dto";
import { AttendanceResponseDTO } from "../dto/AttendanceResponseDTO";

// Repositories
import { AttendanceRepository } from "../repositories/AttendanceRepository";

// Cache
import type { CachedShift } from "../services/cache/ShiftCacheService";

// Cache Services - NEW: Usa cache ao invés de repositories diretos
import { ShiftCacheService } from "../services/cache/ShiftCacheService";
import { UserCacheService } from "../services/cache/UserCacheService";

// Event Publisher - NEW: Publishes events para outros serviços
import { AttendanceEventPublisher } from "../events/AttendanceEventPublisher";

// Serviços especializados
import {
  AttendanceValidationService,
  AttendanceGeolocationService,
  AttendanceDiscountService,
  AttendancePhotoService,
  AttendancePolicyService,
} from "../services";

/**
 * AttendanceFacade - Facade Pattern (Event-Driven Version)
 * 
 * Responsabilidade: Orquestrar todos os serviços especializados e fornecer
 * uma interface simplificada para operações complexas de attendance.
 * 
 * MUDANÇAS PRINCIPAIS:
 * - Usa ShiftCacheService e UserCacheService ao invés de repositories diretos
 * - Publica eventos via AttendanceEventPublisher
 * - Dados de Shift e User vêm do cache Redis (alimentado via RabbitMQ)
 * - Mantém compatibilidade de API com versão anterior
 */
export class AttendanceFacade {
  // Repository local
  private attendanceRepo: AttendanceRepository;

  // Cache Services - Substitui repositories de Shift e User
  private shiftCache: ShiftCacheService;
  private userCache: UserCacheService;

  // Event Publisher
  private eventPublisher: AttendanceEventPublisher;

  // Serviços especializados
  private validationService: AttendanceValidationService;
  private geolocationService: AttendanceGeolocationService;
  private discountService: AttendanceDiscountService;
  private photoService: AttendancePhotoService;
  private policyService: AttendancePolicyService;

  constructor(
    shiftCache: ShiftCacheService,
    userCache: UserCacheService,
    eventPublisher: AttendanceEventPublisher
  ) {
    // Cache services (injetados)
    this.shiftCache = shiftCache;
    this.userCache = userCache;
    this.eventPublisher = eventPublisher;

    // Repository local
    this.attendanceRepo = new AttendanceRepository(
      AppDataSource.getRepository(Attendance)
    );

    // Serviços especializados
    this.validationService = new AttendanceValidationService(this.attendanceRepo);
    this.geolocationService = new AttendanceGeolocationService();
    this.discountService = new AttendanceDiscountService();
    this.photoService = new AttendancePhotoService();
    this.policyService = new AttendancePolicyService();
  }

  /**
   * Registra um novo attendance (check-in ou check-out)
   * Orquestra todas as validações e serviços necessários
   */
  async recordAttendance(
    dto: CreateAttendanceDTO
  ): Promise<{ 
    attendance: AttendanceResponseDTO; 
    debug: {
      validationSteps?: Array<{step: string; result: boolean}>;
      cacheStatus?: {shiftFound: boolean; userFound: boolean};
      [key: string]: unknown;
    };
  }> {
    console.log(`📝 [FACADE] Iniciando registro de ponto ${dto.type}`);

    // 1) Validações iniciais
    await this.validationService.validateAttendanceCreation(
      dto.doctorId,
      dto.shiftId,
      dto.type
    );

    // 2) Buscar shift do CACHE (ao invés de DB)
    const shift = await this.shiftCache.getShiftFromCache(dto.shiftId);
    if (!shift) {
      throw new AppError(404, "Plantão não encontrado no cache. Sincronizando...");
    }

    // 3) Buscar dados do doctor do CACHE  
    const doctor = await this.userCache.getUserFromCache(dto.doctorId);
    if (!doctor) {
      throw new AppError(404, "Médico não encontrado no cache. Sincronizando...");
    }

    // 4) Validar acesso ao shift
    this.validationService.validateShiftAccess(shift, dto.doctorId, doctor.role);

    // 5) Validar horários
    const now = new Date();
    this.validationService.validateAttendanceTime(
      dto.type,
      now,
      shift.startTime,
      shift.endTime
    );

    // 6) Buscar IN anterior se for OUT
    let inPunch: Attendance | null = null;
    if (dto.type === "OUT") {
      inPunch = await this.attendanceRepo.findByShiftAndDoctor(
        dto.shiftId,
        dto.doctorId,
        "IN"
      );
    }

    // 7) Buscar políticas (usa dados do hospital do cache)
    const hospitalData = await this.userCache.getUserFromCache(shift.hospitalId);
    if (!hospitalData) {
      throw new AppError(404, "Hospital não encontrado no cache");
    }

    const policy = await this.policyService.getEffectiveForShift(
      shift.hospitalId,
      shift.healthUnitId
    );

    // 8) Validar coordenadas GPS (antifraude)
    const coordValidation = this.geolocationService.validateCoordinates(
      dto.latitude,
      dto.longitude
    );

    let coordinateSuspicionReason: string | undefined;
    if (!coordValidation.isValid && coordValidation.severity === "warning") {
      coordinateSuspicionReason = coordValidation.reason;
      console.warn(`⚠️ [ANTIFRAUDE] Coordenadas suspeitas: ${coordinateSuspicionReason}`);
    }

    if (coordValidation.trustScore < 50) {
      coordinateSuspicionReason =
        coordinateSuspicionReason ||
        `Score de confiança baixo (${coordValidation.trustScore}/100): ${coordValidation.flags.join(", ")}`;
      console.warn(`⚠️ [ANTIFRAUDE] ${coordinateSuspicionReason}`);
    }

    // 9) Validar geofence (usa dados da HealthUnit do shift cached)
    // TODO: Buscar healthUnit pelo shift.healthUnitId se necessário
    const geofenceResult = this.geolocationService.validateGeofence(
      dto.latitude,
      dto.longitude,
      { id: shift.healthUnitId || '', name: undefined } // Simplificado por enquanto
    );

    // 10) Obter informações de timezone
    const timezoneInfo = this.geolocationService.getTimezoneInfo(
      dto.latitude,
      dto.longitude
    );

    // 11) Calcular desconto por atraso
    const lateDiscountInfo = this.discountService.calculateTimeBasedDiscount(
      dto.type,
      now,
      shift.startTime,
      shift.endTime,
      shift.value
    );

    // 12) Upload de foto
    const photoUpload = await this.photoService.uploadPhoto(
      dto.photo ? "base64-photo-data" : undefined, // Simplificado por enquanto
      dto.shiftId,
      dto.doctorId
    );

    // 13) Determinar status
    let status: AttendanceStatus = "PENDING";
    let areaCheckReason = geofenceResult.reason;

    const isExcludedMedic = policy.excludedMedicIds?.includes(dto.doctorId);
    const isWithinTimeWindow =
      dto.type === "IN" ||
      this.validationService.validateCheckoutTimeWindow(now, shift.endTime);

    if (!isWithinTimeWindow) {
      status = "PENDING";
      areaCheckReason = "Check-out tardio - requer aprovação manual";
    } else if (coordinateSuspicionReason) {
      status = "PENDING";
      areaCheckReason = coordinateSuspicionReason;
    } else if (isExcludedMedic) {
      status = "APPROVED";
      areaCheckReason = "Médico excluído da verificação de área";
      console.log("✅ [FACADE] APROVADO: médico na lista de exclusões");
    } else if (geofenceResult.withinAllowedArea) {
      status = "APPROVED";
      console.log("✅ [FACADE] APROVADO: dentro da área permitida");
    } else {
      status = "PENDING";
      console.log("⏳ [FACADE] PENDENTE: fora da área permitida");
    }

    // 14) Criar attendance
    const attendance = this.attendanceRepo.create({
      // Usar IDs ao invés de relações
      doctorId: dto.doctorId,  
      shiftId: dto.shiftId,
      type: dto.type,
      timestamp: now,
      latitude: dto.latitude,
      longitude: dto.longitude,
      reason: dto.reason, // Motivo fornecido pelo USUÁRIO
      statusReason: areaCheckReason, // Motivo gerado pelo SISTEMA
      status,
      tz: timezoneInfo.tz,
      tzOffsetMin: timezoneInfo.tzOffsetMin,
      localTimestamp: timezoneInfo.localTimestamp,
      isLate: lateDiscountInfo.isLate,
      lateMinutes: lateDiscountInfo.lateMinutes,
      hasAutomaticDiscount: lateDiscountInfo.shouldApplyDiscount,
      discountPercentage: lateDiscountInfo.discountPercentage,
      approvedWithDiscount:
        status === "APPROVED" && lateDiscountInfo.shouldApplyDiscount,
      photoS3Key: photoUpload.key || undefined,
    });

    // 15) Salvar
    const saved = await this.attendanceRepo.save(attendance);

    // 16) PUBLICAR EVENTO - NEW: Notificar outros serviços
    if (status === "APPROVED") {
      await this.eventPublisher.publishAttendanceApproved({
        attendanceId: saved.id,
        shiftId: dto.shiftId,
        doctorId: dto.doctorId,
        hospitalId: shift.hospitalId,
        approvedWithDiscount: lateDiscountInfo.shouldApplyDiscount,
        discountPercentage: lateDiscountInfo.discountPercentage,
        finalShiftValue: shift.value * (1 - lateDiscountInfo.discountPercentage / 100),
      });
    } else {
      await this.eventPublisher.publishAttendanceRecorded({
        attendanceId: saved.id,
        shiftId: dto.shiftId,
        doctorId: dto.doctorId,
        type: dto.type as "IN" | "OUT",
        timestamp: now,
        latitude: dto.latitude,
        longitude: dto.longitude,
        status: status as "PENDING" | "APPROVED" | "REJECTED",
        isLate: lateDiscountInfo.isLate,
        lateMinutes: lateDiscountInfo.lateMinutes,
        discountPercentage: lateDiscountInfo.discountPercentage,
        reason: areaCheckReason,
      });
    }

    // 17) Se OUT aprovado, processar finalização do shift
    if (dto.type === "OUT" && status === "APPROVED" && inPunch?.status === "APPROVED") {
      await this.finalizeShift(dto.shiftId, shift);
    }

    // 18) Montar debug
    const debug = {
      addressUsed: shift.healthUnitId ? `HealthUnit ${shift.healthUnitId}` : "Sem HealthUnit",
      addressSource: "cached-data" as const,
      geocodeOk: false,
      punchLat: dto.latitude,
      punchLng: dto.longitude,
      maxDistanceMeters: 5,
      outTsIso: now.toISOString(),
      tz: timezoneInfo.tz,
      tzOffsetMin: timezoneInfo.tzOffsetMin,
      localIso: timezoneInfo.localTimestamp.toISOString(),
      policySource: "healthunit-polygon",
      policy: {
        maxDistanceMeters: 5,
        outTimeWindowMs: policy.outTimeWindowMs,
        useDistance: false,
        useTimeWindow: true,
      },
      lateDiscountInfo,
      coordinateValidation: {
        isValid: coordValidation.isValid,
        latDecimals: coordValidation.latDecimals,
        lngDecimals: coordValidation.lngDecimals,
        trustScore: coordValidation.trustScore,
        confidence: coordValidation.confidence,
        flags: coordValidation.flags,
        severity: coordValidation.severity,
      },
      polygonCheck: {
        hasPolygons: geofenceResult.hasPolygons,
        isWithinPolygon: geofenceResult.isWithinPolygon,
        matchedAreas: geofenceResult.matchedAreas,
        distanceToNearestArea: geofenceResult.distanceToNearestArea,
      },
      geocodeSkipped: true,
      withinRadius: geofenceResult.withinAllowedArea,
      statusAfterPunch: status,
      shiftApprovalStatusAfter: shift.approvalStatus,
      photoKey: photoUpload.key,
      s3Upload: { key: photoUpload.key, ok: photoUpload.success },
    };

    // 19) Converter para DTO de resposta com dados do cache
    const response = await this.toResponseDTO(saved);

    console.log(`✅ [FACADE] Ponto ${dto.type} registrado com sucesso`);

    return { attendance: response, debug };
  }

  /**
   * Aprova um attendance com controle de desconto
   */
  async approveAttendance(dto: ApproveAttendanceDTO): Promise<AttendanceResponseDTO> {
    console.log(`✅ [FACADE] Aprovando attendance ${dto.attendanceId}`);

    const attendance = await this.attendanceRepo.findById(dto.attendanceId);
    if (!attendance) {
      throw new AppError(404, "Registro de ponto não encontrado.");
    }

    // Verificar acesso usando dados do cache
    const shift = await this.shiftCache.getShiftFromCache(attendance.shiftId);
    if (!shift || shift.hospitalId !== dto.hospitalId) {
      throw new AppError(403, "Sem permissão para aprovar este registro.");
    }

    if (attendance.status === "APPROVED") {
      throw new AppError(400, "Este registro já foi aprovado.");
    }

    // Atualizar status e controle de desconto
    attendance.status = "APPROVED";
    attendance.approvedWithDiscount =
      (dto.applyDiscount ?? false) && attendance.isLate;

    if (dto.reason) {
      attendance.reason = dto.reason;
    }

    // Se escolheu não aplicar desconto, zerar o percentual
    if (!dto.applyDiscount || !attendance.isLate) {
      attendance.discountPercentage = 0;
      attendance.hasAutomaticDiscount = false;
    }

    const saved = await this.attendanceRepo.save(attendance);

    // PUBLICAR EVENTO - NEW: Notificar aprovação
    await this.eventPublisher.publishAttendanceApproved({
      attendanceId: saved.id,
      shiftId: attendance.shiftId,
      doctorId: attendance.doctorId,
      hospitalId: shift.hospitalId,
      approvedWithDiscount: attendance.approvedWithDiscount || false,
      discountPercentage: Number(attendance.discountPercentage || 0),
      finalShiftValue: shift.value * (1 - Number(attendance.discountPercentage || 0) / 100),
    });

    // Atualizar valor final do shift
    await this.updateShiftFinalValue(attendance.shiftId);

    console.log(`✅ [FACADE] Attendance aprovado com sucesso`);

    return this.toResponseDTO(saved);
  }

  /**
   * Rejeita um attendance
   */
  async rejectAttendance(dto: RejectAttendanceDTO): Promise<AttendanceResponseDTO> {
    console.log(`❌ [FACADE] Rejeitando attendance ${dto.attendanceId}`);

    const attendance = await this.attendanceRepo.findById(dto.attendanceId);
    if (!attendance) {
      throw new AppError(404, "Registro de ponto não encontrado.");
    }

    // Verificar acesso usando dados do cache
    const shift = await this.shiftCache.getShiftFromCache(attendance.shiftId);
    if (!shift || shift.hospitalId !== dto.hospitalId) {
      throw new AppError(403, "Sem permissão para rejeitar este registro.");
    }

    attendance.status = "REJECTED";
    attendance.approvedWithDiscount = false;
    attendance.discountPercentage = 0;
    attendance.hasAutomaticDiscount = false;

    if (dto.reason) {
      attendance.reason = dto.reason;
    }

    const saved = await this.attendanceRepo.save(attendance);

    // PUBLICAR EVENTO - NEW: Notificar rejeição
    await this.eventPublisher.publishAttendanceRejected({
      attendanceId: saved.id,
      shiftId: attendance.shiftId,
      doctorId: attendance.doctorId,
      hospitalId: shift.hospitalId,
      reason: dto.reason || "Rejeitado pelo hospital",
    });

    // Atualizar valor final do shift
    await this.updateShiftFinalValue(attendance.shiftId);

    console.log(`❌ [FACADE] Attendance rejeitado`);

    return this.toResponseDTO(saved);
  }

  /**
   * Lista attendances com filtros
   */
  async listAttendances(
    dto: ListAttendancesDTO
  ): Promise<{ items: AttendanceResponseDTO[]; total: number; page: number; limit: number }> {
    const page = dto.page || 1;
    const limit = dto.limit || 10;

    const where: Record<string, unknown> = {};
    if (dto.shiftId) where.shiftId = dto.shiftId;
    if (dto.doctorId) where.doctorId = dto.doctorId;
    if (dto.status) where.status = dto.status;

    const [items, total] = await this.attendanceRepo.findAndCount({
      where,
      order: { timestamp: "ASC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Converter para DTOs com dados do cache
    const dtos = await Promise.all(
      items.map((att) => this.toResponseDTO(att))
    );

    return { items: dtos, total, page, limit };
  }

  /**
   * Finaliza um shift quando OUT é aprovado
   */
  private async finalizeShift(shiftId: string, shift: CachedShift): Promise<void> {
    console.log(`🏁 [FACADE] Finalizando shift ${shiftId}`);

    try {
      // Atualizar cache local
      await this.shiftCache.updateShiftCache(shiftId, {
        approvalStatus: "APPROVED",
        approvedAt: new Date(),
      });

      // Calcular e atualizar valor final
      await this.updateShiftFinalValue(shiftId);

      // TODO: PUBLICAR EVENTO para Shift Service (método não existe ainda)
      console.log(`📤 [FACADE] Shift ${shiftId} finalizado - evento seria publicado aqui`);

      console.log(`🏁 [FACADE] Shift finalizado com sucesso`);
    } catch (error) {
      console.error(`❌ [FACADE] Erro ao finalizar shift:`, error);
    }
  }

  /**
   * Atualiza o valor final do shift baseado nos descontos
   */
  private async updateShiftFinalValue(shiftId: string): Promise<void> {
    console.log(`💰 [FACADE] Atualizando valor final do shift ${shiftId}`);

    try {
      // Buscar shift do cache
      const shift = await this.shiftCache.getShiftFromCache(shiftId);
      if (!shift) return;

      // Buscar attendances aprovadas
      const attendances = await this.attendanceRepo.findByShiftAndStatus(
        shiftId,
        "APPROVED"
      );

      // Calcular desconto
      const discountInfo = this.discountService.calculateShiftDiscountInfo(
        shift.value,
        attendances.map((att) => ({
          id: att.id,
          type: att.type as "IN" | "OUT",
          discountPercentage: Number(att.discountPercentage || 0),
          approvedWithDiscount: att.approvedWithDiscount || false,
        }))
      );

      // Atualizar cache local
      await this.shiftCache.updateShiftCache(shiftId, {
        finalValue: discountInfo.finalValue,
      });

      console.log(
        `💰 [FACADE] Valor final atualizado: R$ ${discountInfo.finalValue.toFixed(2)}`
      );
    } catch (error) {
      console.error(
        `❌ [FACADE] Erro ao atualizar valor final do shift ${shiftId}:`,
        error
      );
    }
  }

  /**
   * Converte Attendance entity para DTO de resposta usando dados do cache
   */
  private async toResponseDTO(attendance: Attendance): Promise<AttendanceResponseDTO> {
    const photoSignedUrl = this.photoService.generateSignedUrl(attendance.photoS3Key ?? null);

    // Buscar dados do cache
    const doctor = await this.userCache.getUserFromCache(attendance.doctorId);
    const shift = await this.shiftCache.getShiftFromCache(attendance.shiftId);
    
    let hospital = null;
    if (shift?.hospitalId) {
      hospital = await this.userCache.getUserFromCache(shift.hospitalId);
    }

    let shiftDoctor = null;
    if (shift?.doctorId) {
      shiftDoctor = await this.userCache.getUserFromCache(shift.doctorId);
    }

    const dto = new AttendanceResponseDTO();
    dto.id = attendance.id;
    dto.type = attendance.type;
    dto.timestamp = attendance.timestamp;
    dto.latitude = attendance.latitude;
    dto.longitude = attendance.longitude;
    dto.reason = attendance.reason;
    dto.status = attendance.status;
    dto.photoS3Key = attendance.photoS3Key;
    dto.photoSignedUrl = photoSignedUrl;
    dto.createdAt = attendance.createdAt;
    dto.updatedAt = attendance.updatedAt;
    dto.isLate = attendance.isLate;
    dto.lateMinutes = attendance.lateMinutes;
    dto.hasAutomaticDiscount = attendance.hasAutomaticDiscount;
    dto.discountPercentage = Number(attendance.discountPercentage);
    dto.approvedWithDiscount = attendance.approvedWithDiscount;

    // Dados do cache ao invés de relações
    if (doctor) {
      dto.doctor = {
        id: doctor.id,
        username: doctor.username,
        email: doctor.email ?? null,
        role: doctor.role,
      };
    }

    if (shift) {
      dto.shift = {
        id: shift.id,
        value: Number(shift.value),
        specialty: shift.specialty,
        startTime: shift.startTime,
        endTime: shift.endTime,
        status: shift.status,
        createdAt: shift.createdAt,
      };

      if (hospital) {
        dto.shift.hospital = {
          id: hospital.id,
          username: hospital.username,
          email: hospital.email ?? null,
          role: hospital.role,
        };
      }

      if (shiftDoctor) {
        dto.shift.doctor = {
          id: shiftDoctor.id,
          username: shiftDoctor.username,
          email: shiftDoctor.email ?? null,
          role: shiftDoctor.role,
        };
      }
    }

    return dto;
  }
}