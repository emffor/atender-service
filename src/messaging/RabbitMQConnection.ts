import * as amqp from 'amqplib';
import { MessageHandler } from '../types/amqplib.types';

/**
 * RabbitMQ Connection Manager
 * Gerencia conexão, canais e configuração de exchanges/queues
 */
export class RabbitMQConnection {
  private connectionModel?: amqp.ChannelModel;
  private channel?: amqp.Channel;
  private readonly url: string;

  constructor() {
    this.url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  }

  /**
   * Conectar ao RabbitMQ
   */
  async connect(): Promise<void> {
    try {
      console.log('🔄 Conectando ao RabbitMQ...');
      this.connectionModel = await amqp.connect(this.url);
      this.channel = await this.connectionModel.createChannel();

      // Event listeners para conexão
      this.connectionModel.on('error', (err: Error) => {
        console.error('❌ Erro na conexão RabbitMQ:', err);
      });

      this.connectionModel.on('close', () => {
        console.log('📴 Conexão RabbitMQ fechada');
      });

      console.log('✅ Conectado ao RabbitMQ com sucesso');
      await this.setupExchangesAndQueues();
    } catch (error) {
      console.error('❌ Erro ao conectar RabbitMQ:', error);
      throw error;
    }
  }

  /**
   * Configurar exchanges e queues
   */
  private async setupExchangesAndQueues(): Promise<void> {
    if (!this.channel) {
      throw new Error('Canal RabbitMQ não inicializado');
    }

    // Exchanges
    const exchanges = [
      process.env.EXCHANGE_ATTENDANCE_EVENTS || 'attendance.events',
      process.env.EXCHANGE_SHIFT_EVENTS || 'shift.events',
      process.env.EXCHANGE_USER_EVENTS || 'user.events',
    ];

    for (const exchange of exchanges) {
      await this.channel.assertExchange(exchange, 'topic', { 
        durable: true 
      });
      console.log(`✅ Exchange ${exchange} configurado`);
    }

    // Queues
    const queues = [
      process.env.QUEUE_ATTENDANCE_COMMANDS || 'attendance.commands',
      process.env.QUEUE_SHIFT_SYNC || 'attendance.shift.sync',
      process.env.QUEUE_USER_SYNC || 'attendance.user.sync',
    ];

    for (const queue of queues) {
      await this.channel.assertQueue(queue, { 
        durable: true,
        arguments: {
          'x-message-ttl': 3600000, // 1 hora TTL
          'x-max-retries': 3,
        }
      });
      console.log(`✅ Queue ${queue} configurada`);
    }

    // Bindings
    await this.setupBindings();
  }

  /**
   * Configurar bindings entre exchanges e queues
   */
  private async setupBindings(): Promise<void> {
    if (!this.channel) return;

    const shiftExchange = process.env.EXCHANGE_SHIFT_EVENTS || 'shift.events';
    const userExchange = process.env.EXCHANGE_USER_EVENTS || 'user.events';
    const shiftQueue = process.env.QUEUE_SHIFT_SYNC || 'attendance.shift.sync';
    const userQueue = process.env.QUEUE_USER_SYNC || 'attendance.user.sync';

    // Shift events -> Attendance sync
    await this.channel.bindQueue(shiftQueue, shiftExchange, 'shift.created');
    await this.channel.bindQueue(shiftQueue, shiftExchange, 'shift.updated');
    await this.channel.bindQueue(shiftQueue, shiftExchange, 'shift.deleted');

    // User events -> Attendance sync
    await this.channel.bindQueue(userQueue, userExchange, 'user.created');
    await this.channel.bindQueue(userQueue, userExchange, 'user.updated');
    await this.channel.bindQueue(userQueue, userExchange, 'user.deleted');

    console.log('✅ Bindings configurados');
  }

  /**
   * Obter canal
   */
  getChannel(): amqp.Channel {
    if (!this.channel) {
      throw new Error('Canal RabbitMQ não inicializado');
    }
    return this.channel;
  }

  /**
   * Publicar mensagem
   */
  async publish(
    exchange: string, 
    routingKey: string, 
    message: object,
    options: { persistent?: boolean; messageId?: string } = {}
  ): Promise<boolean> {
    if (!this.channel) {
      throw new Error('Canal RabbitMQ não inicializado');
    }

    const messageBuffer = Buffer.from(JSON.stringify(message));
    
    return this.channel.publish(
      exchange, 
      routingKey, 
      messageBuffer, 
      {
        persistent: options.persistent ?? true,
        messageId: options.messageId || Date.now().toString(),
        timestamp: Date.now(),
        contentType: 'application/json',
      }
    );
  }

  /**
   * Criar/verificar queue (expõe assertQueue)
   */
  async assertQueue(
    queue: string,
    options?: amqp.Options.AssertQueue
  ): Promise<amqp.Replies.AssertQueue> {
    if (!this.channel) {
      throw new Error('Canal RabbitMQ não inicializado');
    }
    return await this.channel.assertQueue(queue, options);
  }

  /**
   * Consumir mensagens
   */
  async consume<T = unknown>(
    queue: string,
    onMessage: MessageHandler<T>,
    options: { noAck?: boolean } = {}
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('Canal RabbitMQ não inicializado');
    }

    await this.channel.consume(
      queue,
      async (msg: amqp.ConsumeMessage | null) => {
        if (!msg) return;

        try {
          const content = JSON.parse(msg.content.toString()) as T;
          await onMessage(content);
          
          if (!options.noAck) {
            this.channel!.ack(msg);
          }
        } catch (error) {
          console.error(`❌ Erro ao processar mensagem da queue ${queue}:`, error);
          
          // Rejeitar mensagem e enviar para DLQ se disponível
          this.channel!.nack(msg, false, false);
        }
      },
      { noAck: options.noAck ?? false }
    );

    console.log(`👂 Consumindo mensagens da queue: ${queue}`);
  }

  /**
   * Fechar conexão
   */
  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connectionModel) {
        await this.connectionModel.close();
      }
      console.log('✅ Conexão RabbitMQ fechada');
    } catch (error) {
      console.error('❌ Erro ao fechar conexão RabbitMQ:', error);
    }
  }

  /**
   * Verificar se está conectado
   */
  isConnected(): boolean {
    return !!(this.connectionModel && this.channel);
  }
}

// Instância singleton
export const rabbitMQ = new RabbitMQConnection();