/**
 * Type guards e utilit

ários para tratamento de erros
 */

/**
 * Type guard para verificar se o valor é um Error
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Extrair mensagem de erro de unknown
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Erro desconhecido';
}

/**
 * Extrair stack trace de erro
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

/**
 * Verificar se é AppError
 */
export function isAppError(error: unknown): error is import('../errors/AppError').AppError {
  return error instanceof Error && 'code' in error && 'isOperational' in error;
}
