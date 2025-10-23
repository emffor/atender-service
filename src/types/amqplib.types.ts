import { Connection, Channel, ConsumeMessage, Options } from 'amqplib';

/**
 * Tipos do amqplib para uso em toda a aplicação
 */

export type AmqpConnection = Connection;
export type AmqpChannel = Channel;
export type AmqpMessage = ConsumeMessage;

export interface PublishOptions {
  persistent?: boolean;
  messageId?: string;
  timestamp?: number;
  contentType?: string;
}

export interface ConsumeOptions {
  noAck?: boolean;
  exclusive?: boolean;
  priority?: number;
  arguments?: Record<string, unknown>;
}

export interface QueueOptions extends Options.AssertQueue {
  durable?: boolean;
  exclusive?: boolean;
  autoDelete?: boolean;
  arguments?: Record<string, unknown>;
}

export interface ExchangeOptions extends Options.AssertExchange {
  durable?: boolean;
  internal?: boolean;
  autoDelete?: boolean;
  alternateExchange?: string;
  arguments?: Record<string, unknown>;
}

export type MessageHandler<T = unknown> = (message: T) => Promise<void>;

export interface RabbitMQMessage<T = unknown> {
  content: T;
  fields: {
    deliveryTag: number;
    redelivered: boolean;
    exchange: string;
    routingKey: string;
  };
  properties: {
    messageId?: string;
    timestamp?: number;
    contentType?: string;
    [key: string]: unknown;
  };
}
