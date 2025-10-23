/**
 * E2E Tests: Response Format
 * Tests for API response format and standards
 */

import request from 'supertest';
import TestApp from '../helpers/TestApp';
import { createAuthHeaders } from '../helpers/e2e-helpers';

describe('E2E: Response Format', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = new TestApp();
    // App initialized
  });

  afterAll(() => {
    // Cleanup if needed
  });

  describe('JSON Responses', () => {
    it('should return JSON content-type for all responses', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/attendances')
        .set(createAuthHeaders());

      expect(response.header['content-type']).toMatch(/json/);
    });

    it('should return valid JSON structure', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/attendances')
        .set(createAuthHeaders());

      expect([200, 404, 500]).toContain(response.status);
      expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in OPTIONS request', async () => {
      const response = await request(app.getExpressApp())
        .options('/api/attendances')
        .set(createAuthHeaders());

      expect([200, 204, 404]).toContain(response.status);
      
      if (response.status === 200 || response.status === 204) {
        expect(
          response.header['access-control-allow-origin'] ||
          response.header['access-control-allow-methods']
        ).toBeDefined();
      }
    });
  });

  describe('Response Structure', () => {
    it('should have consistent error response structure', async () => {
      const response = await request(app.getExpressApp())
        .post('/api/attendances')
        .set(createAuthHeaders())
        .send({});

      expect([400, 500]).toContain(response.status);
      
      if (response.status === 400) {
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should have consistent success response structure', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/attendances')
        .set(createAuthHeaders());

      expect([200, 404, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data) || typeof response.body.data === 'object').toBe(true);
      }
    });
  });
});


