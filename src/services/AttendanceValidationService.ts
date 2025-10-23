import { AppError } from "../errors/AppError";
import { AttendanceType } from "../entities/Attendance";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { CachedShift } from "./cache/ShiftCacheService";

/**
 * Serviço especializado em validações de attendance (Event-Driven Version)
 * Responsabilidade Única: Validar regras de negócio
 */
export class AttendanceValidationService {
  constructor(private attendanceRepository: AttendanceRepository) {}

  /**
   * Valida se pode registrar um novo attendance
   */
  async validateAttendanceCreation(
    doctorId: string,
    shiftId: string,
    type: AttendanceType
  ): Promise<void> {
    // 1) Verificar se já existe attendance do mesmo tipo
    const existingSameType = await this.attendanceRepository.findByShiftAndDoctor(
      shiftId,
      doctorId,
      type
    );

    if (existingSameType) {
      throw new AppError(409, `Você já registrou ${type} neste plantão.`);
    }

    // 2) Se é OUT, verificar se existe IN anterior
    if (type === "OUT") {
      const inPunch = await this.attendanceRepository.findByShiftAndDoctor(
        shiftId,
        doctorId,
        "IN"
      );

      if (!inPunch) {
        throw new AppError(400, "Registre o IN antes do OUT neste plantão.");
      }
    }
  }

  /**
   * Valida se o horário do attendance está dentro do permitido
   */
  validateAttendanceTime(
    type: AttendanceType,
    now: Date,
    shiftStart: Date,
    shiftEnd: Date
  ): void {
    console.log("🕐 [HORÁRIO DEBUG]", {
      type,
      now_ISO: now.toISOString(),
      shiftStart_ISO: shiftStart.toISOString(),
      shiftEnd_ISO: shiftEnd.toISOString(),
    });

    // Validação restritiva por tipo de attendance
    if (type === "IN") {
      // Para CHECK-IN: máximo 1 hora antes do início do plantão
      const maxEarlyForIn = 60 * 60 * 1000; // 1 hora
      const earliestForIn = new Date(shiftStart.getTime() - maxEarlyForIn);

      if (now < earliestForIn) {
        throw new AppError(
          400,
          `Check-in muito antecipado. O plantão começa às ${shiftStart.toLocaleString()}.`
        );
      }
    } else if (type === "OUT") {
      // Para CHECK-OUT: só após o início do plantão
      if (now < shiftStart) {
        throw new AppError(
          400,
          `Check-out não permitido antes do início do plantão.`
        );
      }
    }
  }

  /**
   * Valida acesso ao shift (adaptado para cache)
   */
  validateShiftAccess(shift: CachedShift, doctorId: string, userRole: string): void {
    // Lógica simplificada - será expandida conforme necessário
    if (shift.doctorId && shift.doctorId !== doctorId && userRole !== "hospital") {
      throw new AppError(403, "Sem acesso a este plantão");
    }
  }

  /**
   * Valida janela de checkout
   */
  validateCheckoutTimeWindow(now: Date, shiftEnd: Date): boolean {
    const windowMs = 4 * 60 * 60 * 1000; // 4 horas
    return Math.abs(now.getTime() - shiftEnd.getTime()) <= windowMs;
  }
}