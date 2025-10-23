import { Request, Response, NextFunction } from 'express';
import { validate, ValidationError as ClassValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { AppError } from './errorHandler';
import * as qs from 'qs';

/**
 * Tipo de alvo da validação
 */
export type ValidationTarget = 'body' | 'query' | 'params' | 'headers';

/**
 * Opções de validação
 */
export interface ValidationOptions {
  target?: ValidationTarget;
  skipMissingProperties?: boolean;
  whitelist?: boolean;
  forbidNonWhitelisted?: boolean;
  groups?: string[];
  strictGroups?: boolean;
}

/**
 * Interface para erros formatados
 */
interface FormattedValidationError {
  field: string;
  errors: string[];
  value?: unknown;
}

/**
 * Interface para AppError com validationErrors
 */
interface AppErrorWithValidation extends AppError {
  validationErrors?: FormattedValidationError[];
}

/**
 * Middleware avançado de validação com class-validator
 * 
 * @example
 * ```typescript
 * // Em routes:
 * router.post(
 *   '/attendance',
 *   requestValidator(CreateAttendanceDTO, { target: 'body' }),
 *   controller.create
 * );
 * 
 * router.get(
 *   '/attendance/:id',
 *   requestValidator(UUIDParamDTO, { target: 'params' }),
 *   controller.getById
 * );
 * ```
 */
export function requestValidator<T extends object>(
  dtoClass: new () => T,
  options: ValidationOptions = {}
) {
  const {
    target = 'body',
    skipMissingProperties = false,
    whitelist = true,
    forbidNonWhitelisted = true,
    groups,
    strictGroups = false,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extrair dados do request baseado no target
      const rawData = extractDataFromRequest(req, target);

      // Converter plain object para classe (DTO)
      const dtoInstance = plainToClass(dtoClass, rawData, {
        excludeExtraneousValues: whitelist, // Ignora propriedades não decoradas com @Expose()
        enableImplicitConversion: true, // Converte tipos automaticamente (string → number, etc)
      });

      // Validar DTO com class-validator
      const validationErrors: ClassValidationError[] = await validate(dtoInstance, {
        skipMissingProperties,
        whitelist,
        forbidNonWhitelisted,
        groups,
        strictGroups,
        validationError: {
          target: false, // Não incluir objeto inteiro no erro
          value: true, // Incluir valor que falhou
        },
      });

      // Se houver erros, formatar e lançar
      if (validationErrors.length > 0) {
        const formattedErrors = formatValidationErrors(validationErrors);
        
        const error = new AppError(
          `Validation failed for ${formattedErrors.length} field(s)`,
          400
        ) as AppErrorWithValidation;
        // Adicionar informações extras no erro
        error.validationErrors = formattedErrors;
        throw error;
      }

      // Substituir dados validados no request
      injectValidatedData(req, target, dtoInstance);

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Extrai dados do request baseado no target
 */
function extractDataFromRequest(req: Request, target: ValidationTarget): unknown {
  switch (target) {
    case 'body':
      return req.body;
    case 'query':
      return req.query;
    case 'params':
      return req.params;
    case 'headers':
      return req.headers;
    default:
      return req.body;
  }
}

/**
 * Injeta dados validados de volta no request
 */
function injectValidatedData<T>(req: Request, target: ValidationTarget, data: T): void {
  switch (target) {
    case 'body':
      req.body = data;
      break;
    case 'query':
      req.query = data as unknown as qs.ParsedQs;
      break;
    case 'params':
      req.params = data as unknown as Record<string, string>;
      break;
    case 'headers':
      // Headers são read-only, não sobrescrever
      break;
  }
}

/**
 * Formata erros de validação para resposta JSON
 */
function formatValidationErrors(
  errors: ClassValidationError[]
): FormattedValidationError[] {
  const formatted: FormattedValidationError[] = [];

  function processError(error: ClassValidationError, parentPath = ''): void {
    const fieldPath = parentPath ? `${parentPath}.${error.property}` : error.property;

    // Se tem constraints (erros de validação diretos)
    if (error.constraints) {
      formatted.push({
        field: fieldPath,
        errors: Object.values(error.constraints),
        value: error.value,
      });
    }

    // Se tem children (nested objects)
    if (error.children && error.children.length > 0) {
      error.children.forEach(child => processError(child, fieldPath));
    }
  }

  errors.forEach(error => processError(error));
  return formatted;
}

/**
 * Middleware para validar múltiplos targets ao mesmo tempo
 * 
 * @example
 * ```typescript
 * router.get(
 *   '/attendance',
 *   multiValidator({
 *     query: ListAttendanceQueryDTO,
 *     headers: AuthHeadersDTO
 *   }),
 *   controller.list
 * );
 * ```
 */
export function multiValidator<
  TBody extends object = object,
  TQuery extends object = object,
  TParams extends object = object,
  THeaders extends object = object
>(validators: {
  body?: new () => TBody;
  query?: new () => TQuery;
  params?: new () => TParams;
  headers?: new () => THeaders;
}) {
  const middlewares: Array<ReturnType<typeof requestValidator>> = [];

  if (validators.body) {
    middlewares.push(requestValidator(validators.body, { target: 'body' }));
  }
  if (validators.query) {
    middlewares.push(requestValidator(validators.query, { target: 'query' }));
  }
  if (validators.params) {
    middlewares.push(requestValidator(validators.params, { target: 'params' }));
  }
  if (validators.headers) {
    middlewares.push(requestValidator(validators.headers, { target: 'headers' }));
  }

  return middlewares;
}

/**
 * Middleware para validação condicional
 * Só valida se uma condição for verdadeira
 * 
 * @example
 * ```typescript
 * router.post(
 *   '/attendance',
 *   conditionalValidator(
 *     CreateAttendanceDTO,
 *     (req) => req.headers['content-type']?.includes('application/json')
 *   ),
 *   controller.create
 * );
 * ```
 */
export function conditionalValidator<T extends object>(
  dtoClass: new () => T,
  condition: (req: Request) => boolean,
  options: ValidationOptions = {}
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (condition(req)) {
      return requestValidator(dtoClass, options)(req, res, next);
    }
    next();
  };
}

/**
 * Middleware para sanitização de dados antes da validação
 * Útil para trim strings, normalizar formatos, etc.
 */
export function sanitizeRequest(
  sanitizer: (data: unknown) => unknown,
  target: ValidationTarget = 'body'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = extractDataFromRequest(req, target);
      const sanitized = sanitizer(data);
      injectValidatedData(req, target, sanitized);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Sanitizadores comuns
 */
export const commonSanitizers = {
  /**
   * Trim all string fields
   */
  trimStrings: (data: unknown): unknown => {
    if (typeof data === 'string') {
      return data.trim();
    }
    if (Array.isArray(data)) {
      return data.map(commonSanitizers.trimStrings);
    }
    if (typeof data === 'object' && data !== null) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = commonSanitizers.trimStrings(value);
      }
      return sanitized;
    }
    return data;
  },

  /**
   * Remove null and undefined values
   */
  removeNullish: (data: unknown): unknown => {
    if (Array.isArray(data)) {
      return data.filter(item => item != null).map(commonSanitizers.removeNullish);
    }
    if (typeof data === 'object' && data !== null) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value != null) {
          sanitized[key] = commonSanitizers.removeNullish(value);
        }
      }
      return sanitized;
    }
    return data;
  },

  /**
   * Convert empty strings to null
   */
  emptyStringsToNull: (data: unknown): unknown => {
    if (typeof data === 'string' && data.trim() === '') {
      return null;
    }
    if (Array.isArray(data)) {
      return data.map(commonSanitizers.emptyStringsToNull);
    }
    if (typeof data === 'object' && data !== null) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = commonSanitizers.emptyStringsToNull(value);
      }
      return sanitized;
    }
    return data;
  },
};

/**
 * Combina múltiplos sanitizadores
 */
export function combineSanitizers(...sanitizers: Array<(data: unknown) => unknown>) {
  return (data: unknown): unknown => {
    return sanitizers.reduce((acc, sanitizer) => sanitizer(acc), data);
  };
}

export default requestValidator;
