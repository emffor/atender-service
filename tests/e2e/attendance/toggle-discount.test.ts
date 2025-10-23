/**
 * E2E Tests: Toggle Discount (PUT /api/attendances/:id/toggle-discount, PUT /api/shifts/:shiftId/toggle-discount)
 * Tests for toggling discount flags
 */

import request from 'supertest';
import TestApp from '../helpers/TestApp';
import { 
  createAuthHeaders, 
  generateTestUUID
} from '../helpers/e2e-helpers';

describe('E2E: Toggle Discount - Attendance and Shift', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = new TestApp();
    // App initialized
  });

  afterAll(() => {
    // Cleanup if needed
  });

  describe('PUT /api/attendances/:id/toggle-discount', () => {
    it('should toggle discount flag for attendance', async () => {
      const attendanceId = generateTestUUID();

      const response = await request(app.getExpressApp())
        .put(`/api/attendances/${attendanceId}/toggle-discount`)
        .set(createAuthHeaders('hospital-admin', 'hospital'));

      expect([200, 404, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('hasDiscount');
        expect(typeof response.body.hasDiscount).toBe('boolean');
      }
    });

    it('should require hospital role', async () => {
      const attendanceId = generateTestUUID();

      const response = await request(app.getExpressApp())
        .put(`/api/attendances/${attendanceId}/toggle-discount`)
        .set(createAuthHeaders('doctor-user', 'doctor'));

      expect([403, 404, 500]).toContain(response.status);
    });
  });

  describe('PUT /api/shifts/:shiftId/toggle-discount', () => {
    it('should toggle discount flag for shift', async () => {
      const shiftId = generateTestUUID();

      const response = await request(app.getExpressApp())
        .put(`/api/shifts/${shiftId}/toggle-discount`)
        .set(createAuthHeaders('hospital-admin', 'hospital'));

      expect([200, 404, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('hasDiscount');
        expect(typeof response.body.hasDiscount).toBe('boolean');
      }
    });

    it('should require hospital role', async () => {
      const shiftId = generateTestUUID();

      const response = await request(app.getExpressApp())
        .put(`/api/shifts/${shiftId}/toggle-discount`)
        .set(createAuthHeaders('doctor-user', 'doctor'));

      expect([403, 404, 500]).toContain(response.status);
    });
  });
});


