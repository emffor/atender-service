import { AttendanceController } from "../controllers/AttendanceController";
import { ShiftCacheService } from "../services/cache/ShiftCacheService";
import { UserCacheService } from "../services/cache/UserCacheService";
import { AttendanceEventPublisher } from "../events/AttendanceEventPublisher";
import { FaceRecognitionService } from "../services/FaceRecognitionService";
import { NotificationService } from "../services/NotificationService";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { BaseRoutes } from "./BaseRoutes";

/**
 * Classe de Rotas de Attendance - POO Pattern
 * 
 * Responsabilidades:
 * - Configurar todas as rotas de attendance
 * - Gerenciar middlewares
 * - Injeção de dependências do controller
 * 
 * Herda de BaseRoutes para seguir padrão consistente
 */
export class AttendanceRoutes extends BaseRoutes {
  private controller: AttendanceController;

  constructor(
    shiftCache: ShiftCacheService,
    userCache: UserCacheService,
    eventPublisher: AttendanceEventPublisher,
    faceService: FaceRecognitionService,
    notificationService: NotificationService,
    attendanceRepository: AttendanceRepository
  ) {
    super();
    this.controller = new AttendanceController(
      shiftCache, 
      userCache, 
      eventPublisher,
      faceService,
      notificationService,
      attendanceRepository
    );
  }

  /**
   * Inicializar todas as rotas (override do método abstrato)
   */
  protected initializeRoutes(): void {
    this.setupAttendanceRoutes();
    console.log('✅ [ROUTES] AttendanceRoutes inicializadas');
  }

  /**
   * Configurar rotas de attendance
   */
  private setupAttendanceRoutes(): void {
    // POST /attendances - Registrar ponto (IN ou OUT)
    this.router.post(
      '/attendances',
      this.controller.recordAttendance.bind(this.controller)
    );
    this.logRoute('POST', '/attendances', 'Registrar ponto');

    // GET /attendances - Listar pontos com filtros
    this.router.get(
      '/attendances',
      this.controller.listAttendances.bind(this.controller)
    );
    this.logRoute('GET', '/attendances', 'Listar pontos');

    // GET /attendances/:id - Buscar ponto específico
    this.router.get(
      '/attendances/:id',
      this.controller.getAttendanceById.bind(this.controller)
    );
    this.logRoute('GET', '/attendances/:id', 'Buscar ponto específico');

    // PUT /attendances/:id/approve - Aprovar ponto
    this.router.put(
      '/attendances/:id/approve',
      this.controller.approveAttendance.bind(this.controller)
    );
    this.logRoute('PUT', '/attendances/:id/approve', 'Aprovar ponto');

    // PUT /attendances/:id/reject - Rejeitar ponto
    this.router.put(
      '/attendances/:id/reject',
      this.controller.rejectAttendance.bind(this.controller)
    );
    this.logRoute('PUT', '/attendances/:id/reject', 'Rejeitar ponto');

    // PUT /attendances/:id/toggle-discount - Toggle desconto em attendance
    this.router.put(
      '/attendances/:id/toggle-discount',
      this.controller.toggleAttendanceDiscount.bind(this.controller)
    );
    this.logRoute('PUT', '/attendances/:id/toggle-discount', 'Toggle desconto em attendance');

    // PUT /shifts/:shiftId/toggle-discount - Toggle desconto em shift
    this.router.put(
      '/shifts/:shiftId/toggle-discount',
      this.controller.toggleShiftDiscount.bind(this.controller)
    );
    this.logRoute('PUT', '/shifts/:shiftId/toggle-discount', 'Toggle desconto em shift');

    // GET /attendances/count-by-status - Contar por status
    this.router.get(
      '/attendances/count-by-status',
      this.controller.countForDayBySelfHospital.bind(this.controller)
    );
    this.logRoute('GET', '/attendances/count-by-status', 'Contar por status');

    // GET /attendances/missing - Listar pontos faltando
    this.router.get(
      '/attendances/missing',
      this.controller.listMissingPunches.bind(this.controller)
    );
    this.logRoute('GET', '/attendances/missing', 'Listar pontos faltando');

    // GET /attendances/by-status - Listar por status
    this.router.get(
      '/attendances/by-status',
      this.controller.listByStatus.bind(this.controller)
    );
    this.logRoute('GET', '/attendances/by-status', 'Listar por status');
  }
}