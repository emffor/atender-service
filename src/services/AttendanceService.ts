import { AttendanceRepository } from '../repositories/AttendanceRepository';
import { ShiftCacheService, CachedShift } from './cache/ShiftCacheService';
import { UserCacheService } from './cache/UserCacheService';
import { Attendance } from '../entities/Attendance';
import { Between } from 'typeorm';
import {
  UserContact,
  ShiftSummary,
  OpenPunchesOptions,
  PaginatedResponseDto,
} from '../dto/AttendanceResponse.dto';

/**
 * AttendanceService - Service Layer
 * 
 * Métodos auxiliares e queries especializadas role-based
 * para o controller de Attendance
 */
export class AttendanceService {
  constructor(
    private repository: AttendanceRepository,
    private shiftCache: ShiftCacheService,
    private userCache: UserCacheService
  ) {}

  /**
   * Busca informações de contato do usuário
   * Usado para envio de emails
   */
  async getUserContactById(userId: string): Promise<UserContact | null> {
    try {
      const user = await this.userCache.getUserFromCache(userId);
      if (!user) {
        console.warn(`[AttendanceService] User ${userId} not found in cache`);
        return null;
      }

      return {
        email: user.email,
        name: undefined, // CachedUser não tem name
        username: user.username,
      };
    } catch (error) {
      console.error('[AttendanceService] Error getting user contact:', error);
      return null;
    }
  }

  /**
   * Busca resumo do shift para emails
   * Inclui dados do hospital
   */
  async getShiftSummary(shiftId: string): Promise<ShiftSummary | null> {
    try {
      const shift = await this.shiftCache.getShiftFromCache(shiftId);
      if (!shift) {
        console.warn(`[AttendanceService] Shift ${shiftId} not found in cache`);
        return null;
      }

      // Buscar dados do hospital
      const hospital = shift.hospitalId 
        ? await this.shiftCache.getHospitalFromCache(shift.hospitalId)
        : null;

      return {
        id: shift.id,
        startTime: shift.startTime,
        endTime: shift.endTime,
        specialty: shift.specialty,
        value: shift.value,
        hospitalEmail: hospital?.email,
        hospitalName: hospital?.name,
      };
    } catch (error) {
      console.error('[AttendanceService] Error getting shift summary:', error);
      return null;
    }
  }

  /**
   * Lista pontos abertos (IN sem OUT) para um médico específico em um dia
   * Role: client_medic
   */
  async listOpenPunchesForDoctorOnDay(
    doctorId: string,
    opts: OpenPunchesOptions
  ): Promise<PaginatedResponseDto<Attendance>> {
    const date = opts.date ? new Date(opts.date) : new Date();
    const page = opts.page || 1;
    const limit = opts.limit || 10;

    const attendances = await this.repository.findOpenPunchesForDay(doctorId, date);

    // Filtrar por specialty se fornecido
    let filtered = attendances;
    if (opts.specialty) {
      filtered = await this.filterBySpecialty(attendances, opts.specialty);
    }

    // Paginação
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedData = filtered.slice(start, end);

    return {
      data: paginatedData,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
    };
  }

  /**
   * Lista pontos abertos para um hospital específico em um dia
   * Role: client_hospital
   */
  async listOpenPunchesForHospitalOnDay(
    hospitalId: string,
    opts: OpenPunchesOptions
  ): Promise<PaginatedResponseDto<Attendance>> {
    const date = opts.date ? new Date(opts.date) : new Date();
    const page = opts.page || 1;
    const limit = opts.limit || 10;

    // Buscar shifts do hospital
    const shifts = await this.shiftCache.getShiftsByHospital(hospitalId);
    const doctorIds = [...new Set(shifts.map((s: CachedShift) => s.doctorId))];

    // Buscar attendances de todos os médicos do hospital
    const allAttendances: Attendance[] = [];
    for (const doctorId of doctorIds) {
      if (doctorId) {
        const attendances = await this.repository.findOpenPunchesForDay(String(doctorId), date);
        allAttendances.push(...attendances);
      }
    }

    // Filtrar por specialty se fornecido
    let filtered = allAttendances;
    if (opts.specialty) {
      filtered = await this.filterBySpecialty(allAttendances, opts.specialty);
    }

    // Paginação
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedData = filtered.slice(start, end);

    return {
      data: paginatedData,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
    };
  }

  /**
   * Lista todos os pontos abertos em um dia
   * Role: admin_master / admin_mini
   */
  async listOpenPunchesForAllOnDay(
    opts: OpenPunchesOptions
  ): Promise<PaginatedResponseDto<Attendance>> {
    const date = opts.date ? new Date(opts.date) : new Date();
    const page = opts.page || 1;
    const limit = opts.limit || 10;

    // Para admins, usar query mais ampla
    // Por enquanto, vamos buscar de todos os doctors (pode ser otimizado)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Query customizada para buscar todos
    const attendances = await this.repository.find({
      type: 'IN',
      timestamp: Between(startOfDay, endOfDay),
    });

    // Filtrar por specialty se fornecido
    let filtered = attendances;
    if (opts.specialty) {
      filtered = await this.filterBySpecialty(attendances, opts.specialty);
    }

    // Filtrar por hospitalId se fornecido
    if (opts.hospitalId) {
      filtered = filtered.filter(att => att.shiftId === opts.hospitalId);
    }

    // Paginação
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedData = filtered.slice(start, end);

    return {
      data: paginatedData,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
    };
  }

  /**
   * Lista pontos atrasados para um médico
   * Role: client_medic
   */
  async listOpenPunchesForDoctorLate(
    doctorId: string,
    opts: OpenPunchesOptions
  ): Promise<PaginatedResponseDto<Attendance>> {
    const uptoDate = opts.uptoDate ? new Date(opts.uptoDate) : new Date();
    const page = opts.page || 1;
    const limit = opts.limit || 10;

    const startDate = new Date(uptoDate);
    startDate.setDate(startDate.getDate() - 30); // Últimos 30 dias

    const attendances = await this.repository.findOpenPunchesLate(
      '',
      startDate,
      uptoDate
    );

    // Filtrar apenas do médico específico
    let filtered = attendances.filter(att => att.doctorId === doctorId);

    // Filtrar por specialty se fornecido
    if (opts.specialty) {
      filtered = await this.filterBySpecialty(filtered, opts.specialty);
    }

    // Paginação
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedData = filtered.slice(start, end);

    return {
      data: paginatedData,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
    };
  }

  /**
   * Lista pontos atrasados para um hospital
   * Role: client_hospital
   */
  async listOpenPunchesForHospitalLate(
    hospitalId: string,
    opts: OpenPunchesOptions
  ): Promise<PaginatedResponseDto<Attendance>> {
    const uptoDate = opts.uptoDate ? new Date(opts.uptoDate) : new Date();
    const page = opts.page || 1;
    const limit = opts.limit || 10;

    const startDate = new Date(uptoDate);
    startDate.setDate(startDate.getDate() - 30);

    const attendances = await this.repository.findOpenPunchesLate(
      hospitalId,
      startDate,
      uptoDate
    );

    // Filtrar por specialty se fornecido
    let filtered = attendances;
    if (opts.specialty) {
      filtered = await this.filterBySpecialty(attendances, opts.specialty);
    }

    // Paginação
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedData = filtered.slice(start, end);

    return {
      data: paginatedData,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
    };
  }

  /**
   * Lista todos os pontos atrasados
   * Role: admin_master / admin_mini
   */
  async listOpenPunchesForAllLate(
    opts: OpenPunchesOptions
  ): Promise<PaginatedResponseDto<Attendance>> {
    const uptoDate = opts.uptoDate ? new Date(opts.uptoDate) : new Date();
    const page = opts.page || 1;
    const limit = opts.limit || 10;

    const startDate = new Date(uptoDate);
    startDate.setDate(startDate.getDate() - 30);

    const attendances = await this.repository.findOpenPunchesLate(
      '', // Sem filtro de hospital
      startDate,
      uptoDate
    );

    // Filtrar por specialty se fornecido
    let filtered = attendances;
    if (opts.specialty) {
      filtered = await this.filterBySpecialty(attendances, opts.specialty);
    }

    // Filtrar por hospitalId se fornecido
    if (opts.hospitalId) {
      // Buscar shifts do hospital
      const shifts = await this.shiftCache.getShiftsByHospital(opts.hospitalId);
      const shiftIds = new Set(shifts.map((s: CachedShift) => s.id));
      filtered = filtered.filter(att => shiftIds.has(att.shiftId));
    }

    // Paginação
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedData = filtered.slice(start, end);

    return {
      data: paginatedData,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
    };
  }

  /**
   * Filtra attendances por specialty
   */
  private async filterBySpecialty(
    attendances: Attendance[],
    specialty: string
  ): Promise<Attendance[]> {
    const filtered: Attendance[] = [];

    for (const att of attendances) {
      const shift = await this.shiftCache.getShiftFromCache(att.shiftId);
      if (shift && shift.specialty === specialty) {
        filtered.push(att);
      }
    }

    return filtered;
  }

  /**
   * Deriva o nome do usuário com fallback chain
   * name ?? username ?? email.split('@')[0]
   */
  deriveName(contact: UserContact): string {
    return contact.name || contact.username || contact.email.split('@')[0];
  }

  /**
   * Traduz status para português
   */
  translateStatus(status: string): string {
    const translations: Record<string, string> = {
      'APPROVED': 'APROVADO',
      'PENDING': 'PENDENTE',
      'REJECTED': 'REJEITADO',
    };

    return translations[status] || status;
  }

  /**
   * Alterna desconto em um attendance individual
   * Usado após ponto aprovado para ajustar desconto
   */
  async toggleAttendanceDiscount(
    attendanceId: string,
    hospitalId: string,
    useDiscount: boolean,
    reason?: string
  ): Promise<{
    attendance: Attendance;
    changesSummary: {
      previous: { approvedWithDiscount: boolean; discountPercentage: number };
      current: { approvedWithDiscount: boolean; discountPercentage: number };
    };
    shiftValue: {
      originalValue: number;
      finalValue: number;
      discountApplied: number;
    };
  }> {
    // Buscar attendance
    const attendance = await this.repository.findById(attendanceId);
    if (!attendance) {
      throw new Error(`Attendance ${attendanceId} não encontrado`);
    }

    // Verificar se o attendance pertence ao hospital
    const shift = await this.shiftCache.getShiftFromCache(attendance.shiftId);
    if (!shift || shift.hospitalId !== hospitalId) {
      throw new Error('Attendance não pertence a este hospital');
    }

    // Verificar se está aprovado
    if (attendance.status !== 'APPROVED') {
      throw new Error('Apenas attendances aprovados podem ter desconto alternado');
    }

    // Guardar estado anterior
    const previousState = {
      approvedWithDiscount: attendance.approvedWithDiscount || false,
      discountPercentage: attendance.discountPercentage || 0,
    };

    // Atualizar attendance
    attendance.approvedWithDiscount = useDiscount;
    attendance.discountPercentage = useDiscount ? (attendance.discountPercentage || 10) : 0;
    
    if (reason) {
      attendance.reason = reason;
    }

    await this.repository.save(attendance);

    // Calcular valores
    const originalValue = shift.value;
    const discountAmount = useDiscount ? (originalValue * attendance.discountPercentage / 100) : 0;
    const finalValue = originalValue - discountAmount;

    return {
      attendance,
      changesSummary: {
        previous: previousState,
        current: {
          approvedWithDiscount: attendance.approvedWithDiscount,
          discountPercentage: attendance.discountPercentage,
        },
      },
      shiftValue: {
        originalValue,
        finalValue,
        discountApplied: discountAmount,
      },
    };
  }

  /**
   * Alterna desconto em todos os attendances de um shift
   * Aplica a mudança em todos os pontos aprovados do shift
   */
  async toggleShiftDiscount(
    shiftId: string,
    hospitalId: string,
    useDiscount: boolean,
    reason?: string
  ): Promise<{
    shift: { id: string; value: number };
    attendancesModified: Array<{
      id: string;
      type: 'IN' | 'OUT';
      approvedWithDiscount: boolean;
      discountPercentage: number;
    }>;
    summary: {
      totalAttendances: number;
      modifiedCount: number;
      originalValue: number;
      finalValue: number;
      totalDiscount: number;
    };
  }> {
    // Verificar shift
    const shift = await this.shiftCache.getShiftFromCache(shiftId);
    if (!shift) {
      throw new Error(`Shift ${shiftId} não encontrado`);
    }

    if (shift.hospitalId !== hospitalId) {
      throw new Error('Shift não pertence a este hospital');
    }

    // Buscar todos os attendances aprovados do shift
    const allAttendances = await this.repository.find({ shiftId });
    const approvedAttendances = allAttendances.filter(
      att => att.status === 'APPROVED'
    );

    if (approvedAttendances.length === 0) {
      throw new Error('Nenhum attendance aprovado encontrado para este shift');
    }

    // Modificar todos os attendances
    const modifiedAttendances: Array<{
      id: string;
      type: 'IN' | 'OUT';
      approvedWithDiscount: boolean;
      discountPercentage: number;
    }> = [];

    let totalDiscount = 0;

    for (const attendance of approvedAttendances) {
      attendance.approvedWithDiscount = useDiscount;
      attendance.discountPercentage = useDiscount ? (attendance.discountPercentage || 10) : 0;
      
      if (reason) {
        attendance.reason = reason;
      }

      await this.repository.save(attendance);

      modifiedAttendances.push({
        id: attendance.id,
        type: attendance.type as 'IN' | 'OUT',
        approvedWithDiscount: attendance.approvedWithDiscount,
        discountPercentage: attendance.discountPercentage,
      });

      if (useDiscount) {
        totalDiscount += (shift.value * attendance.discountPercentage / 100);
      }
    }

    const originalValue = shift.value * approvedAttendances.length;
    const finalValue = originalValue - totalDiscount;

    return {
      shift: {
        id: shift.id,
        value: shift.value,
      },
      attendancesModified: modifiedAttendances,
      summary: {
        totalAttendances: approvedAttendances.length,
        modifiedCount: modifiedAttendances.length,
        originalValue,
        finalValue,
        totalDiscount,
      },
    };
  }

  /**
   * Conta attendances por status para um hospital em um dia específico
   */
  async countByStatusForDayHospital(
    hospitalId: string,
    date: string
  ): Promise<{ APPROVED: number; PENDING: number; REJECTED: number }> {
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Buscar shifts do hospital
    const shifts = await this.shiftCache.getShiftsByHospital(hospitalId);
    const shiftIds = new Set(shifts.map((s: CachedShift) => s.id));

    // Buscar attendances do dia
    const attendances = await this.repository.find({
      timestamp: Between(startOfDay, endOfDay),
    });

    // Filtrar por shifts do hospital
    const hospitalAttendances = attendances.filter(att => 
      shiftIds.has(att.shiftId)
    );

    // Contar por status
    const counts = {
      APPROVED: 0,
      PENDING: 0,
      REJECTED: 0,
    };

    for (const att of hospitalAttendances) {
      if (att.status in counts) {
        counts[att.status as keyof typeof counts]++;
      }
    }

    return counts;
  }

  /**
   * Lista attendances faltando (missing punches) para um usuário
   * Pontos IN sem OUT correspondente
   */
  async getMissingPunchesForUser(
    userId: string,
    role: string,
    shiftId?: string
  ): Promise<Attendance[]> {
    let attendances: Attendance[];

    if (shiftId) {
      // Buscar apenas do shift específico
      attendances = await this.repository.find({ shiftId });
    } else {
      // Buscar todos os attendances do usuário
      if (role === 'client_medic') {
        attendances = await this.repository.find({ doctorId: userId });
      } else if (role === 'client_hospital') {
        // Buscar shifts do hospital
        const shifts = await this.shiftCache.getShiftsByHospital(userId);
        const shiftIds = new Set(shifts.map((s: CachedShift) => s.id));
        
        // Buscar attendances dos shifts
        const allAttendances = await this.repository.find({});
        attendances = allAttendances.filter(att => shiftIds.has(att.shiftId));
      } else {
        // Admin vê todos
        attendances = await this.repository.find({});
      }
    }

    // Filtrar apenas IN sem OUT
    const missingPunches: Attendance[] = [];
    const punchInMap = new Map<string, Attendance>();

    // Separar IN e OUT
    for (const att of attendances) {
      if (att.type === 'IN') {
        const key = `${att.doctorId}-${att.shiftId}`;
        punchInMap.set(key, att);
      } else if (att.type === 'OUT') {
        const key = `${att.doctorId}-${att.shiftId}`;
        punchInMap.delete(key); // Remove IN se tiver OUT
      }
    }

    // Attendances restantes são missing
    return Array.from(punchInMap.values());
  }

  /**
   * Lista attendances por status para um usuário
   * Com paginação e filtros role-based
   */
  async listByStatusForUser(
    userId: string,
    role: string,
    shiftId: string | undefined,
    status: string | undefined,
    page: number,
    limit: number
  ): Promise<PaginatedResponseDto<Attendance>> {
    let attendances: Attendance[];

    // Filtrar por role
    if (role === 'client_medic') {
      if (shiftId) {
        attendances = await this.repository.find({ 
          doctorId: userId, 
          shiftId 
        });
      } else {
        attendances = await this.repository.find({ doctorId: userId });
      }
    } else if (role === 'client_hospital') {
      // Buscar shifts do hospital
      const shifts = await this.shiftCache.getShiftsByHospital(userId);
      const shiftIds = new Set(shifts.map((s: CachedShift) => s.id));
      
      if (shiftId) {
        // Verificar se shift pertence ao hospital
        if (!shiftIds.has(shiftId)) {
          throw new Error('Shift não pertence a este hospital');
        }
        attendances = await this.repository.find({ shiftId });
      } else {
        // Buscar de todos os shifts do hospital
        const allAttendances = await this.repository.find({});
        attendances = allAttendances.filter(att => shiftIds.has(att.shiftId));
      }
    } else {
      // Admin vê todos
      if (shiftId) {
        attendances = await this.repository.find({ shiftId });
      } else {
        attendances = await this.repository.find({});
      }
    }

    // Filtrar por status se fornecido
    if (status) {
      attendances = attendances.filter(att => att.status === status);
    }

    // Paginação
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedData = attendances.slice(start, end);

    return {
      data: paginatedData,
      total: attendances.length,
      page,
      limit,
      totalPages: Math.ceil(attendances.length / limit),
    };
  }
}


