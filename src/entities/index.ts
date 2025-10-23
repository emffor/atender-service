// Entity Exports
export { Attendance, AttendanceType, AttendanceStatus } from './Attendance';

// Nota: Shift e UserAuth NÃO são entidades deste microserviço
// Esses dados vêm via cache (ShiftCacheService, UserCacheService)
// alimentados por eventos RabbitMQ de outros serviços