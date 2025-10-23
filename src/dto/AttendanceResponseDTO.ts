import { AttendanceStatus, AttendanceType } from '../entities/Attendance';

/**
 * DTO para resposta de attendance
 */
export class AttendanceResponseDTO {
  id!: string;
  type!: AttendanceType;
  timestamp!: Date;
  latitude!: number;
  longitude!: number;
  reason?: string; // Motivo fornecido pelo USUÁRIO (médico)
  statusReason?: string; // Motivo gerado pelo SISTEMA (automático)
  status!: AttendanceStatus;
  photoS3Key?: string;
  photoSignedUrl?: string | null;
  createdAt!: Date;
  updatedAt!: Date;

  // Informações de atraso e desconto
  isLate!: boolean;
  lateMinutes!: number;
  hasAutomaticDiscount!: boolean;
  discountPercentage!: number;
  approvedWithDiscount!: boolean;

  // Relações
  doctor?: {
    id: string;
    username: string;
    email: string | null;
    cpfCnpj?: string | null;
    employeeIdentifier?: string | null;
    role: string;
  };

  shift?: {
    id: string;
    value: number;
    specialty: string;
    startTime: Date;
    endTime: Date;
    status: string;
    createdAt: Date;
    hospital?: {
      id: string;
      username: string;
      email: string | null;
      role: string;
    };
    doctor?: {
      id: string;
      username: string;
      email: string | null;
      role: string;
    };
  };

  // Informações de verificação facial
  faceVerification?: {
    verified: boolean;
    confidence: number;
    message: string;
  };

  // Debug info (opcional)
  debug?: {
    cacheHits?: string[];
    cacheMisses?: string[];
    validationSteps?: Array<{
      step: string;
      result: boolean;
      message?: string;
    }>;
    geolocation?: {
      distance?: number;
      inPolygon?: boolean;
    };
    [key: string]: unknown;
  };
}