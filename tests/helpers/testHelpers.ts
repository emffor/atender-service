import { AppDataSource } from '../../src/config/database';
import { Attendance } from '../../src/entities/Attendance';
import express from 'express';

/**
 * Helpers para testes
 */

/**
 * Limpa todas as tabelas do banco de teste
 */
export async function clearTestDatabase(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    throw new Error('Database não está inicializado');
  }

  const entities = AppDataSource.entityMetadatas;

  for (const entity of entities) {
    const repository = AppDataSource.getRepository(entity.name);
    await repository.clear();
  }
}

/**
 * Cria um attendance de teste
 */
export async function createTestAttendance(data: Partial<Attendance>): Promise<Attendance> {
  const repository = AppDataSource.getRepository(Attendance);
  
  const attendance = repository.create({
    shiftId: data.shiftId || '123e4567-e89b-12d3-a456-426614174000',
    doctorId: data.doctorId || '123e4567-e89b-12d3-a456-426614174001',
    type: data.type || 'IN',
    timestamp: data.timestamp || new Date(),
    latitude: data.latitude || -23.5505,
    longitude: data.longitude || -46.6333,
    status: data.status || 'PENDING',
    isLate: data.isLate || false,
    lateMinutes: data.lateMinutes || 0,
    hasAutomaticDiscount: data.hasAutomaticDiscount || false,
    discountPercentage: data.discountPercentage || 0,
    approvedWithDiscount: data.approvedWithDiscount || false,
    ...data,
  });

  return await repository.save(attendance);
}

/**
 * Mock de Request para testes
 */
export function createMockRequest(overrides: Record<string, unknown> = {}): Partial<import('express').Request> {
  const req: Partial<import('express').Request> = {
    ip: '127.0.0.1',
    path: '/test',
    method: 'GET',
    headers: {},
    body: {},
    params: {},
    query: {},
    ...overrides,
  };

  return req;
}

/**
 * Mock de Response para testes
 */
export function createMockResponse(): Partial<import('express').Response> & { _data?: unknown; _headers?: Record<string, string> } {
  const res: Partial<import('express').Response> & { _data?: unknown; _headers?: Record<string, string> } = {
    statusCode: 200,
    _headers: {},
    _data: null,
  };

  res.status = jest.fn((code: number) => {
    (res as unknown as { statusCode?: number }).statusCode = code;
    return res as unknown as express.Response;
  });

  res.json = jest.fn((data: unknown) => {
    res._data = data;
    return res as unknown as express.Response;
  });

  res.send = jest.fn((data: unknown) => {
    res._data = data;
    return res as unknown as express.Response;
  });

  res.setHeader = jest.fn((key: string, value: string) => {
    res._headers = res._headers || {};
    res._headers[key] = value;
    return res as unknown as express.Response;
  });

  return res;
}

/**
 * Mock de NextFunction para testes
 */
export function createMockNext(): jest.Mock {
  return jest.fn();
}
