import { Request, Response, NextFunction } from 'express';
import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { AppError } from './errorHandler';
import { ParsedQs } from 'qs';

type ValidationTarget = 'body' | 'query' | 'params';

export function validateDTO<T extends object>(
  dtoClass: new () => T,
  target: ValidationTarget = 'body'
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let data: Record<string, unknown> | ParsedQs;
      
      switch (target) {
        case 'body':
          data = req.body as Record<string, unknown>;
          break;
        case 'query':
          data = req.query;
          break;
        case 'params':
          data = req.params as Record<string, unknown>;
          break;
        default:
          data = req.body as Record<string, unknown>;
      }

      // Converter plain object para classe
      const dto = plainToClass(dtoClass, data);

      // Validar
      const errors: ValidationError[] = await validate(dto, {
        whitelist: true, // Remove propriedades não definidas no DTO
        forbidNonWhitelisted: true, // Rejeita propriedades extras
      });

      if (errors.length > 0) {
        const errorMessages = errors.map(error => {
          const constraints = error.constraints;
          if (constraints) {
            return Object.values(constraints).join(', ');
          }
          return `Validation failed for ${error.property}`;
        });

        throw new AppError(
          `Erro de validação: ${errorMessages.join('; ')}`,
          400
        );
      }

      // Substituir dados validados na requisição
      switch (target) {
        case 'body':
          req.body = dto;
          break;
        case 'query':
          req.query = dto as unknown as ParsedQs;
          break;
        case 'params':
          req.params = dto as unknown as Record<string, string>;
          break;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}