import { AttendanceStatus, Attendance } from "../entities/Attendance";

/**
 * Interface base para estratégias de validação de attendance
 * Strategy Pattern: Define uma família de algoritmos de validação
 */
export interface IAttendanceValidationStrategy {
  validate(context: ValidationContext): Promise<ValidationResult>;
}

/**
 * Contexto para validação (adaptado para Event-Driven)
 */
export interface ValidationContext {
  // Dados do attendance
  doctorId: string;
  shiftId: string;
  type: "IN" | "OUT";
  timestamp: Date;
  coordinates: { latitude: number; longitude: number };

  // Dados do shift (do cache)
  shift: {
    id: string;
    startTime: Date;
    endTime: Date;
    value: number;
    hospitalId: string;
    doctorId?: string;
    healthUnitId?: string;
  };

  // Políticas
  policy: {
    maxDistanceMeters: number;
    outTimeWindowMs: number;
    useDistance: boolean;
    useTimeWindow: boolean;
    excludedMedicIds?: string[];
  };

  // Outros
  existingInPunch?: Attendance;
}

/**
 * Resultado da validação
 */
export interface ValidationResult {
  isValid: boolean;
  status: AttendanceStatus;
  reason?: string;
  autoApprove: boolean;
  warnings?: string[];
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Estratégia de validação de coordenadas GPS
 */
export class CoordinateValidationStrategy implements IAttendanceValidationStrategy {
  async validate(context: ValidationContext): Promise<ValidationResult> {
    // Implementação será feita no facade que chama o AttendanceGeolocationService
    return {
      isValid: true,
      status: "PENDING",
      autoApprove: false,
    };
  }
}

/**
 * Estratégia de validação de geofence (polígonos)
 */
export class GeofenceValidationStrategy implements IAttendanceValidationStrategy {
  async validate(context: ValidationContext): Promise<ValidationResult> {
    const { coordinates, shift, policy } = context;

    // Se médico está na lista de exclusão, aprovar automaticamente
    if (policy.excludedMedicIds?.includes(context.doctorId)) {
      console.log("✅ [GEOFENCE] Médico na lista de exclusões - aprovado");
      return {
        isValid: true,
        status: "APPROVED",
        autoApprove: true,
        reason: "Médico excluído da verificação de área",
      };
    }

    // Verificação simplificada - na versão real usaria geolocation service
    return {
      isValid: true,
      status: "PENDING",
      autoApprove: false,
      reason: "Validação de área será feita pelo facade",
    };
  }
}

/**
 * Estratégia de validação de janela de tempo
 */
export class TimeWindowValidationStrategy implements IAttendanceValidationStrategy {
  async validate(context: ValidationContext): Promise<ValidationResult> {
    const { type, timestamp, shift, policy } = context;

    if (type !== "OUT") {
      // IN sempre passa nessa validação
      return {
        isValid: true,
        status: "PENDING",
        autoApprove: false,
      };
    }

    // Verificar janela de tempo para OUT
    const now = new Date(timestamp);
    const shiftEnd = new Date(shift.endTime);
    const windowMs = policy.outTimeWindowMs;

    const isWithinWindow = Math.abs(now.getTime() - shiftEnd.getTime()) <= windowMs;

    if (!isWithinWindow) {
      console.log("⏰ [TIME WINDOW] Check-out fora da janela de 4h");
      return {
        isValid: false,
        status: "PENDING",
        autoApprove: false,
        reason: "Check-out fora da janela de tempo permitida",
      };
    }

    return {
      isValid: true,
      status: "PENDING",
      autoApprove: false,
    };
  }
}

/**
 * Estratégia de validação de IN anterior (para OUT)
 */
export class PreviousInValidationStrategy implements IAttendanceValidationStrategy {
  async validate(context: ValidationContext): Promise<ValidationResult> {
    const { type, existingInPunch } = context;

    if (type !== "OUT") {
      return {
        isValid: true,
        status: "PENDING",
        autoApprove: false,
      };
    }

    // Verificar se IN está aprovado
    if (!existingInPunch || existingInPunch.status !== "APPROVED") {
      console.log("⚠️ [IN CHECK] IN não aprovado ainda");
      return {
        isValid: false,
        status: "PENDING",
        autoApprove: false,
        reason: "Aguardando aprovação do check-in",
      };
    }

    return {
      isValid: true,
      status: "PENDING",
      autoApprove: false,
    };
  }
}

/**
 * Composição de múltiplas estratégias
 */
export class CompositeValidationStrategy implements IAttendanceValidationStrategy {
  constructor(private strategies: IAttendanceValidationStrategy[]) {}

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const results: ValidationResult[] = [];

    for (const strategy of this.strategies) {
      const result = await strategy.validate(context);
      results.push(result);

      // Se alguma estratégia falhar criticamente, retornar imediatamente
      if (!result.isValid && result.status === "REJECTED") {
        return result;
      }
    }

    // Agregar resultados
    const allValid = results.every((r) => r.isValid);
    const anyAutoApprove = results.some((r) => r.autoApprove);
    const reasons = results
      .filter((r) => r.reason)
      .map((r) => r.reason!)
      .join("; ");

    // Decidir status final
    let finalStatus: AttendanceStatus = "PENDING";
    if (allValid && anyAutoApprove) {
      finalStatus = "APPROVED";
    }

    return {
      isValid: allValid,
      status: finalStatus,
      autoApprove: anyAutoApprove,
      reason: reasons || undefined,
      warnings: results.flatMap((r) => r.warnings || []),
    };
  }
}