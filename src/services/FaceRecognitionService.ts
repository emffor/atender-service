import { AppError } from '../errors/AppError';
import { rabbitMQRequestReply } from './RabbitMQRequestReplyService';
import type {
  FaceVerificationRequest,
  FaceVerificationResponse,
  FaceRegistrationRequest,
  FaceRegistrationResponse,
  FaceUpdateRequest,
  FaceUpdateResponse,
  FACE_QUEUES,
} from '../types/faceMessaging.types';

/**
 * Interface para o resultado da verificação facial
 */
export interface FaceVerificationResult {
  verified: boolean;
  confidence: number;
  message: string;
  requiredConfidence: number;
  distance?: number;
  metadata?: {
    detectionTime?: number;
    matchedFaceId?: string;
  };
}

/**
 * Configuração do serviço de reconhecimento facial
 */
interface FaceRecognitionConfig {
  requiredConfidence: number;
  requestTimeout: number; // Timeout para requests RabbitMQ
}

/**
 * Service adapter para integração com face-recognition-service via RabbitMQ
 * 
 * Usa padrão Request/Reply com correlation ID para comunicação assíncrona
 * mas com interface síncrona (async/await).
 */
export class FaceRecognitionService {
  private config: FaceRecognitionConfig;
  private queues: typeof FACE_QUEUES;

  constructor() {
    this.config = {
      requiredConfidence: parseFloat(process.env.FACE_REQUIRED_CONFIDENCE || '0.85'),
      requestTimeout: parseInt(process.env.FACE_REQUEST_TIMEOUT || '30000'),
    };

    // Importar constantes de queues
    const queues = require('../types/faceMessaging.types').FACE_QUEUES;
    this.queues = queues;
  }

  /**
   * Verifica se a foto enviada corresponde à foto registrada do usuário
   * 
   * @param userId - ID do usuário a ser verificado
   * @param photoBuffer - Buffer da imagem capturada
   * @returns Resultado da verificação facial
   * @throws Error se a verificação falhar ou serviço estiver indisponível
   */
  async verifyFace(
    userId: string,
    photoBuffer: Buffer
  ): Promise<FaceVerificationResult> {
    try {
      // Converter buffer para base64
      const imageBase64 = photoBuffer.toString('base64');
      const imageDataUri = `data:image/jpeg;base64,${imageBase64}`;

      // Criar request
      const request: Omit<FaceVerificationRequest, 'requestId' | 'timestamp' | 'replyTo'> = {
        messageType: 'face.verification.request',
        data: {
          userId,
          imageBase64: imageDataUri,
          requiredConfidence: this.config.requiredConfidence,
        },
      };

      // Enviar request via RabbitMQ e aguardar resposta
      const response = await rabbitMQRequestReply.sendRequest<
        FaceVerificationRequest,
        FaceVerificationResponse
      >(this.queues.VERIFICATION_REQUESTS, request, this.config.requestTimeout);

      // Processar resposta
      const result: FaceVerificationResult = {
        verified: response.data.verified,
        confidence: response.data.confidence,
        message: response.data.verified
          ? `Face verificada com sucesso (confiança: ${(response.data.confidence * 100).toFixed(1)}%)`
          : `Face não correspondente (confiança: ${(response.data.confidence * 100).toFixed(1)}%)`,
        requiredConfidence: response.data.requiredConfidence,
        distance: response.data.distance,
        metadata: response.data.metadata,
      };

      return result;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      // Erros genéricos
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new AppError(500, `Face verification failed: ${errorMessage}`);
    }
  }

  /**
   * Registra a primeira foto do usuário no sistema de reconhecimento facial
   * 
   * @param userId - ID do usuário
   * @param photoBuffer - Buffer da imagem a ser registrada
   */
  async registerFace(userId: string, photoBuffer: Buffer): Promise<void> {
    try {
      // Converter buffer para base64
      const imageBase64 = photoBuffer.toString('base64');
      const imageDataUri = `data:image/jpeg;base64,${imageBase64}`;

      // Criar request
      const request: Omit<FaceRegistrationRequest, 'requestId' | 'timestamp' | 'replyTo'> = {
        messageType: 'face.registration.request',
        data: {
          userId,
          imageBase64: imageDataUri,
        },
      };

      // Enviar request via RabbitMQ e aguardar resposta
      const response = await rabbitMQRequestReply.sendRequest<
        FaceRegistrationRequest,
        FaceRegistrationResponse
      >(this.queues.REGISTRATION_REQUESTS, request, this.config.requestTimeout);

      if (!response.success) {
        throw new AppError(500, response.error?.message || 'Face registration failed');
      }

      console.log(`✅ Face registrada: userId=${userId}, faceId=${response.data.faceId}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new AppError(500, `Face registration failed: ${errorMessage}`);
    }
  }

  /**
   * Atualiza a foto do usuário no sistema de reconhecimento facial
   * 
   * @param userId - ID do usuário
   * @param photoBuffer - Buffer da nova imagem
   */
  async updateFace(userId: string, photoBuffer: Buffer): Promise<void> {
    try {
      // Converter buffer para base64
      const imageBase64 = photoBuffer.toString('base64');
      const imageDataUri = `data:image/jpeg;base64,${imageBase64}`;

      // Criar request
      const request: Omit<FaceUpdateRequest, 'requestId' | 'timestamp' | 'replyTo'> = {
        messageType: 'face.update.request',
        data: {
          userId,
          imageBase64: imageDataUri,
        },
      };

      // Enviar request via RabbitMQ e aguardar resposta
      const response = await rabbitMQRequestReply.sendRequest<
        FaceUpdateRequest,
        FaceUpdateResponse
      >(this.queues.UPDATE_REQUESTS, request, this.config.requestTimeout);

      if (!response.success) {
        throw new AppError(500, response.error?.message || 'Face update failed');
      }

      console.log(`✅ Face atualizada: userId=${userId}, faceId=${response.data.faceId}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new AppError(500, `Face update failed: ${errorMessage}`);
    }
  }

  /**
   * Verifica se o serviço de reconhecimento facial está disponível
   * Verifica se o RabbitMQRequestReplyService está inicializado
   */
  async healthCheck(): Promise<boolean> {
    try {
      const stats = rabbitMQRequestReply.getStats();
      return stats.isInitialized;
    } catch {
      return false;
    }
  }

  /**
   * Retorna a configuração atual do serviço
   */
  getConfig(): Readonly<FaceRecognitionConfig> {
    return { ...this.config };
  }
}

