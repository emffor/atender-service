import { Router } from 'express';

/**
 * Classe abstrata base para todas as rotas
 * 
 * Padrão Template Method:
 * - Define estrutura comum para todas as rotas
 * - Força implementação de métodos específicos nas subclasses
 */
export abstract class BaseRoutes {
  protected router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  /**
   * Método abstrato que deve ser implementado pelas subclasses
   * Define as rotas específicas de cada módulo
   */
  protected abstract initializeRoutes(): void;

  /**
   * Retorna o router configurado
   */
  public getRouter(): Router {
    return this.router;
  }

  /**
   * Log helper para debug de rotas
   */
  protected logRoute(method: string, path: string, description?: string): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📍 [ROUTE] ${method.toUpperCase()} ${path}${description ? ` - ${description}` : ''}`);
    }
  }
}