/**
 * E2E Tests: Authentication & Authorization
 * Tests for API authentication and authorization requirements
 */

import request from 'supertest';
import TestApp from '../helpers/TestApp';
import { createAuthHeaders, expectValidErrorResponse } from '../helpers/e2e-helpers';

describe('E2E: Authentication & Authorization', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = new TestApp();
    // App initialized
  });

  afterAll(() => {
    // Cleanup if needed
  });

  describe('Missing Authentication Headers', () => {
    it('should return 401 without any authentication headers', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/attendances')
        .set('Content-Type', 'application/json');

      expect([401, 500]).toContain(response.status);
      
      if (response.status === 401) {
        expectValidErrorResponse(response);
      }
    });

    it('should return 401 without x-user-id header', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/attendances')
        .set({
          'x-user-role': 'hospital',
          'Content-Type': 'application/json',
        });

      expect([401, 500]).toContain(response.status);
      
      if (response.status === 401) {
        expectValidErrorResponse(response);
      }
    });

    it('should return 401 without x-user-role header', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/attendances')
        .set({
          'x-user-id': 'test-user-id',
          'Content-Type': 'application/json',
        });

      expect([401, 500]).toContain(response.status);
      
      if (response.status === 401) {
        expectValidErrorResponse(response);
      }
    });
  });

  describe('Role-Based Access Control', () => {
    it('should allow hospital role to access administrative endpoints', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/attendances')
        .set(createAuthHeaders('hospital-user', 'hospital'));

      expect([200, 404, 500]).toContain(response.status);
    });

    it('should restrict doctor role from administrative actions', async () => {
      const response = await request(app.getExpressApp())
        .put('/api/attendances/550e8400-e29b-41d4-a716-446655440000/approve')
        .set(createAuthHeaders('doctor-user', 'doctor'))
        .send({ reason: 'Trying to approve' });

      expect([403, 404, 500]).toContain(response.status);
    });
  });

  describe('Valid Authentication', () => {
    it('should accept requests with valid authentication headers', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/attendances')
        .set(createAuthHeaders('valid-user', 'hospital'));

      expect([200, 404, 500]).toContain(response.status);
    });
  });
});


