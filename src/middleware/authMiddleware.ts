import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';

/**
 * Interface para o payload decodificado do JWT
 */
export interface JwtPayload {
  id?: string;
  userId?: string;
  username: string;
  email: string;
  role: string;
  hospitalId?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
    hospitalId?: string;
  };
  // Note: file property is inherited from Express.Request and already typed by multer middleware
}

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Token não fornecido', 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    if (!process.env.JWT_SECRET) {
      throw new AppError('JWT_SECRET não configurado', 500);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;

    // Adicionar informações do usuário à requisição
    req.user = {
      id: decoded.id || decoded.userId || '',
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
      hospitalId: decoded.hospitalId,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Token inválido', 401));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Token expirado', 401));
    } else {
      next(error);
    }
  }
};