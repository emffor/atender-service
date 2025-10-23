/**
 * Data Transfer Objects para Responses de Attendance
 * 
 * Define estruturas completas e type-safe para responses da API
 */

import { Attendance, AttendanceStatus } from '../entities/Attendance';

/**
 * Resultado da verificação de polígono
 */
export interface PolygonCheckResult {
  isWithinPolygon: boolean;
  distanceFromCenter?: number;
  polygonName?: string;
}

/**
 * Debug data retornado nas operações de punch
 */
export interface DebugData {
  punchLat: number;
  punchLng: number;
  maxDistanceMeters: number;
  withinRadius: boolean;
  polygonCheck: PolygonCheckResult;
  outTsIso?: string;
  shiftEndIso?: string;
  deltaEndMinutes?: number;
  withinTimeWindow?: boolean;
}

/**
 * Dados de verificação facial
 */
export interface FaceVerificationData {
  verified: boolean;
  confidence: number;
  message: string;
  requiredConfidence: number;
}

/**
 * Resumo de mudanças (antes/depois)
 */
export interface ChangesSummary {
  previous: {
    approvedWithDiscount: boolean;
    discountPercentage: number;
  };
  current: {
    approvedWithDiscount: boolean;
    discountPercentage: number;
  };
}

/**
 * Valores do shift com desconto
 */
export interface ShiftValue {
  originalValue: number;
  finalValue: number;
  discountApplied: number;
}

/**
 * Response completo para registro de ponto
 */
export interface RecordAttendanceResponseDto {
  attendance: Attendance;
  debug?: DebugData;
  faceVerification?: FaceVerificationData;
  success: boolean;
  message?: string;
}

/**
 * Response para aprovação de ponto
 */
export interface ApproveAttendanceResponseDto {
  message: string;
  attendance: Attendance;
  appliedDiscount: boolean;
  discountPercentage: number;
}

/**
 * Response para rejeição de ponto
 */
export interface RejectAttendanceResponseDto {
  message: string;
  attendance: Attendance;
}

/**
 * Response para toggle de desconto individual
 */
export interface ToggleAttendanceDiscountResponseDto {
  message: string;
  attendance: {
    id: string;
    type: 'IN' | 'OUT';
    approvedWithDiscount: boolean;
    discountPercentage: number;
  };
  changesSummary: ChangesSummary;
  shiftValue: ShiftValue;
}

/**
 * Response para toggle de desconto em shift
 */
export interface ToggleShiftDiscountResponseDto {
  message: string;
  shift: {
    id: string;
    value: number;
  };
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
}

/**
 * Response para listagem de pendentes
 */
export interface ListPendingResponseDto {
  attendances: Attendance[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Response para estatísticas
 */
export interface StatisticsResponseDto {
  totalAttendances: number;
  byStatus: {
    PENDING: number;
    APPROVED: number;
    REJECTED: number;
  };
  byType: {
    IN: number;
    OUT: number;
  };
  lateStats: {
    totalLate: number;
    avgLateMinutes: number;
  };
  discountStats: {
    totalWithDiscount: number;
    avgDiscountPercentage: number;
  };
}

/**
 * Informações de contato do usuário
 */
export interface UserContact {
  email: string;
  name?: string;
  username?: string;
}

/**
 * Resumo do shift para emails
 */
export interface ShiftSummary {
  id: string;
  startTime: Date;
  endTime: Date;
  specialty?: string;
  value: number;
  hospitalEmail?: string;
  hospitalName?: string;
}

/**
 * Opções para listagem de open punches
 */
export interface OpenPunchesOptions {
  date?: string;
  uptoDate?: string;
  page?: number;
  limit?: number;
  hospitalId?: string;
  specialty?: string;
}

/**
 * Response para listagem com paginação
 */
export interface PaginatedResponseDto<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Detalhes adicionais de erro
 */
export interface ErrorDetails {
  field?: string;
  constraint?: string;
  value?: string | number | boolean;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Response de erro
 */
export interface ErrorResponseDto {
  success: false;
  error: string;
  message: string;
  statusCode?: number;
  details?: ErrorDetails;
}
