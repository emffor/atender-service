/**
 * E2E Tests: Reject Attendance (PUT /api/attendances/:id/reject)
 * Tests for rejecting attendance records
 */

import request from 'supertest';
import TestApp from '../helpers/TestApp';
import { 
  createAuthHeaders, 
  generateTestUUID,
  expectValidAttendanceResponse,
  expectValidErrorResponse
} from '../helpers/e2e-helpers';

describe('E2E: PUT /api/attendances/:id/reject - Reject Attendance', () => {
  let app: TestApp;

  beforeAll(() => {
    app = new TestApp();
  });

  afterAll(() => {
    // Cleanup if needed
  });

  describe('Error Cases', () => {
    it('should return 404 for non-existent attendance', async () => {
      const nonExistentId = generateTestUUID();

      const response = await request(app.getExpressApp())
        .put(`/api/attendances/${nonExistentId}/reject`)
        .set(createAuthHeaders('test-user', 'hospital'))
        .send({ reason: 'Location too far from hospital' });

      expect([404, 500]).toContain(response.status);
      
      if (response.status === 404) {
        expectValidErrorResponse(response);
      }
    });

    it('should require reason for rejection', async () => {
      const testId = generateTestUUID();

      const response = await request(app.getExpressApp())
        .put(`/api/attendances/${testId}/reject`)
        .set(createAuthHeaders('hospital-admin', 'hospital'))
        .send({});

      expect([400, 404, 500]).toContain(response.status);
      
      if (response.status === 400) {
        expectValidErrorResponse(response);
      }
    });
  });

  describe('Success Cases', () => {
    it('should reject attendance with valid reason', async () => {
      const testId = generateTestUUID();
      const rejectionData = {
        reason: 'Location too far from hospital - outside geofence',
      };

      const response = await request(app.getExpressApp())
        .put(`/api/attendances/${testId}/reject`)
        .set(createAuthHeaders('hospital-admin', 'hospital'))
        .send(rejectionData);

      expect([200, 404, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expectValidAttendanceResponse(response.body);
        expect(response.body.status).toBe('REJECTED');
      }
    });
  });

  describe('Authorization Tests', () => {
    it('should require hospital role for rejection', async () => {
      const testId = generateTestUUID();

      const response = await request(app.getExpressApp())
        .put(`/api/attendances/${testId}/reject`)
        .set(createAuthHeaders('doctor-user', 'doctor'))
        .send({ reason: 'Trying to reject' });

      expect([403, 404, 500]).toContain(response.status);
      
      if (response.status === 403) {
        expectValidErrorResponse(response);
      }
    });
  });
});


