/**
 * Setup para testes de integração
 * USA MOCKS para DB/Redis - NÃO conecta em infraestrutura real
 */

// Mock do AppDataSource ANTES de importar
jest.mock('../src/config/database', () => ({
  AppDataSource: {
    isInitialized: true,
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    manager: {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// Mock do RedisCache
jest.mock('../src/services/cache/RedisCache', () => ({
  redisCache: {
    connect: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock do RabbitMQ
jest.mock('../src/messaging/RabbitMQConnection', () => ({
  RabbitMQConnection: {
    getInstance: jest.fn().mockReturnValue({
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      publishEvent: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Mock do console para reduzir poluição
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};

// Timeout global para testes de integração
jest.setTimeout(30000);

// Setup antes de todos os testes
beforeAll(async () => {
  console.info('✅ [Integration Setup] Mocks configurados (DB/Redis mockados)');
});

// Limpar mocks antes de cada teste
beforeEach(async () => {
  jest.clearAllMocks();
});

// Cleanup após todos os testes
afterAll(async () => {
  console.info('✅ [Integration Setup] Testes de integração finalizados');
});
