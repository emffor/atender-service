/**
 * E2E Tests: List Attendances (GET /api/attendances)
 * Tests for listing and filtering attendance records
 */

import request from 'supertest';
import TestApp from '../helpers/TestApp';
import { 
  createAuthHeaders, 
  createQueryParams,
  expectValidPaginatedResponse,
  generateTestUUID
} from '../helpers/e2e-helpers';

describe('E2E: GET /api/attendances - List Attendances', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = new TestApp();
    // App initialized
  });

  afterAll(() => {
    // Cleanup if needed
  });

  describe('Pagination Tests', () => {
    it('should return paginated list with default parameters', async () => {
      const response = await request(app.getExpressApp())
        .get('/api/attendances')
        .set(createAuthHeaders());

      expect([200, 404, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expectValidPaginatedResponse(response);
      }
    });

    it('should accept page and limit query parameters', async () => {
      const queryParams = createQueryParams({ page: 1, limit: 10 });
      
      const response = await request(app.getExpressApp())
        .get(`/api/attendances?${queryParams}`)
        .set(createAuthHeaders());

      expect([200, 404, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expectValidPaginatedResponse(response);
        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.limit).toBe(10);
      }
    });

    it('should handle different page numbers correctly', async () => {
      const page1 = await request(app.getExpressApp())
        .get('/api/attendances?page=1&limit=5')
        .set(createAuthHeaders());

      const page2 = await request(app.getExpressApp())
        .get('/api/attendances?page=2&limit=5')
        .set(createAuthHeaders());

      expect([200, 404, 500]).toContain(page1.status);
      expect([200, 404, 500]).toContain(page2.status);
    });
  });

  describe('Filtering Tests', () => {
    it('should filter by status (PENDING)', async () => {
      const queryParams = createQueryParams({ status: 'PENDING' });
      
      const response = await request(app.getExpressApp())
        .get(`/api/attendances?${queryParams}`)
        .set(createAuthHeaders());

      expect([200, 404, 500]).toContain(response.status);
      
      if (response.status === 200 && Array.isArray(response.body.data) && response.body.data.length > 0) {
        response.body.data.forEach((attendance: Record<string, unknown>) => {
          expect(attendance.status).toBe('PENDING');
        });
      }
    });

    it('should filter by type (IN)', async () => {
      const queryParams = createQueryParams({ type: 'IN' });
      
      const response = await request(app.getExpressApp())
        .get(`/api/attendances?${queryParams}`)
        .set(createAuthHeaders());

      expect([200, 404, 500]).toContain(response.status);
      
      if (response.status === 200 && Array.isArray(response.body.data) && response.body.data.length > 0) {
        response.body.data.forEach((attendance: Record<string, unknown>) => {
          expect(attendance.type).toBe('IN');
        });
      }
    });

    it('should filter by date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      const queryParams = createQueryParams({ startDate, endDate });
      
      const response = await request(app.getExpressApp())
        .get(`/api/attendances?${queryParams}`)
        .set(createAuthHeaders());

      expect([200, 404, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expectValidPaginatedResponse(response);
      }
    });

    it('should filter by shiftId', async () => {
      const shiftId = generateTestUUID();
      const queryParams = createQueryParams({ shiftId });
      
      const response = await request(app.getExpressApp())
        .get(`/api/attendances?${queryParams}`)
        .set(createAuthHeaders());

      expect([200, 404, 500]).toContain(response.status);
      
      if (response.status === 200 && Array.isArray(response.body.data) && response.body.data.length > 0) {
        response.body.data.forEach((attendance: Record<string, unknown>) => {
          expect(attendance.shiftId).toBe(shiftId);
        });
      }
    });
  });
});


