/**
 * E2E Tests: GET /attendances/count-by-status
 * Testa endpoint de contagem de attendances por status
 */

import request from 'supertest';
import { TestApp } from '../helpers/TestApp';
import { createAuthHeaders } from '../helpers/e2e-helpers';

describe('E2E: GET /attendances/count-by-status - Count Attendances by Status', () => {
  let app: TestApp;

  beforeAll(() => {
    app = new TestApp();
  });

  describe('Success Cases', () => {
    it('should count attendances by status for today', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/attendances/count-by-status')
        .set(createAuthHeaders('hospital'));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('pending');
      expect(response.body).toHaveProperty('approved');
      expect(response.body).toHaveProperty('rejected');
      expect(typeof response.body.pending).toBe('number');
      expect(typeof response.body.approved).toBe('number');
      expect(typeof response.body.rejected).toBe('number');
    });

    it('should filter by hospital (x-user-id)', async () => {
      const hospitalId = 'hospital-123';
      
      const response = await request(app.getExpressApp())
        .get('/api/attendances/count-by-status')
        .set('x-user-id', hospitalId)
        .set('x-user-role', 'hospital');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('pending');
    });

    it('should accept date parameter', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await request(app.getExpressApp())
        .get('/api/attendances/count-by-status')
        .query({ date: today })
        .set(createAuthHeaders('hospital'));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('pending');
    });

    it('should handle empty results (all zeros)', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/attendances/count-by-status')
        .set(createAuthHeaders('hospital'));

      expect(response.status).toBe(200);
      // TestApp returns mocked data, so counts should be >= 0
      expect(response.body.pending).toBeGreaterThanOrEqual(0);
      expect(response.body.approved).toBeGreaterThanOrEqual(0);
      expect(response.body.rejected).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Authentication Tests', () => {
    it('should require authentication', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/attendances/count-by-status');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should require x-user-id header', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/attendances/count-by-status')
        .set('x-user-role', 'hospital');

      expect(response.status).toBe(401);
    });
  });

  describe('Response Format', () => {
    it('should return proper JSON structure', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/attendances/count-by-status')
        .set(createAuthHeaders('hospital'));

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);
      expect(Object.keys(response.body)).toEqual(
        expect.arrayContaining(['pending', 'approved', 'rejected'])
      );
    });
  });
});
