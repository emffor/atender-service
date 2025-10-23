import { AttendanceEventPublisher } from '../events/AttendanceEventPublisher';

/**
 * Tipos de notificação
 */
export enum NotificationType {
  ATTENDANCE_REGISTERED = 'ATTENDANCE_REGISTERED',
  ATTENDANCE_APPROVED = 'ATTENDANCE_APPROVED',
  ATTENDANCE_REJECTED = 'ATTENDANCE_REJECTED',
  ATTENDANCE_LATE = 'ATTENDANCE_LATE',
  FACE_VERIFICATION_FAILED = 'FACE_VERIFICATION_FAILED',
  SHIFT_REMINDER = 'SHIFT_REMINDER',
  PAYMENT_PROCESSED = 'PAYMENT_PROCESSED',
}

/**
 * Interface para dados da notificação
 */
export interface NotificationData {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  metadata?: Record<string, string | number | boolean>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  actionUrl?: string;
  expiresAt?: Date;
}

/**
 * Interface para notificação push
 */
export interface PushNotificationData {
  title: string;
  body: string;
  data?: Record<string, string | number | boolean>;
  badge?: number;
  sound?: string;
  icon?: string;
}

/**
 * Service para gerenciamento de notificações
 * 
 * Publica eventos de notificação no RabbitMQ para que o serviço
 * de notificações processe e envie via push, email, SMS, etc.
 */
export class NotificationService {
  private eventPublisher: AttendanceEventPublisher;

  constructor(eventPublisher?: AttendanceEventPublisher) {
    this.eventPublisher = eventPublisher || new AttendanceEventPublisher();
  }

  /**
   * Envia uma notificação (alias para createNotification)
   */
  async sendNotification(data: NotificationData): Promise<void> {
    return this.createNotification(data);
  }

  /**
   * Cria uma notificação genérica
   */
  async createNotification(data: NotificationData): Promise<void> {
    try {
      // Publica evento genérico no RabbitMQ
      // O serviço de notificações irá consumir e enviar para o usuário
      console.log(`[NotificationService] Notification created for user ${data.userId}: ${data.title}`);
      // TODO: Implementar publicação de evento quando exchange de notificações estiver pronto
    } catch (error) {
      console.error('[NotificationService] Failed to create notification:', error);
      // Não lançar erro para não bloquear o fluxo principal
    }
  }

  /**
   * Envia notificação de registro de ponto
   */
  async notifyAttendanceRegistered(
    userId: string,
    type: 'IN' | 'OUT',
    shiftId: string,
    attendanceId: string,
    timestamp: Date
  ): Promise<void> {
    const title = type === 'IN' ? '✅ Ponto Registrado (Entrada)' : '✅ Ponto Registrado (Saída)';
    const message = type === 'IN' 
      ? `Sua entrada foi registrada às ${timestamp.toLocaleTimeString('pt-BR')}`
      : `Sua saída foi registrada às ${timestamp.toLocaleTimeString('pt-BR')}`;

    await this.createNotification({
      userId,
      title,
      message,
      type: NotificationType.ATTENDANCE_REGISTERED,
      priority: 'normal',
      metadata: {
        attendanceId,
        shiftId,
        punchType: type,
        timestamp: timestamp.toISOString(),
      },
      actionUrl: `/attendances/${attendanceId}`,
    });
  }

  /**
   * Envia notificação de aprovação de ponto
   */
  async notifyAttendanceApproved(
    userId: string,
    attendanceId: string,
    shiftId: string,
    approvedBy: string,
    hasDiscount: boolean,
    discountPercentage?: number
  ): Promise<void> {
    const discountInfo = hasDiscount && discountPercentage 
      ? ` com desconto de ${discountPercentage}%`
      : '';

    await this.createNotification({
      userId,
      title: '✅ Ponto Aprovado',
      message: `Seu ponto foi aprovado${discountInfo}`,
      type: NotificationType.ATTENDANCE_APPROVED,
      priority: 'high',
      metadata: {
        attendanceId,
        shiftId,
        approvedBy,
        hasDiscount,
        discountPercentage: discountPercentage || 0,
        approvedAt: new Date().toISOString(),
      },
      actionUrl: `/attendances/${attendanceId}`,
    });
  }

  /**
   * Envia notificação de rejeição de ponto
   */
  async notifyAttendanceRejected(
    userId: string,
    attendanceId: string,
    shiftId: string,
    rejectedBy: string,
    reason: string
  ): Promise<void> {
    await this.createNotification({
      userId,
      title: '❌ Ponto Rejeitado',
      message: `Seu ponto foi rejeitado. Motivo: ${reason}`,
      type: NotificationType.ATTENDANCE_REJECTED,
      priority: 'urgent',
      metadata: {
        attendanceId,
        shiftId,
        rejectedBy,
        reason,
        rejectedAt: new Date().toISOString(),
      },
      actionUrl: `/attendances/${attendanceId}`,
    });
  }

  /**
   * Envia notificação de atraso
   */
  async notifyAttendanceLate(
    userId: string,
    attendanceId: string,
    shiftId: string,
    type: 'IN' | 'OUT',
    lateMinutes: number
  ): Promise<void> {
    const punchType = type === 'IN' ? 'entrada' : 'saída';
    
    await this.createNotification({
      userId,
      title: '⚠️ Atraso Registrado',
      message: `Você registrou ${punchType} com ${lateMinutes} minutos de atraso`,
      type: NotificationType.ATTENDANCE_LATE,
      priority: 'high',
      metadata: {
        attendanceId,
        shiftId,
        punchType: type,
        lateMinutes,
        timestamp: new Date().toISOString(),
      },
      actionUrl: `/attendances/${attendanceId}`,
    });
  }

  /**
   * Envia notificação de falha na verificação facial
   */
  async notifyFaceVerificationFailed(
    userId: string,
    attendanceId: string,
    confidence: number,
    requiredConfidence: number
  ): Promise<void> {
    await this.createNotification({
      userId,
      title: '🔒 Verificação Facial Falhou',
      message: `A verificação facial não atingiu o nível de confiança necessário (${(confidence * 100).toFixed(1)}% de ${(requiredConfidence * 100)}%)`,
      type: NotificationType.FACE_VERIFICATION_FAILED,
      priority: 'urgent',
      metadata: {
        attendanceId,
        confidence,
        requiredConfidence,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Envia notificação push (via FCM, APNS, etc)
   */
  async sendPushNotification(
    userId: string,
    data: PushNotificationData
  ): Promise<void> {
    try {
      console.log(`[NotificationService] Push notification sent to user ${userId}`);
      // TODO: Implementar publicação de evento quando exchange de notificações estiver pronto
    } catch (error) {
      console.error('[NotificationService] Failed to send push notification:', error);
    }
  }

  /**
   * Envia notificações para múltiplos usuários
   */
  async notifyMultiple(
    userIds: string[],
    title: string,
    message: string,
    type: NotificationType,
    metadata?: Record<string, string | number | boolean>
  ): Promise<void> {
    const promises = userIds.map(userId =>
      this.createNotification({
        userId,
        title,
        message,
        type,
        priority: 'normal',
        metadata,
      })
    );

    await Promise.allSettled(promises);
  }

  /**
   * Envia lembrete de plantão
   */
  async notifyShiftReminder(
    userId: string,
    shiftId: string,
    shiftStartTime: Date,
    hoursBeforeStart: number
  ): Promise<void> {
    await this.createNotification({
      userId,
      title: '🏥 Lembrete de Plantão',
      message: `Seu plantão começará em ${hoursBeforeStart} hora(s) às ${shiftStartTime.toLocaleTimeString('pt-BR')}`,
      type: NotificationType.SHIFT_REMINDER,
      priority: 'normal',
      metadata: {
        shiftId,
        shiftStartTime: shiftStartTime.toISOString(),
        hoursBeforeStart,
      },
      actionUrl: `/shifts/${shiftId}`,
      expiresAt: shiftStartTime,
    });
  }
}
