/**
 * Testes unitários para estratégias de validação de attendance
 * 
 * Testa cada estratégia de validação isoladamente (sem DB)
 */

import {
  CoordinateValidationStrategy,
  GeofenceValidationStrategy,
  TimeWindowValidationStrategy,
  PreviousInValidationStrategy,
  CompositeValidationStrategy,
  ValidationContext,
} from '../../../src/strategies/AttendanceValidationStrategies';
import { Attendance } from '../../../src/entities/Attendance';

describe('AttendanceValidationStrategies', () => {
  // Mock de contexto base para reuso
  const createMockContext = (overrides: Partial<ValidationContext> = {}): ValidationContext => ({
    doctorId: 'doctor-123',
    shiftId: 'shift-456',
    type: 'IN',
    timestamp: new Date('2024-01-15T08:00:00Z'),
    coordinates: { latitude: -23.5505, longitude: -46.6333 },
    shift: {
      id: 'shift-456',
      startTime: new Date('2024-01-15T08:00:00Z'),
      endTime: new Date('2024-01-15T16:00:00Z'),
      value: 1000,
      hospitalId: 'hospital-789',
    },
    policy: {
      maxDistanceMeters: 500,
      outTimeWindowMs: 4 * 60 * 60 * 1000, // 4 horas
      useDistance: true,
      useTimeWindow: true,
    },
    ...overrides,
  });

  describe('CoordinateValidationStrategy', () => {
    let strategy: CoordinateValidationStrategy;

    beforeEach(() => {
      strategy = new CoordinateValidationStrategy();
    });

    it('should return pending status for valid coordinates', async () => {
      const context = createMockContext();
      const result = await strategy.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.status).toBe('PENDING');
      expect(result.autoApprove).toBe(false);
    });

    it('should handle IN type', async () => {
      const context = createMockContext({ type: 'IN' });
      const result = await strategy.validate(context);

      expect(result.isValid).toBe(true);
    });

    it('should handle OUT type', async () => {
      const context = createMockContext({ type: 'OUT' });
      const result = await strategy.validate(context);

      expect(result.isValid).toBe(true);
    });
  });

  describe('GeofenceValidationStrategy', () => {
    let strategy: GeofenceValidationStrategy;

    beforeEach(() => {
      strategy = new GeofenceValidationStrategy();
    });

    it('should auto-approve for excluded doctors', async () => {
      const context = createMockContext({
        doctorId: 'excluded-doctor',
        policy: {
          maxDistanceMeters: 500,
          outTimeWindowMs: 4 * 60 * 60 * 1000,
          useDistance: true,
          useTimeWindow: true,
          excludedMedicIds: ['excluded-doctor'],
        },
      });

      const result = await strategy.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.status).toBe('APPROVED');
      expect(result.autoApprove).toBe(true);
      expect(result.reason).toContain('excluído');
    });

    it('should return pending for normal doctors', async () => {
      const context = createMockContext();
      const result = await strategy.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.status).toBe('PENDING');
      expect(result.autoApprove).toBe(false);
    });

    it('should handle coordinates within geofence', async () => {
      const context = createMockContext({
        coordinates: { latitude: -23.5505, longitude: -46.6333 },
      });

      const result = await strategy.validate(context);

      expect(result.isValid).toBe(true);
    });

    it('should handle empty excluded list', async () => {
      const context = createMockContext({
        policy: {
          maxDistanceMeters: 500,
          outTimeWindowMs: 4 * 60 * 60 * 1000,
          useDistance: true,
          useTimeWindow: true,
          excludedMedicIds: [],
        },
      });

      const result = await strategy.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.autoApprove).toBe(false);
    });
  });

  describe('TimeWindowValidationStrategy', () => {
    let strategy: TimeWindowValidationStrategy;

    beforeEach(() => {
      strategy = new TimeWindowValidationStrategy();
    });

    it('should always pass for IN type', async () => {
      const context = createMockContext({ type: 'IN' });
      const result = await strategy.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.status).toBe('PENDING');
    });

    it('should validate OUT within time window (exactly at shift end)', async () => {
      const shiftEndTime = new Date('2024-01-15T16:00:00Z');
      const context = createMockContext({
        type: 'OUT',
        timestamp: shiftEndTime,
        shift: {
          id: 'shift-456',
          startTime: new Date('2024-01-15T08:00:00Z'),
          endTime: shiftEndTime,
          value: 1000,
          hospitalId: 'hospital-789',
        },
      });

      const result = await strategy.validate(context);

      expect(result.isValid).toBe(true);
    });

    it('should validate OUT within time window (2h after shift end)', async () => {
      const shiftEndTime = new Date('2024-01-15T16:00:00Z');
      const checkoutTime = new Date('2024-01-15T18:00:00Z'); // 2h depois
      
      const context = createMockContext({
        type: 'OUT',
        timestamp: checkoutTime,
        shift: {
          id: 'shift-456',
          startTime: new Date('2024-01-15T08:00:00Z'),
          endTime: shiftEndTime,
          value: 1000,
          hospitalId: 'hospital-789',
        },
        policy: {
          maxDistanceMeters: 500,
          outTimeWindowMs: 4 * 60 * 60 * 1000, // 4 horas
          useDistance: true,
          useTimeWindow: true,
        },
      });

      const result = await strategy.validate(context);

      expect(result.isValid).toBe(true);
    });

    it('should reject OUT outside time window (5h after shift end)', async () => {
      const shiftEndTime = new Date('2024-01-15T16:00:00Z');
      const checkoutTime = new Date('2024-01-15T21:00:00Z'); // 5h depois
      
      const context = createMockContext({
        type: 'OUT',
        timestamp: checkoutTime,
        shift: {
          id: 'shift-456',
          startTime: new Date('2024-01-15T08:00:00Z'),
          endTime: shiftEndTime,
          value: 1000,
          hospitalId: 'hospital-789',
        },
        policy: {
          maxDistanceMeters: 500,
          outTimeWindowMs: 4 * 60 * 60 * 1000, // 4 horas
          useDistance: true,
          useTimeWindow: true,
        },
      });

      const result = await strategy.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('janela de tempo');
    });

    it('should validate OUT before shift end (early checkout)', async () => {
      const shiftEndTime = new Date('2024-01-15T16:00:00Z');
      const checkoutTime = new Date('2024-01-15T14:00:00Z'); // 2h antes
      
      const context = createMockContext({
        type: 'OUT',
        timestamp: checkoutTime,
        shift: {
          id: 'shift-456',
          startTime: new Date('2024-01-15T08:00:00Z'),
          endTime: shiftEndTime,
          value: 1000,
          hospitalId: 'hospital-789',
        },
      });

      const result = await strategy.validate(context);

      // Dentro da janela de 4h (2h antes está OK)
      expect(result.isValid).toBe(true);
    });
  });

  describe('PreviousInValidationStrategy', () => {
    let strategy: PreviousInValidationStrategy;

    beforeEach(() => {
      strategy = new PreviousInValidationStrategy();
    });

    it('should always pass for IN type', async () => {
      const context = createMockContext({ type: 'IN' });
      const result = await strategy.validate(context);

      expect(result.isValid).toBe(true);
    });

    it('should reject OUT when no previous IN exists', async () => {
      const context = createMockContext({
        type: 'OUT',
        existingInPunch: undefined,
      });

      const result = await strategy.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('check-in');
    });

    it('should reject OUT when previous IN is pending', async () => {
      const mockInPunch = {
        id: 'attendance-1',
        status: 'PENDING',
      } as Attendance;

      const context = createMockContext({
        type: 'OUT',
        existingInPunch: mockInPunch,
      });

      const result = await strategy.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('aprovação');
    });

    it('should reject OUT when previous IN is rejected', async () => {
      const mockInPunch = {
        id: 'attendance-1',
        status: 'REJECTED',
      } as Attendance;

      const context = createMockContext({
        type: 'OUT',
        existingInPunch: mockInPunch,
      });

      const result = await strategy.validate(context);

      expect(result.isValid).toBe(false);
    });

    it('should pass OUT when previous IN is approved', async () => {
      const mockInPunch = {
        id: 'attendance-1',
        status: 'APPROVED',
      } as Attendance;

      const context = createMockContext({
        type: 'OUT',
        existingInPunch: mockInPunch,
      });

      const result = await strategy.validate(context);

      expect(result.isValid).toBe(true);
    });
  });

  describe('CompositeValidationStrategy', () => {
    it('should aggregate results from all strategies', async () => {
      const strategies = [
        new CoordinateValidationStrategy(),
        new TimeWindowValidationStrategy(),
      ];

      const composite = new CompositeValidationStrategy(strategies);
      const context = createMockContext({ type: 'IN' });
      const result = await composite.validate(context);

      expect(result.isValid).toBe(true);
    });

    it('should auto-approve when any strategy auto-approves', async () => {
      const strategies = [
        new GeofenceValidationStrategy(),
      ];

      const composite = new CompositeValidationStrategy(strategies);
      const context = createMockContext({
        doctorId: 'excluded-doctor',
        policy: {
          maxDistanceMeters: 500,
          outTimeWindowMs: 4 * 60 * 60 * 1000,
          useDistance: true,
          useTimeWindow: true,
          excludedMedicIds: ['excluded-doctor'],
        },
      });

      const result = await composite.validate(context);

      expect(result.autoApprove).toBe(true);
      expect(result.status).toBe('APPROVED');
    });

    it('should fail if any strategy fails', async () => {
      const strategies = [
        new TimeWindowValidationStrategy(),
        new PreviousInValidationStrategy(),
      ];

      const composite = new CompositeValidationStrategy(strategies);
      const shiftEndTime = new Date('2024-01-15T16:00:00Z');
      const checkoutTime = new Date('2024-01-15T21:00:00Z'); // 5h depois (fora da janela)

      const context = createMockContext({
        type: 'OUT',
        timestamp: checkoutTime,
        shift: {
          id: 'shift-456',
          startTime: new Date('2024-01-15T08:00:00Z'),
          endTime: shiftEndTime,
          value: 1000,
          hospitalId: 'hospital-789',
        },
        existingInPunch: undefined, // Sem IN prévio
      });

      const result = await composite.validate(context);

      expect(result.isValid).toBe(false);
    });

    it('should combine reasons from multiple strategies', async () => {
      const strategies = [
        new TimeWindowValidationStrategy(),
        new PreviousInValidationStrategy(),
      ];

      const composite = new CompositeValidationStrategy(strategies);
      const shiftEndTime = new Date('2024-01-15T16:00:00Z');
      const checkoutTime = new Date('2024-01-15T21:00:00Z');

      const context = createMockContext({
        type: 'OUT',
        timestamp: checkoutTime,
        shift: {
          id: 'shift-456',
          startTime: new Date('2024-01-15T08:00:00Z'),
          endTime: shiftEndTime,
          value: 1000,
          hospitalId: 'hospital-789',
        },
        existingInPunch: undefined,
      });

      const result = await composite.validate(context);

      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('tempo');
    });

    it('should handle empty strategy list', async () => {
      const composite = new CompositeValidationStrategy([]);
      const context = createMockContext();
      const result = await composite.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.status).toBe('PENDING');
    });

    it('should pass when all strategies pass', async () => {
      const mockInPunch = {
        id: 'attendance-1',
        status: 'APPROVED',
      } as Attendance;

      const strategies = [
        new CoordinateValidationStrategy(),
        new GeofenceValidationStrategy(),
        new TimeWindowValidationStrategy(),
        new PreviousInValidationStrategy(),
      ];

      const composite = new CompositeValidationStrategy(strategies);
      const context = createMockContext({
        type: 'OUT',
        timestamp: new Date('2024-01-15T16:00:00Z'),
        existingInPunch: mockInPunch,
      });

      const result = await composite.validate(context);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete check-in flow', async () => {
      const strategies = [
        new CoordinateValidationStrategy(),
        new GeofenceValidationStrategy(),
        new TimeWindowValidationStrategy(),
      ];

      const composite = new CompositeValidationStrategy(strategies);
      const context = createMockContext({
        type: 'IN',
        timestamp: new Date('2024-01-15T07:55:00Z'), // 5 min antes do início
      });

      const result = await composite.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.status).toBe('PENDING');
    });

    it('should handle complete check-out flow with approved IN', async () => {
      const mockInPunch = {
        id: 'attendance-1',
        status: 'APPROVED',
        type: 'IN',
        timestamp: new Date('2024-01-15T08:00:00Z'),
      } as Attendance;

      const strategies = [
        new CoordinateValidationStrategy(),
        new GeofenceValidationStrategy(),
        new TimeWindowValidationStrategy(),
        new PreviousInValidationStrategy(),
      ];

      const composite = new CompositeValidationStrategy(strategies);
      const context = createMockContext({
        type: 'OUT',
        timestamp: new Date('2024-01-15T16:05:00Z'), // 5 min depois do fim
        existingInPunch: mockInPunch,
      });

      const result = await composite.validate(context);

      expect(result.isValid).toBe(true);
    });

    it('should handle late check-in', async () => {
      const strategies = [
        new CoordinateValidationStrategy(),
        new TimeWindowValidationStrategy(),
      ];

      const composite = new CompositeValidationStrategy(strategies);
      const context = createMockContext({
        type: 'IN',
        timestamp: new Date('2024-01-15T09:30:00Z'), // 1.5h atrasado
      });

      const result = await composite.validate(context);

      // IN sempre passa na TimeWindowValidationStrategy
      expect(result.isValid).toBe(true);
    });
  });
});
