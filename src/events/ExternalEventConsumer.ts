import { rabbitMQ } from '@/messaging/RabbitMQConnection';
import { ShiftEvent, UserEvent } from './types';
import { ShiftCacheService } from '@/services/cache/ShiftCacheService';
import { UserCacheService } from '@/services/cache/UserCacheService';

/**
 * Event Consumer para eventos de Shift e User
 * Recebe eventos de outros microserviços e atualiza cache local
 */
export class ExternalEventConsumer {
  private shiftCacheService: ShiftCacheService;
  private userCacheService: UserCacheService;

  constructor() {
    this.shiftCacheService = new ShiftCacheService();
    this.userCacheService = new UserCacheService();
  }

  /**
   * Iniciar consumo de todos os eventos externos
   */
  async startConsuming(): Promise<void> {
    await this.consumeShiftEvents();
    await this.consumeUserEvents();
  }

  /**
   * Consumir eventos de Shift
   */
  private async consumeShiftEvents(): Promise<void> {
    const queueName = process.env.QUEUE_SHIFT_SYNC || 'attendance.shift.sync';

    await rabbitMQ.consume(
      queueName,
      async (message: ShiftEvent) => {
        try {
          await this.handleShiftEvent(message);
        } catch (error) {
          console.error('❌ Erro ao processar evento de shift:', error);
          throw error;
        }
      }
    );

    console.log(`👂 Consumindo eventos de shift na queue: ${queueName}`);
  }

  /**
   * Consumir eventos de User
   */
  private async consumeUserEvents(): Promise<void> {
    const queueName = process.env.QUEUE_USER_SYNC || 'attendance.user.sync';

    await rabbitMQ.consume(
      queueName,
      async (message: UserEvent) => {
        try {
          await this.handleUserEvent(message);
        } catch (error) {
          console.error('❌ Erro ao processar evento de user:', error);
          throw error;
        }
      }
    );

    console.log(`👂 Consumindo eventos de user na queue: ${queueName}`);
  }

  /**
   * Processar eventos de Shift
   */
  private async handleShiftEvent(event: ShiftEvent): Promise<void> {
    console.log(`📥 Processando evento: ${event.eventType} (${event.aggregateId})`);

    switch (event.eventType) {
      case 'shift.created':
        await this.shiftCacheService.cacheShift({
          id: event.data.id,
          hospitalId: event.data.hospitalId,
          doctorId: event.data.doctorId,
          value: event.data.value,
          finalValue: event.data.finalValue,
          specialty: event.data.specialty,
          startTime: new Date(event.data.startTime),
          endTime: new Date(event.data.endTime),
          status: event.data.status,
          healthUnitId: event.data.healthUnitId,
          approvalStatus: event.data.approvalStatus,
          createdAt: new Date(event.data.createdAt),
        });
        break;

      case 'shift.updated':
        await this.shiftCacheService.updateShiftCache(
          event.data.id,
          {
            doctorId: event.data.changes.doctorId,
            value: event.data.changes.value,
            finalValue: event.data.changes.finalValue,
            status: event.data.changes.status,
            approvalStatus: event.data.changes.approvalStatus,
            approvedAt: event.data.changes.approvedAt ? new Date(event.data.changes.approvedAt) : undefined,
            approvedBy: event.data.changes.approvedBy,
          }
        );
        break;

      case 'shift.deleted':
        await this.shiftCacheService.removeShiftFromCache(event.data.id);
        break;

      default:
        const unknownShiftEvent = event as {eventType?: string};
        console.warn(`⚠️ Tipo de evento shift não reconhecido: ${unknownShiftEvent.eventType || 'undefined'}`);
    }
  }

  /**
   * Processar eventos de User
   */
  private async handleUserEvent(event: UserEvent): Promise<void> {
    console.log(`📥 Processando evento: ${event.eventType} (${event.aggregateId})`);

    switch (event.eventType) {
      case 'user.created':
        await this.userCacheService.cacheUser({
          id: event.data.id,
          username: event.data.username,
          email: event.data.email,
          cpfCnpj: event.data.cpfCnpj,
          employeeIdentifier: event.data.employeeIdentifier,
          role: event.data.role,
          use2FA: event.data.use2FA,
          createdAt: new Date(event.data.createdAt),
        });
        break;

      case 'user.updated':
        // Validar role se presente
        const roleUpdate = event.data.changes.role as 
          'client_hospital_worker' | 'client_hospital' | 'client_medic' | 
          'collaborator' | 'admin_master' | 'admin_mini' | 'admin_read' | undefined;
        
        await this.userCacheService.updateUserCache(
          event.data.id,
          {
            username: event.data.changes.username,
            email: event.data.changes.email,
            employeeIdentifier: event.data.changes.employeeIdentifier,
            role: roleUpdate,
            use2FA: event.data.changes.use2FA,
          }
        );
        break;

      case 'user.deleted':
        await this.userCacheService.removeUserFromCache(event.data.id);
        break;

      default:
        const unknownEvent = event as {eventType?: string};
        console.warn(`⚠️ Tipo de evento user não reconhecido: ${unknownEvent.eventType || 'undefined'}`);
    }
  }
}

export const externalEventConsumer = new ExternalEventConsumer();