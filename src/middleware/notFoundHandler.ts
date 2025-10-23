import { Request, Response } from 'express';

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Endpoint não encontrado',
      statusCode: 404,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
      availableEndpoints: {
        health: '/health',
        attendance: '/api/v1/attendance',
        root: '/',
      },
    },
  });
};