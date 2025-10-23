/**
 * Tipos para comunicação via RabbitMQ entre services
 * Padrão Request/Reply com Correlation ID
 */

// ============================================================================
// BASE REQUEST/REPLY TYPES
// ============================================================================

export interface BaseRequest {
  requestId: string; // Correlation ID
  timestamp: string;
  replyTo?: string; // Queue para resposta
  timeout?: number; // Timeout em ms
}

export interface BaseResponse {
  requestId: string; // Mesmo correlation ID da request
  timestamp: string;
  success: boolean;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ============================================================================
// FACE VERIFICATION MESSAGES
// ============================================================================

export interface FaceVerificationRequest extends BaseRequest {
  messageType: 'face.verification.request';
  data: {
    userId: string;
    imageBase64: string; // Imagem em base64
    requiredConfidence?: number; // Opcional: override de confiança mínima
  };
}

export interface FaceVerificationResponse extends BaseResponse {
  messageType: 'face.verification.response';
  data: {
    verified: boolean;
    confidence: number;
    userId: string;
    distance?: number;
    requiredConfidence: number;
    metadata?: {
      detectionTime?: number; // Tempo de processamento (ms)
      matchedFaceId?: string;
    };
  };
}

// ============================================================================
// FACE REGISTRATION MESSAGES
// ============================================================================

export interface FaceRegistrationRequest extends BaseRequest {
  messageType: 'face.registration.request';
  data: {
    userId: string;
    imageBase64: string;
    photoUrl?: string;
    photoS3Key?: string;
  };
}

export interface FaceRegistrationResponse extends BaseResponse {
  messageType: 'face.registration.response';
  data: {
    faceId: string;
    userId: string;
    detectionConfidence: number;
    descriptorLength: number;
  };
}

// ============================================================================
// FACE UPDATE MESSAGES
// ============================================================================

export interface FaceUpdateRequest extends BaseRequest {
  messageType: 'face.update.request';
  data: {
    userId: string;
    imageBase64: string;
    photoUrl?: string;
    photoS3Key?: string;
  };
}

export interface FaceUpdateResponse extends BaseResponse {
  messageType: 'face.update.response';
  data: {
    faceId: string;
    userId: string;
    detectionConfidence: number;
    updated: boolean;
  };
}

// ============================================================================
// FACE RECOGNITION MESSAGES (Buscar em todas as faces)
// ============================================================================

export interface FaceRecognitionRequest extends BaseRequest {
  messageType: 'face.recognition.request';
  data: {
    imageBase64: string;
    maxDistance?: number; // Distância máxima para match
  };
}

export interface FaceRecognitionResponse extends BaseResponse {
  messageType: 'face.recognition.response';
  data: {
    matched: boolean;
    userId?: string;
    confidence?: number;
    distance?: number;
    faceId?: string;
  };
}

// ============================================================================
// FACE DELETION MESSAGES
// ============================================================================

export interface FaceDeleteRequest extends BaseRequest {
  messageType: 'face.delete.request';
  data: {
    userId: string;
  };
}

export interface FaceDeleteResponse extends BaseResponse {
  messageType: 'face.delete.response';
  data: {
    userId: string;
    deleted: boolean;
  };
}

// ============================================================================
// UNION TYPES
// ============================================================================

export type FaceRequest =
  | FaceVerificationRequest
  | FaceRegistrationRequest
  | FaceUpdateRequest
  | FaceRecognitionRequest
  | FaceDeleteRequest;

export type FaceResponse =
  | FaceVerificationResponse
  | FaceRegistrationResponse
  | FaceUpdateResponse
  | FaceRecognitionResponse
  | FaceDeleteResponse;

export type FaceMessage = FaceRequest | FaceResponse;

// ============================================================================
// QUEUE NAMES (Convenção)
// ============================================================================

export const FACE_QUEUES = {
  // Request queues (consumidas pelo face-recognition-service)
  VERIFICATION_REQUESTS: 'face.verification.requests',
  REGISTRATION_REQUESTS: 'face.registration.requests',
  UPDATE_REQUESTS: 'face.update.requests',
  RECOGNITION_REQUESTS: 'face.recognition.requests',
  DELETE_REQUESTS: 'face.delete.requests',

  // Reply queue (consumida pelo attendance-service - exclusive queue)
  REPLIES: 'face.replies',

  // Event queues (eventos assíncronos)
  USER_SYNC: 'face.user.sync',
} as const;

// ============================================================================
// HELPER TYPES
// ============================================================================

export type MessageType = FaceMessage['messageType'];

export interface RabbitMQRequestOptions {
  timeout?: number; // Default: 30000ms
  correlationId?: string; // Auto-gerado se não fornecido
  priority?: number; // 0-10
}
