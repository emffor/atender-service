/**
 * Política de attendance
 */
export interface AttendancePolicy {
  maxDistanceMeters: number;
  outTimeWindowMs: number;
  useDistance: boolean;
  useTimeWindow: boolean;
  excludedMedicIds?: string[];
}

/**
 * Serviço especializado em políticas de attendance (Event-Driven Version)
 * Responsabilidade Única: Gerenciar políticas e regras
 */
export class AttendancePolicyService {
  
  /**
   * Obtém política efetiva para um shift
   */
  async getEffectiveForShift(
    hospitalId: string,
    healthUnitId?: string
  ): Promise<AttendancePolicy> {
    // Versão simplificada - retorna política padrão
    // TODO: Buscar do banco de dados ou cache
    
    const defaultPolicy: AttendancePolicy = {
      maxDistanceMeters: 100,
      outTimeWindowMs: 4 * 60 * 60 * 1000, // 4 horas
      useDistance: false,
      useTimeWindow: true,
      excludedMedicIds: [], // Lista de médicos excluídos da verificação de área
    };
    
    console.log(`📋 [POLICY] Aplicando política para hospital ${hospitalId}`);
    
    return defaultPolicy;
  }
}