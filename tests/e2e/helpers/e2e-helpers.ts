/**
 * E2E Test Helpers
 * Shared utilities for end-to-end tests
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Creates authentication headers for API requests
 */
export const createAuthHeaders = (userId: string = 'test-user-id', role: string = 'hospital') => ({
  'x-user-id': userId,
  'x-user-role': role,
  'Content-Type': 'application/json',
});

/**
 * Creates test attendance data
 */
export const createTestAttendanceData = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  shiftId: overrides.shiftId || uuidv4(),
  doctorId: overrides.doctorId || uuidv4(),
  type: overrides.type || 'IN',
  latitude: overrides.latitude ?? -23.5505,
  longitude: overrides.longitude ?? -46.6333,
  photoUrl: overrides.photoUrl || 'https://example.com/photo.jpg',
  ...overrides,
});

/**
 * Generates a valid UUID for testing
 */
export const generateTestUUID = (): string => {
  return uuidv4();
};

/**
 * Generates an invalid UUID for testing error cases
 */
export const generateInvalidUUID = (): string => {
  return 'invalid-uuid-123';
};

/**
 * Creates test coordinates
 */
export const createTestCoordinates = (type: 'valid' | 'invalid' | 'far' = 'valid') => {
  switch (type) {
    case 'valid':
      return { latitude: -23.5505, longitude: -46.6333 }; // São Paulo
    case 'invalid':
      return { latitude: 999, longitude: 999 }; // Invalid coordinates
    case 'far':
      return { latitude: -22.9068, longitude: -43.1729 }; // Rio de Janeiro (far from SP)
    default:
      return { latitude: -23.5505, longitude: -46.6333 };
  }
};

/**
 * Wait for a specified time (useful for async operations)
 */
export const wait = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Creates query parameters string
 */
export const createQueryParams = (params: Record<string, unknown>): string => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query.append(key, String(value));
    }
  });
  return query.toString();
};

/**
 * Validates response structure
 */
export const expectValidAttendanceResponse = (attendance: Record<string, unknown>) => {
  expect(attendance).toHaveProperty('id');
  expect(attendance).toHaveProperty('shiftId');
  expect(attendance).toHaveProperty('doctorId');
  expect(attendance).toHaveProperty('type');
  expect(attendance).toHaveProperty('status');
  expect(['IN', 'OUT']).toContain(attendance.type);
  expect(['PENDING', 'APPROVED', 'REJECTED']).toContain(attendance.status);
};

/**
 * Validates error response structure
 */
export const expectValidErrorResponse = (response: { body: Record<string, unknown> }) => {
  expect(response.body).toHaveProperty('error');
  expect(typeof response.body.error).toBe('string');
};

/**
 * Validates paginated response structure
 */
export const expectValidPaginatedResponse = (response: { body: Record<string, unknown> }) => {
  expect(response.body).toHaveProperty('data');
  expect(response.body).toHaveProperty('pagination');
  expect(Array.isArray(response.body.data)).toBe(true);
  expect(response.body.pagination).toHaveProperty('page');
  expect(response.body.pagination).toHaveProperty('limit');
  expect(response.body.pagination).toHaveProperty('total');
};
