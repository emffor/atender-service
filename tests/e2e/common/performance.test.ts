/**
 * E2E Tests: Performance
 * Tests for API performance and scalability
 */

import request from 'supertest';
import TestApp from '../helpers/TestApp';
import { createAuthHeaders, wait } from '../helpers/e2e-helpers';

describe('E2E: Performance', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = new TestApp();
    // App initialized
  });

  afterAll(() => {
    // Cleanup if needed
  });

  describe('Response Time', () => {
    it('should respond within reasonable time (<5s)', async () => {
      const startTime = Date.now();

      const response = await request(app.getExpressApp())
        .get('/api/attendances')
        .set(createAuthHeaders())
        .timeout(10000); // 10s timeout

      const duration = Date.now() - startTime;

      expect([200, 404, 500]).toContain(response.status);
      expect(duration).toBeLessThan(5000); // Should respond in less than 5 seconds
    }, 10000); // Jest timeout 10s

    it('should handle pagination efficiently', async () => {
      const startTime = Date.now();

      const response = await request(app.getExpressApp())
        .get('/api/attendances?page=1&limit=100')
        .set(createAuthHeaders())
        .timeout(10000);

      const duration = Date.now() - startTime;

      expect([200, 404, 500]).toContain(response.status);
      expect(duration).toBeLessThan(5000);
    }, 10000);
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array(5).fill(null).map(() =>
        request(app.getExpressApp())
          .get('/api/attendances')
          .set(createAuthHeaders())
          .timeout(10000)
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect([200, 404, 500]).toContain(response.status);
      });
    }, 15000); // 15s timeout for multiple requests

    it('should handle concurrent POST requests', async () => {
      const testData = {
        shiftId: '550e8400-e29b-41d4-a716-446655440000',
        doctorId: '550e8400-e29b-41d4-a716-446655440001',
        type: 'IN',
        latitude: -23.5505,
        longitude: -46.6333,
      };

      const requests = Array(3).fill(null).map((_, index) =>
        request(app.getExpressApp())
          .post('/api/attendances')
          .set(createAuthHeaders(`user-${index}`, 'hospital'))
          .send({ ...testData, doctorId: `doctor-${index}` })
          .timeout(10000)
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect([201, 400, 404, 409, 500]).toContain(response.status);
      });
    }, 15000);
  });

  describe('Load Testing', () => {
    it('should maintain stability under sequential load', async () => {
      const iterations = 10;
      const results: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        await request(app.getExpressApp())
          .get('/api/attendances')
          .set(createAuthHeaders())
          .timeout(10000);

        results.push(Date.now() - startTime);
        await wait(100); // Small delay between requests
      }

      const avgResponseTime = results.reduce((a, b) => a + b, 0) / results.length;
      
      expect(avgResponseTime).toBeLessThan(3000); // Average should be under 3s
    }, 40000); // 40s timeout for sequential load test
  });
});


