/**
 * Base Event Interface
 */
export interface BaseEvent {
  id: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  timestamp: string;
  causationId?: string;
  correlationId?: string;
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Shift Events
 */
export interface ShiftCreatedEvent extends BaseEvent {
  eventType: 'shift.created';
  aggregateType: 'shift';
  data: {
    id: string;
    hospitalId: string;
    doctorId?: string;
    value: number;
    finalValue?: number;
    specialty: string;
    startTime: string;
    endTime: string;
    status: 'open' | 'closed';
    healthUnitId?: string;
    approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
  };
}

export interface ShiftUpdatedEvent extends BaseEvent {
  eventType: 'shift.updated';
  aggregateType: 'shift';
  data: {
    id: string;
    changes: Partial<{
      doctorId: string;
      value: number;
      finalValue: number;
      status: 'open' | 'closed';
      approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
      approvedAt: string;
      approvedBy: string;
    }>;
    updatedAt: string;
  };
}

export interface ShiftDeletedEvent extends BaseEvent {
  eventType: 'shift.deleted';
  aggregateType: 'shift';
  data: {
    id: string;
    deletedAt: string;
    reason?: string;
  };
}

/**
 * User Events
 */
export interface UserCreatedEvent extends BaseEvent {
  eventType: 'user.created';
  aggregateType: 'user';
  data: {
    id: string;
    username: string;
    email: string;
    cpfCnpj: string;
    employeeIdentifier?: string;
    role: 'client_hospital_worker' | 'client_hospital' | 'client_medic' | 'collaborator' | 'admin_master' | 'admin_mini' | 'admin_read';
    use2FA: boolean;
    createdAt: string;
  };
}

export interface UserUpdatedEvent extends BaseEvent {
  eventType: 'user.updated';
  aggregateType: 'user';
  data: {
    id: string;
    changes: Partial<{
      username: string;
      email: string;
      employeeIdentifier: string;
      role: string;
      use2FA: boolean;
    }>;
    updatedAt: string;
  };
}

export interface UserDeletedEvent extends BaseEvent {
  eventType: 'user.deleted';
  aggregateType: 'user';
  data: {
    id: string;
    deletedAt: string;
    reason?: string;
  };
}

/**
 * Attendance Events (que este serviço publica)
 */
export interface AttendanceRecordedEvent extends BaseEvent {
  eventType: 'attendance.recorded';
  aggregateType: 'attendance';
  data: {
    id: string;
    shiftId: string;
    doctorId: string;
    type: 'IN' | 'OUT';
    timestamp: string;
    latitude: number;
    longitude: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    isLate: boolean;
    lateMinutes: number;
    discountPercentage: number;
    photoS3Key?: string;
    reason?: string;
    createdAt: string;
  };
}

export interface AttendanceApprovedEvent extends BaseEvent {
  eventType: 'attendance.approved';
  aggregateType: 'attendance';
  data: {
    id: string;
    shiftId: string;
    doctorId: string;
    hospitalId: string;
    approvedWithDiscount: boolean;
    discountPercentage: number;
    finalShiftValue?: number;
    approvedAt: string;
    reason?: string;
  };
}

export interface AttendanceRejectedEvent extends BaseEvent {
  eventType: 'attendance.rejected';
  aggregateType: 'attendance';
  data: {
    id: string;
    shiftId: string;
    doctorId: string;
    hospitalId: string;
    rejectedAt: string;
    reason?: string;
  };
}

/**
 * Union types
 */
export type ShiftEvent = ShiftCreatedEvent | ShiftUpdatedEvent | ShiftDeletedEvent;
export type UserEvent = UserCreatedEvent | UserUpdatedEvent | UserDeletedEvent;
export type AttendanceEvent = AttendanceRecordedEvent | AttendanceApprovedEvent | AttendanceRejectedEvent;

export type DomainEvent = ShiftEvent | UserEvent | AttendanceEvent;