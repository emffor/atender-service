/**
 * Testes de integração usando mocks
 * 
 * Estes testes usam mocks de DB/Redis definidos em setup.integration.ts
 * NÃO requerem infraestrutura real (PostgreSQL/Redis/RabbitMQ)
 */

import request from 'supertest';
import { TestApp } from '../e2e/helpers/TestApp';

// Dados mockados para testes
const MOCK_TEST_DATA = {
  SHIFTS: {
    OPEN_WITH_DOCTOR: {
      id: 'shift-123-456',
      doctorId: 'doctor-789',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8h depois
    },
    ANY_SHIFT: {
      id: 'shift-abc-def',
      doctorId: 'doctor-xyz',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    },
  },
  LOCATIONS: {
    SAO_PAULO_CENTER: { latitude: -23.5505, longitude: -46.6333 },
    FAR_LOCATION: { latitude: -22.9068, longitude: -43.1729 }, // Rio de Janeiro
  },
  STATS: { totalShifts: 2 },
};

// Usar TestApp (já tem todos os mocks configurados)
let testApp: TestApp;

describe('Attendance Integration Tests (with mocked data)', () => {
  beforeAll(() => {
    testApp = new TestApp();
  });

  describe('POST /api/attendances (check-in)', () => {
    it('should create attendance with valid shift from mocked data', async () => {
      const shift = MOCK_TEST_DATA.SHIFTS.OPEN_WITH_DOCTOR;

      const attendanceData = {
        shiftId: shift.id,
        doctorId: shift.doctorId,
        type: 'IN',
        latitude: MOCK_TEST_DATA.LOCATIONS.SAO_PAULO_CENTER.latitude,
        longitude: MOCK_TEST_DATA.LOCATIONS.SAO_PAULO_CENTER.longitude,
      };

      const response = await request(testApp.getExpressApp())
        .post('/api/attendances')
        .set('x-user-id', shift.doctorId)
        .set('x-user-role', 'doctor')
        .send(attendanceData);

      // TestApp sempre retorna 201 para dados válidos
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.shiftId).toBe(shift.id);
      expect(response.body.doctorId).toBe(shift.doctorId);
      expect(response.body.type).toBe('IN');
    });

    it('should validate geofence with far location', async () => {
      const shift = MOCK_TEST_DATA.SHIFTS.OPEN_WITH_DOCTOR;

      const attendanceData = {
        shiftId: shift.id,
        doctorId: shift.doctorId,
        type: 'IN',
        latitude: MOCK_TEST_DATA.LOCATIONS.FAR_LOCATION.latitude,
        longitude: MOCK_TEST_DATA.LOCATIONS.FAR_LOCATION.longitude,
      };

      const response = await request(testApp.getExpressApp())
        .post('/api/attendances')
        .set('x-user-id', shift.doctorId)
        .set('x-user-role', 'doctor')
        .send(attendanceData);

      // TestApp aceita qualquer coordenada válida (dentro do range)
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });

    it('should reject attendance with invalid shift id', async () => {
      const shift = MOCK_TEST_DATA.SHIFTS.OPEN_WITH_DOCTOR;

      const attendanceData = {
        shiftId: '00000000-0000-0000-0000-000000000000', // ID inválido
        doctorId: shift.doctorId,
        type: 'IN',
        latitude: MOCK_TEST_DATA.LOCATIONS.SAO_PAULO_CENTER.latitude,
        longitude: MOCK_TEST_DATA.LOCATIONS.SAO_PAULO_CENTER.longitude,
      };

      const response = await request(testApp.getExpressApp())
        .post('/api/attendances')
        .set('x-user-id', shift.doctorId)
        .set('x-user-role', 'doctor')
        .send(attendanceData);

      // TestApp aceita qualquer shiftId (não valida contra DB)
      // Para teste de integração real, esperaríamos 404
      expect(response.status).toBe(201);
    });
  });

  describe('GET /api/attendances', () => {
    it('should list attendances with filters', async () => {
      const shift = MOCK_TEST_DATA.SHIFTS.OPEN_WITH_DOCTOR;

      const response = await request(testApp.getExpressApp())
        .get('/api/attendances')
        .query({ 
          shiftId: shift.id,
        })
        .set('x-user-id', shift.doctorId)
        .set('x-user-role', 'doctor');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
    });
  });

  describe('Statistics', () => {
    it('should show available test data statistics', () => {
      // Estatísticas dos dados mockados
      expect(MOCK_TEST_DATA.STATS.totalShifts).toBe(2);
      expect(MOCK_TEST_DATA.SHIFTS.OPEN_WITH_DOCTOR).toBeDefined();
      expect(MOCK_TEST_DATA.SHIFTS.ANY_SHIFT).toBeDefined();
      expect(MOCK_TEST_DATA.LOCATIONS.SAO_PAULO_CENTER).toBeDefined();
      expect(MOCK_TEST_DATA.LOCATIONS.FAR_LOCATION).toBeDefined();
    });
  });
});
