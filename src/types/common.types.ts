/**
 * Tipos de status compartilhados em toda a aplicação
 */

export enum AttendanceStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum AttendanceType {
  IN = 'IN',
  OUT = 'OUT',
}

export enum ShiftStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum UserRole {
  ADMIN = 'admin',
  DOCTOR = 'doctor',
  HOSPITAL = 'hospital',
}

/**
 * Tipos de dados de geolocalização
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeoLocation extends Coordinates {
  accuracy?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  timestamp?: Date;
}

export interface Address {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface PolygonCheck {
  inPolygon: boolean;
  distance?: number;
  tolerance?: number;
  reason?: string;
}

/**
 * Tipos de metadados genéricos
 */
export interface EventMetadata {
  eventId: string;
  eventType: string;
  timestamp: Date;
  source: string;
  version?: string;
  correlationId?: string;
  [key: string]: unknown;
}

export interface ValidationResult {
  isValid: boolean;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

/**
 * Tipos de resposta de API
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T = unknown> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/**
 * Tipos de debug e logging
 */
export interface DebugInfo {
  requestId?: string;
  timestamp: Date;
  duration?: number;
  steps?: DebugStep[];
  [key: string]: unknown;
}

export interface DebugStep {
  name: string;
  timestamp: Date;
  duration?: number;
  success: boolean;
  details?: Record<string, unknown>;
}

/**
 * Tipos de arquivo/upload
 */
export interface FileUpload {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size?: number;
}

/**
 * Tipos de cache
 */
export interface CacheEntry<T = unknown> {
  data: T;
  cachedAt: Date;
  expiresAt?: Date;
  version?: number;
}

export interface SetCacheOptions {
  ttl?: number; // em segundos
  expiresAt?: Date;
}

/**
 * Tipos de erro
 */
export interface ErrorDetails {
  code: string;
  message: string;
  field?: string;
  value?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Helper type para remover propriedades opcionais
 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Helper type para tornar propriedades opcionais
 */
export type PartialFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Helper type para propriedades apenas de leitura
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Helper type para extrair tipos de Promise
 */
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

/**
 * Helper type para função assíncrona genérica
 */
export type AsyncFunction<TArgs extends unknown[] = unknown[], TReturn = unknown> = (
  ...args: TArgs
) => Promise<TReturn>;
