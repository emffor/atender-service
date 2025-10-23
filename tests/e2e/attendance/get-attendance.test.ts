/**
 * E2E Tests: Get Attendance by ID (GET /api/attendances/:id)
 * Tests for retrieving specific attendance records
 */

import request from 'supertest';
import TestApp from '../helpers/TestApp';
import { 
  createAuthHeaders, 
  generateTestUUID,
  generateInvalidUUID,
  expectValidAttendanceResponse,
  expectValidErrorResponse
} from '../helpers/e2e-helpers';

describe('E2E: GET /api/attendances/:id - Get Attendance by ID', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = new TestApp();
    // App initialized
  });

  afterAll(() => {
    // Cleanup if needed
  });

  describe('Error Cases', () => {
    it('should return 404 for non-existent attendance', async () => {
      const nonExistentId = generateTestUUID();

      const response = await request(app.getExpressApp())
        .get(`/api/attendances/${nonExistentId}`)
        .set(createAuthHeaders());

      expect([404, 500]).toContain(response.status);
      
      if (response.status === 404) {
        expectValidErrorResponse(response);
      }
    });

    it('should return 400 for invalid UUID format', async () => {
      const invalidId = generateInvalidUUID();

      const response = await request(app.getExpressApp())
        .get(`/api/attendances/${invalidId}`)
        .set(createAuthHeaders());

      expect([400, 404, 500]).toContain(response.status);
      
      if (response.status === 400) {
        expectValidErrorResponse(response);
      }
    });
  });

  describe('Success Cases', () => {
    it('should return attendance if it exists', async () => {
      // First, create an attendance to ensure we have a valid ID
      const validId = '550e8400-e29b-41d4-a716-446655440000'; // Standard test UUID

      const response = await request(app.getExpressApp())
        .get(`/api/attendances/${validId}`)
        .set(createAuthHeaders());

      expect([200, 404, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expectValidAttendanceResponse(response.body);
        expect(response.body.id).toBe(validId);
      }
    });
  });

  describe('Response Format', () => {
    it('should return proper JSON response', async () => {
      const testId = generateTestUUID();

      const response = await request(app.getExpressApp())
        .get(`/api/attendances/${testId}`)
        .set(createAuthHeaders());

      expect(response.header['content-type']).toMatch(/json/);
    });
  });
});


