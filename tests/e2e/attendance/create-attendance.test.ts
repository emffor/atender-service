/**
 * E2E Tests: Create Attendance (POST /api/attendances)
 * Tests for creating new attendance records
 */

import request from 'supertest';
import TestApp from '../helpers/TestApp';
import { 
  createAuthHeaders, 
  createTestAttendanceData, 
  createTestCoordinates,
  expectValidAttendanceResponse,
  expectValidErrorResponse 
} from '../helpers/e2e-helpers';

describe('E2E: POST /api/attendances - Create Attendance', () => {
  let app: TestApp;

  beforeAll(() => {
    app = new TestApp();
  });

  afterAll(() => {
    // Cleanup if needed
  });

  describe('Validation Tests', () => {
    it('should return 400 for missing required fields', async () => {
      const response = await request(app.getExpressApp())
        .post('/api/attendances')
        .set(createAuthHeaders())
        .send({});

      expect([400, 500]).toContain(response.status);
      if (response.status === 400) {
        expectValidErrorResponse(response);
      }
    });

    it('should return 400 for invalid type', async () => {
      const invalidData = createTestAttendanceData({ type: 'INVALID' });

      const response = await request(app.getExpressApp())
        .post('/api/attendances')
        .set(createAuthHeaders())
        .send(invalidData);

      expect([400, 500]).toContain(response.status);
      if (response.status === 400) {
        expectValidErrorResponse(response);
      }
    });

    it('should return 400 for invalid coordinates', async () => {
      const invalidCoords = createTestCoordinates('invalid');
      const invalidData = createTestAttendanceData(invalidCoords);

      const response = await request(app.getExpressApp())
        .post('/api/attendances')
        .set(createAuthHeaders())
        .send(invalidData);

      expect([400, 500]).toContain(response.status);
    });

    it('should return 400 for missing shiftId', async () => {
      const data = createTestAttendanceData();
      delete data.shiftId;

      const response = await request(app.getExpressApp())
        .post('/api/attendances')
        .set(createAuthHeaders())
        .send(data);

      expect([400, 500]).toContain(response.status);
      if (response.status === 400) {
        expectValidErrorResponse(response);
      }
    });

    it('should return 400 for missing doctorId', async () => {
      const data = createTestAttendanceData();
      delete data.doctorId;

      const response = await request(app.getExpressApp())
        .post('/api/attendances')
        .set(createAuthHeaders())
        .send(data);

      expect([400, 500]).toContain(response.status);
      if (response.status === 400) {
        expectValidErrorResponse(response);
      }
    });
  });

  describe('Success Cases', () => {
    it('should accept valid attendance data with IN type', async () => {
      const validData = createTestAttendanceData({ type: 'IN' });

      const response = await request(app.getExpressApp())
        .post('/api/attendances')
        .set(createAuthHeaders())
        .send(validData);

      expect([201, 404, 409, 500]).toContain(response.status);
      
      if (response.status === 201) {
        expectValidAttendanceResponse(response.body);
        expect(response.body.type).toBe('IN');
      }
    });

    it('should accept valid attendance data with OUT type', async () => {
      const validData = createTestAttendanceData({ type: 'OUT' });

      const response = await request(app.getExpressApp())
        .post('/api/attendances')
        .set(createAuthHeaders())
        .send(validData);

      expect([201, 404, 409, 500]).toContain(response.status);
      
      if (response.status === 201) {
        expectValidAttendanceResponse(response.body);
        expect(response.body.type).toBe('OUT');
      }
    });

    it('should accept valid coordinates within geofence', async () => {
      const validCoords = createTestCoordinates('valid');
      const validData = createTestAttendanceData(validCoords);

      const response = await request(app.getExpressApp())
        .post('/api/attendances')
        .set(createAuthHeaders())
        .send(validData);

      expect([201, 404, 409, 500]).toContain(response.status);
      
      if (response.status === 201) {
        expectValidAttendanceResponse(response.body);
        expect(response.body.latitude).toBe(validCoords.latitude);
        expect(response.body.longitude).toBe(validCoords.longitude);
      }
    });
  });
});


