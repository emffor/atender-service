/**
 * Exportação centralizada de todos os serviços do microserviço de Attendance
 */

// Core Services
export * from './FaceRecognitionService';
export * from './NotificationService';
export * from './EmailService';
export * from './AttendanceService';

// Specialized Services
export * from './AttendanceValidationService';
export * from './AttendanceGeolocationService';
export * from './AttendanceDiscountService';
export * from './AttendancePhotoService';
export * from './AttendancePolicyService';

// Cache Services
export * from './cache/ShiftCacheService';
export * from './cache/UserCacheService';