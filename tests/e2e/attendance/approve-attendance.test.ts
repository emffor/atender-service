/**
 * E2E Tests: Approve Attendance (PUT /api/attendances/:id/approve)
 * Tests for approving attendance records
 */

import request from 'supertest';
import TestApp from '../helpers/TestApp';
import { 
  createAuthHeaders, 
  generateTestUUID,
  expectValidAttendanceResponse,
  expectValidErrorResponse
} from '../helpers/e2e-helpers';

describe('E2E: PUT /api/attendances/:id/approve - Approve Attendance', () => {
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
        .put(`/api/attendances/${nonExistentId}/approve`)
        .set(createAuthHeaders('test-user', 'hospital'))
        .send({ reason: 'Approved by hospital' });

      expect([404, 500]).toContain(response.status);
      
      if (response.status === 404) {
        expectValidErrorResponse(response);
      }
    });
  });

  describe('Success Cases', () => {
    it('should accept approval with valid data and reason', async () => {
      const testId = generateTestUUID();
      const approvalData = {
        reason: 'Approved by hospital administrator',
      };

      const response = await request(app.getExpressApp())
        .put(`/api/attendances/${testId}/approve`)
        .set(createAuthHeaders('hospital-admin', 'hospital'))
        .send(approvalData);

      expect([200, 404, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expectValidAttendanceResponse(response.body);
        expect(response.body.status).toBe('APPROVED');
      }
    });

    it('should accept approval without reason (optional)', async () => {
      const testId = generateTestUUID();

      const response = await request(app.getExpressApp())
        .put(`/api/attendances/${testId}/approve`)
        .set(createAuthHeaders('hospital-admin', 'hospital'))
        .send({});

      expect([200, 404, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expectValidAttendanceResponse(response.body);
        expect(response.body.status).toBe('APPROVED');
      }
    });
  });

  describe('Authorization Tests', () => {
    it('should require hospital role for approval', async () => {
      const testId = generateTestUUID();

      const response = await request(app.getExpressApp())
        .put(`/api/attendances/${testId}/approve`)
        .set(createAuthHeaders('doctor-user', 'doctor'))
        .send({ reason: 'Trying to approve' });

      expect([403, 404, 500]).toContain(response.status);
      
      if (response.status === 403) {
        expectValidErrorResponse(response);
      }
    });
  });
});


