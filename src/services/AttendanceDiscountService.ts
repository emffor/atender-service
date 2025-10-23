/**
 * Informações de desconto por atraso
 */
export interface LateDiscountInfo {
  isLate: boolean;
  lateMinutes: number;
  shouldApplyDiscount: boolean;
  discountPercentage: number;
}

/**
 * Informações de desconto do shift
 */
export interface ShiftDiscountInfo {
  originalValue: number;
  totalDiscountPercentage: number;
  finalValue: number;
  attendanceDiscounts: Array<{
    attendanceId: string;
    type: "IN" | "OUT";
    discountPercentage: number;
    applied: boolean;
  }>;
}

/**
 * Serviço especializado em cálculo de descontos (Event-Driven Version)
 * Responsabilidade Única: Calcular descontos por atraso
 */
export class AttendanceDiscountService {
  
  /**
   * Calcula desconto baseado no tempo (atraso)
   */
  calculateTimeBasedDiscount(
    type: "IN" | "OUT",
    timestamp: Date,
    shiftStart: Date,
    shiftEnd: Date,
    shiftValue: number
  ): LateDiscountInfo {
    let isLate = false;
    let lateMinutes = 0;
    let discountPercentage = 0;
    
    if (type === "IN") {
      // Check-in após horário de início
      if (timestamp > shiftStart) {
        isLate = true;
        lateMinutes = Math.floor((timestamp.getTime() - shiftStart.getTime()) / (1000 * 60));
      }
    } else if (type === "OUT") {
      // Check-out antes do horário de fim
      if (timestamp < shiftEnd) {
        isLate = true;
        lateMinutes = Math.floor((shiftEnd.getTime() - timestamp.getTime()) / (1000 * 60));
      }
    }
    
    // Calcular percentual de desconto
    if (isLate && lateMinutes > 15) {
      // 1% por cada 15 minutos de atraso, máximo 50%
      discountPercentage = Math.min(Math.floor(lateMinutes / 15) * 1, 50);
    }
    
    const shouldApplyDiscount = isLate && discountPercentage > 0;
    
    return {
      isLate,
      lateMinutes,
      shouldApplyDiscount,
      discountPercentage,
    };
  }
  
  /**
   * Calcula informações de desconto do shift completo
   */
  calculateShiftDiscountInfo(
    originalValue: number,
    attendances: Array<{
      id: string;
      type: "IN" | "OUT";
      discountPercentage: number;
      approvedWithDiscount: boolean;
    }>
  ): ShiftDiscountInfo {
    let totalDiscountPercentage = 0;
    const attendanceDiscounts = [];
    
    for (const att of attendances) {
      const applied = att.approvedWithDiscount && att.discountPercentage > 0;
      
      if (applied) {
        totalDiscountPercentage += att.discountPercentage;
      }
      
      attendanceDiscounts.push({
        attendanceId: att.id,
        type: att.type,
        discountPercentage: att.discountPercentage,
        applied,
      });
    }
    
    // Limitar desconto total a 100%
    totalDiscountPercentage = Math.min(totalDiscountPercentage, 100);
    
    const finalValue = originalValue * (1 - totalDiscountPercentage / 100);
    
    return {
      originalValue,
      totalDiscountPercentage,
      finalValue,
      attendanceDiscounts,
    };
  }
}