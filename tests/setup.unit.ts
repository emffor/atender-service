/**
 * Setup para testes unitários
 * Não conecta com banco de dados real
 */

// Mock do console para evitar poluição de logs
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Timeout global para testes
jest.setTimeout(10000);

// Limpar mocks antes de cada teste
beforeEach(() => {
  jest.clearAllMocks();
});
