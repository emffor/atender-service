/**
 * Setup para testes E2E
 * Não conecta ao DB - usa mocks para infraestrutura
 */

// Mock do Redis antes de importar qualquer módulo
jest.mock('@/services/cache/RedisCache', () => ({
  redisCache: {
    connect: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
  },
}));

// Mock do RabbitMQ
jest.mock('@/messaging/RabbitMQConnection', () => ({
  rabbitMQ: {
    connect: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock do Event Publisher
jest.mock('@/events/AttendanceEventPublisher', () => ({
  attendanceEventPublisher: {
    publishAttendanceCreated: jest.fn().mockResolvedValue(undefined),
    publishAttendanceApproved: jest.fn().mockResolvedValue(undefined),
    publishAttendanceRejected: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock do External Event Consumer
jest.mock('@/events/ExternalEventConsumer', () => ({
  externalEventConsumer: {
    startConsuming: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock do RabbitMQ Request/Reply Service
jest.mock('@/services/RabbitMQRequestReplyService', () => ({
  rabbitMQRequestReply: {
    initialize: jest.fn().mockResolvedValue(undefined),
  },
}));

console.log('✅ [E2E Setup] Mocks configurados (sem conexão real ao DB/Redis/RabbitMQ)');
console.log('ℹ️  [E2E Setup] Testes E2E rodando com infraestrutura mockada');
