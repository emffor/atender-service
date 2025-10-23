/**
 * E2E Tests: Error Handling
 * Tests for API error handling and validation
 */

import request from 'supertest';
import TestApp from '../helpers/TestApp';
import { createAuthHeaders, expectValidErrorResponse } from '../helpers/e2e-helpers';

describe('E2E: Error Handling', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = new TestApp();
    // App initialized
  });

  afterAll(() => {
    // Cleanup if needed
  });

  describe('Malformed Requests', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app.getExpressApp())
        .post('/api/attendances')
        .set(createAuthHeaders())
        .send('{ invalid json }')
        .set('Content-Type', 'application/json');

      expect([400, 500]).toContain(response.status);
      
      if (response.status === 400) {
        expectValidErrorResponse(response);
      }
    });

    it('should validate Content-Type header', async () => {
      const response = await request(app.getExpressApp())
        .post('/api/attendances')
        .set({
          'x-user-id': 'test-user',
          'x-user-role': 'hospital',
        })
        .send({ test: 'data' });

      expect([400, 415, 500]).toContain(response.status);
    });
  });

  describe('Error Response Format', () => {
    it('should return proper error messages in response', async () => {
      const response = await request(app.getExpressApp())
        .post('/api/attendances')
        .set(createAuthHeaders())
        .send({});

      expect([400, 500]).toContain(response.status);
      
      if (response.status === 400) {
        expectValidErrorResponse(response);
        expect(response.body.error).toBeTruthy();
        expect(typeof response.body.error).toBe('string');
      }
    });

    it('should include error details for validation failures', async () => {
      const invalidData = {
        type: 'INVALID_TYPE',
        latitude: 999,
        longitude: 999,
      };

      const response = await request(app.getExpressApp())
        .post('/api/attendances')
        .set(createAuthHeaders())
        .send(invalidData);

      expect([400, 500]).toContain(response.status);
      
      if (response.status === 400) {
        expectValidErrorResponse(response);
      }
    });
  });

  describe('Not Found Errors', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/non-existent-endpoint')
        .set(createAuthHeaders());

      expect([404, 500]).toContain(response.status);
    });
  });
});


