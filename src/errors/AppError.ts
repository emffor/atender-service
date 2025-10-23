/**
 * Classe de erro personalizada para a aplicação
 */
export class AppError extends Error {
  public readonly code: number;
  public readonly message: string;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.message = message;
    
    Error.captureStackTrace(this, AppError);
  }
}