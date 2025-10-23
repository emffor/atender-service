import { rabbitMQ } from '@/messaging/RabbitMQConnection';
import { AttendanceEvent, BaseEvent } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Event Publisher para eventos de Attendance
 * Publica eventos para outros microserviços
 */
export class AttendanceEventPublisher {
  private readonly exchange: string;

  constructor() {
    this.exchange = process.env.EXCHANGE_ATTENDANCE_EVENTS || 'attendance.events';
  }

  /**
   * Publicar evento genérico
   */
  private async publishEvent(event: AttendanceEvent): Promise<void> {
    try {
      const routingKey = event.eventType;
      
      await rabbitMQ.publish(
        this.exchange,
        routingKey,
        event,
        {
          persistent: true,
          messageId: event.id,
        }
      );

      console.log(`📤 Evento publicado: ${event.eventType} (${event.aggregateId})`);
    } catch (error) {
      console.error(`❌ Erro ao publicar evento ${event.eventType}:`, error);
      throw error;
    }
  }

  /**
   * Publicar evento de ponto registrado
   */
  async publishAttendanceRecorded(data: {
    attendanceId: string;
    shiftId: string;
    doctorId: string;
    type: 'IN' | 'OUT';
    timestamp: Date;
    latitude: number;
    longitude: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    isLate: boolean;
    lateMinutes: number;
    discountPercentage: number;
    photoS3Key?: string;
    reason?: string;
    correlationId?: string;
  }): Promise<void> {
    const event: AttendanceEvent = {
      id: uuidv4(),
      eventType: 'attendance.recorded',
      aggregateId: data.attendanceId,
      aggregateType: 'attendance',
      version: 1,
      timestamp: new Date().toISOString(),
      correlationId: data.correlationId,
      data: {
        id: data.attendanceId,
        shiftId: data.shiftId,
        doctorId: data.doctorId,
        type: data.type,
        timestamp: data.timestamp.toISOString(),
        latitude: data.latitude,
        longitude: data.longitude,
        status: data.status,
        isLate: data.isLate,
        lateMinutes: data.lateMinutes,
        discountPercentage: data.discountPercentage,
        photoS3Key: data.photoS3Key,
        reason: data.reason,
        createdAt: new Date().toISOString(),
      },
    };

    await this.publishEvent(event);
  }

  /**
   * Publicar evento de ponto aprovado
   */
  async publishAttendanceApproved(data: {
    attendanceId: string;
    shiftId: string;
    doctorId: string;
    hospitalId: string;
    approvedWithDiscount: boolean;
    discountPercentage: number;
    finalShiftValue?: number;
    reason?: string;
    correlationId?: string;
  }): Promise<void> {
    const event: AttendanceEvent = {
      id: uuidv4(),
      eventType: 'attendance.approved',
      aggregateId: data.attendanceId,
      aggregateType: 'attendance',
      version: 1,
      timestamp: new Date().toISOString(),
      correlationId: data.correlationId,
      data: {
        id: data.attendanceId,
        shiftId: data.shiftId,
        doctorId: data.doctorId,
        hospitalId: data.hospitalId,
        approvedWithDiscount: data.approvedWithDiscount,
        discountPercentage: data.discountPercentage,
        finalShiftValue: data.finalShiftValue,
        approvedAt: new Date().toISOString(),
        reason: data.reason,
      },
    };

    await this.publishEvent(event);
  }

  /**
   * Publicar evento de ponto rejeitado
   */
  async publishAttendanceRejected(data: {
    attendanceId: string;
    shiftId: string;
    doctorId: string;
    hospitalId: string;
    reason?: string;
    correlationId?: string;
  }): Promise<void> {
    const event: AttendanceEvent = {
      id: uuidv4(),
      eventType: 'attendance.rejected',
      aggregateId: data.attendanceId,
      aggregateType: 'attendance',
      version: 1,
      timestamp: new Date().toISOString(),
      correlationId: data.correlationId,
      data: {
        id: data.attendanceId,
        shiftId: data.shiftId,
        doctorId: data.doctorId,
        hospitalId: data.hospitalId,
        rejectedAt: new Date().toISOString(),
        reason: data.reason,
      },
    };

    await this.publishEvent(event);
  }
}

export const attendanceEventPublisher = new AttendanceEventPublisher();