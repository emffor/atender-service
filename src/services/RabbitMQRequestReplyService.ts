import { v4 as uuidv4 } from 'uuid';
import { rabbitMQ } from '../messaging/RabbitMQConnection';
import type { BaseRequest, BaseResponse } from '../types/faceMessaging.types';
import { AppError } from '../errors/AppError';

/**
 * Callbacks pendentes aguardando resposta
 */
interface PendingRequest {
  resolve: (response: BaseResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  requestId: string;
  requestedAt: number;
}

/**
 * RabbitMQRequestReplyService
 * 
 * Implementa padrão Request/Reply usando RabbitMQ com:
 * - Correlation ID para correlacionar requests e responses
 * - Reply-to queue exclusiva para receber respostas
 * - Timeout automático para requests sem resposta
 * - Promise-based API (async/await)
 */
export class RabbitMQRequestReplyService {
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private replyQueue: string;
  private isInitialized: boolean = false;

  constructor(replyQueue: string = 'face.replies') {
    this.replyQueue = replyQueue;
  }

  /**
   * Inicializar serviço: criar reply queue e começar a consumir
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ RabbitMQRequestReplyService já inicializado');
      return;
    }

    try {
      // Criar reply queue (exclusive: apenas essa conexão pode consumir)
      await rabbitMQ.assertQueue(this.replyQueue, {
        exclusive: false, // False para permitir reconexão
        durable: false, // Temporary queue
        autoDelete: true, // Deletar quando não houver consumidores
      });

      // Começar a consumir respostas
      await rabbitMQ.consume(
        this.replyQueue,
        async (message: Record<string, unknown>) => {
          await this.handleResponse(message as unknown as BaseResponse);
        },
        { noAck: true } // Auto-ack (respostas são idempotentes)
      );

      this.isInitialized = true;
      console.log(`✅ RabbitMQRequestReplyService inicializado (reply queue: ${this.replyQueue})`);
    } catch (error) {
      console.error('❌ Erro ao inicializar RabbitMQRequestReplyService:', error);
      throw error;
    }
  }

  /**
   * Enviar request e aguardar response (Promise-based)
   * 
   * @param queue - Queue de destino (ex: 'face.verification.requests')
   * @param request - Request com dados
   * @param timeout - Timeout em ms (default: 30000)
   * @returns Promise com a resposta
   */
  async sendRequest<TRequest extends BaseRequest, TResponse extends BaseResponse>(
    queue: string,
    request: Omit<TRequest, 'requestId' | 'timestamp' | 'replyTo'>,
    timeout: number = 30000
  ): Promise<TResponse> {
    if (!this.isInitialized) {
      throw new AppError(500, 'RabbitMQRequestReplyService não inicializado');
    }

    // Gerar correlation ID único
    const requestId = uuidv4();
    const timestamp = new Date().toISOString();

    // Criar request completa
    const fullRequest: TRequest = {
      ...request,
      requestId,
      timestamp,
      replyTo: this.replyQueue,
      timeout,
    } as TRequest;

    // Criar Promise que será resolvida quando a resposta chegar
    const responsePromise = new Promise<TResponse>((resolve, reject) => {
      // Timeout: rejeitar se não receber resposta no prazo
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(
          new AppError(
            504,
            `Request timeout after ${timeout}ms (requestId: ${requestId})`
          )
        );
      }, timeout);

      // Armazenar callback para quando resposta chegar
      this.pendingRequests.set(requestId, {
        resolve: resolve as (response: BaseResponse) => void,
        reject,
        timeout: timeoutHandle,
        requestId,
        requestedAt: Date.now(),
      });
    });

    // Publicar request na queue
    try {
      await rabbitMQ.publish('', queue, fullRequest);
      console.log(`📤 Request enviada: ${queue} (requestId: ${requestId})`);
    } catch (error) {
      // Limpar pending request se falhar ao enviar
      const pending = this.pendingRequests.get(requestId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(requestId);
      }
      throw new AppError(503, `Falha ao enviar request para ${queue}: ${error}`);
    }

    return responsePromise;
  }

  /**
   * Handler para processar respostas recebidas
   */
  private async handleResponse(response: BaseResponse): Promise<void> {
    const { requestId, success, error } = response;

    console.log(`📥 Response recebida (requestId: ${requestId}, success: ${success})`);

    const pending = this.pendingRequests.get(requestId);

    if (!pending) {
      console.warn(`⚠️ Resposta recebida para requestId desconhecido: ${requestId}`);
      return;
    }

    // Limpar timeout
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(requestId);

    // Calcular tempo de resposta
    const responseTime = Date.now() - pending.requestedAt;
    console.log(`⏱️ Response time: ${responseTime}ms (requestId: ${requestId})`);

    // Resolver ou rejeitar promise
    if (success) {
      pending.resolve(response);
    } else {
      const errorMessage = error?.message || 'Face recognition service error';
      const errorCode = error?.code || '500';
      pending.reject(
        new AppError(
          parseInt(errorCode, 10) || 500,
          errorMessage
        )
      );
    }
  }

  /**
   * Cleanup: cancelar todos os requests pendentes
   */
  async cleanup(): Promise<void> {
    console.log(`🧹 Limpando ${this.pendingRequests.size} requests pendentes...`);

    for (const [requestId, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new AppError(503, 'Service shutting down'));
      this.pendingRequests.delete(requestId);
    }

    this.isInitialized = false;
    console.log('✅ RabbitMQRequestReplyService cleanup concluído');
  }

  /**
   * Retorna estatísticas do serviço
   */
  getStats(): {
    pendingRequests: number;
    isInitialized: boolean;
    replyQueue: string;
  } {
    return {
      pendingRequests: this.pendingRequests.size,
      isInitialized: this.isInitialized,
      replyQueue: this.replyQueue,
    };
  }
}

// Singleton instance
export const rabbitMQRequestReply = new RabbitMQRequestReplyService();
