import { Request, Response, NextFunction } from 'express';

/**
 * Mock de upload middleware
 * 
 * TODO: Instalar multer para upload real de arquivos:
 * npm install multer @types/multer
 */

// Mock middleware que apenas passa adiante
export const upload = {
  single: (fieldName: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
      console.log(`📦 [MOCK] Upload middleware para campo: ${fieldName}`);
      // Em produção, aqui processaria o arquivo
      next();
    };
  },
  array: (fieldName: string, maxCount?: number) => {
    return (req: Request, res: Response, next: NextFunction) => {
      console.log(`📦 [MOCK] Upload middleware para campo: ${fieldName}`);
      next();
    };
  },
};

// Mock middleware de erro
export const handleMulterError = (error: unknown, req: Request, res: Response, next: NextFunction) => {
  console.log('📦 [MOCK] Multer error handler');
  next(error);
};