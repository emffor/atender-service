/**
 * E2E Tests: GET /attendances/missing
 * Testa endpoint de listagem de pontos faltantes (missing punches)
 */

import request from 'supertest';
import { TestApp } from '../helpers/TestApp';
import { createAuthHeaders } from '../helpers/e2e-helpers';

describe('E2E: GET /attendances/missing - List Missing Punches', () => {
  let app: TestApp;

  beforeAll(() => {
    app = new TestApp();
  });

  describe('Success Cases - Doctor Filter', () => {
    it('should list missing IN punches for doctor', async () => {
      const doctorId = 'doctor-123';
      
      const response = await request(app.getExpressApp())
        .get('/api/attendances/missing')
        .query({ doctorId })
        .set(createAuthHeaders('hospital'));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
    });

    it('should list missing OUT punches for doctor', async () => {
      const doctorId = 'doctor-456';
      
      const response = await request(app.getExpressApp())
        .get('/api/attendances/missing')
        .query({ 
          doctorId,
          type: 'OUT'
        })
        .set(createAuthHeaders('hospital'));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter by date range', async () => {
      const startDate = '2025-10-01';
      const endDate = '2025-10-20';
      
      const response = await request(app.getExpressApp())
        .get('/api/attendances/missing')
        .query({ startDate, endDate })
        .set(createAuthHeaders('hospital'));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('Success Cases - Hospital Filter', () => {
    it('should filter by hospitalId', async () => {
      const hospitalId = 'hospital-789';
      
      const response = await request(app.getExpressApp())
        .get('/api/attendances/missing')
        .query({ hospitalId })
        .set(createAuthHeaders('hospital'));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return empty array when no missing punches', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/attendances/missing')
        .set(createAuthHeaders('hospital'));

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('Pagination Tests', () => {
    it('should handle pagination parameters', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/attendances/missing')
        .query({ page: 1, limit: 10 })
        .set(createAuthHeaders('hospital'));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('totalPages');
    });

    it('should accept different page sizes', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/attendances/missing')
        .query({ page: 2, limit: 25 })
        .set(createAuthHeaders('hospital'));

      expect(response.status).toBe(200);
      expect(response.body.pagination.limit).toBe(25);
      expect(response.body.pagination.page).toBe(2);
    });
  });

  describe('Authentication Tests', () => {
    it('should require authentication', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/attendances/missing');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should allow hospital role', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/attendances/missing')
        .set(createAuthHeaders('hospital'));

      expect(response.status).toBe(200);
    });

    it('should allow doctor role', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/attendances/missing')
        .set(createAuthHeaders('doctor'));

      expect(response.status).toBe(200);
    });
  });

  describe('Response Format', () => {
    it('should return proper JSON structure', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/attendances/missing')
        .set(createAuthHeaders('hospital'));

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
    });
  });
});
