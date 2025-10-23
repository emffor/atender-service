/**
 * Dados de teste compartilhados
 * 
 * IMPORTANTE: Este arquivo contém IDs de shifts e usuários do banco de STAGING
 * que devem existir para os testes funcionarem corretamente.
 * 
 * Antes de rodar os testes, certifique-se de que:
 * 1. O banco medicbank_staging está populado
 * 2. O shift-service tem shifts cadastrados
 * 3. Os IDs abaixo existem no banco
 */

/**
 * Shifts de teste (do banco de staging)
 * 
 * Para obter shifts válidos:
 * ```sql
 * SELECT id, "hospitalId", "doctorId", specialty, "startTime", "endTime", status
 * FROM shift
 * WHERE status = 'open'
 * AND "startTime" >= NOW()
 * LIMIT 5;
 * ```
 */
export const TEST_SHIFTS = {
  // Shift aberto sem médico atribuído
  OPEN_WITHOUT_DOCTOR: {
    id: 'SUBSTITUIR_COM_ID_REAL',
    hospitalId: 'SUBSTITUIR_COM_HOSPITAL_ID_REAL',
    doctorId: null,
    specialty: 'CARDIOLOGIA',
    status: 'open',
  },

  // Shift aberto com médico atribuído
  OPEN_WITH_DOCTOR: {
    id: 'SUBSTITUIR_COM_ID_REAL',
    hospitalId: 'SUBSTITUIR_COM_HOSPITAL_ID_REAL',
    doctorId: 'SUBSTITUIR_COM_DOCTOR_ID_REAL',
    specialty: 'CLINICO_GERAL',
    status: 'open',
  },

  // Shift fechado (para testar rejeição)
  CLOSED: {
    id: 'SUBSTITUIR_COM_ID_REAL',
    hospitalId: 'SUBSTITUIR_COM_HOSPITAL_ID_REAL',
    doctorId: 'SUBSTITUIR_COM_DOCTOR_ID_REAL',
    specialty: 'PEDIATRIA',
    status: 'closed',
  },
};

/**
 * Usuários de teste (do banco de staging)
 * 
 * Para obter usuários válidos:
 * ```sql
 * -- No user-service/base-service
 * SELECT id, email, name, role, status
 * FROM user_auth
 * WHERE status = 'ACTIVE'
 * LIMIT 5;
 * ```
 */
export const TEST_USERS = {
  // Médico ativo
  DOCTOR: {
    id: 'SUBSTITUIR_COM_DOCTOR_ID_REAL',
    role: 'client_medic',
    email: 'doctor.test@medicbank.com',
  },

  // Hospital ativo
  HOSPITAL: {
    id: 'SUBSTITUIR_COM_HOSPITAL_ID_REAL',
    role: 'client_hospital',
    email: 'hospital.test@medicbank.com',
  },

  // Hospital worker
  HOSPITAL_WORKER: {
    id: 'SUBSTITUIR_COM_WORKER_ID_REAL',
    role: 'client_hospital_worker',
    email: 'worker.test@medicbank.com',
  },

  // Admin
  ADMIN: {
    id: 'SUBSTITUIR_COM_ADMIN_ID_REAL',
    role: 'admin',
    email: 'admin.test@medicbank.com',
  },
};

/**
 * Coordenadas de teste (locais conhecidos)
 */
export const TEST_LOCATIONS = {
  // Hospital Sírio-Libanês (São Paulo)
  HOSPITAL_SIRIO: {
    latitude: -23.5889,
    longitude: -46.6564,
    name: 'Hospital Sírio-Libanês',
  },

  // Hospital Albert Einstein (São Paulo)
  HOSPITAL_EINSTEIN: {
    latitude: -23.5969,
    longitude: -46.7172,
    name: 'Hospital Albert Einstein',
  },

  // Localização genérica (centro de São Paulo)
  SAO_PAULO_CENTER: {
    latitude: -23.5505,
    longitude: -46.6333,
    name: 'Centro de São Paulo',
  },

  // Localização fora do geofence (distante)
  FAR_LOCATION: {
    latitude: -22.9068,
    longitude: -43.1729,
    name: 'Rio de Janeiro (distante)',
  },
};

/**
 * Timestamps de teste
 */
export const TEST_TIMESTAMPS = {
  // Função para criar timestamp no horário de início do shift
  onTime: (shiftStartTime: Date): Date => {
    return new Date(shiftStartTime.getTime() - 5 * 60 * 1000); // 5 min antes
  },

  // Função para criar timestamp atrasado
  late: (shiftStartTime: Date, minutesLate = 30): Date => {
    return new Date(shiftStartTime.getTime() + minutesLate * 60 * 1000);
  },

  // Função para criar timestamp de saída no horário
  onTimeOut: (shiftEndTime: Date): Date => {
    return new Date(shiftEndTime.getTime() + 5 * 60 * 1000); // 5 min depois
  },

  // Função para criar timestamp de saída antecipada
  earlyOut: (shiftEndTime: Date, minutesEarly = 30): Date => {
    return new Date(shiftEndTime.getTime() - minutesEarly * 60 * 1000);
  },
};

/**
 * Headers de autenticação para testes
 */
export function createAuthHeaders(userId: string, userRole: string) {
  return {
    'x-user-id': userId,
    'x-user-role': userRole,
    'authorization': `Bearer fake-jwt-token-for-testing`,
  };
}

/**
 * Cria dados de attendance de teste
 */
export function createAttendanceTestData(overrides: {
  shiftId?: string;
  doctorId?: string;
  type?: 'IN' | 'OUT';
  timestamp?: Date;
  latitude?: number;
  longitude?: number;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
} = {}) {
  return {
    shiftId: overrides.shiftId || TEST_SHIFTS.OPEN_WITH_DOCTOR.id,
    doctorId: overrides.doctorId || TEST_USERS.DOCTOR.id,
    type: overrides.type || 'IN',
    timestamp: overrides.timestamp || new Date(),
    latitude: overrides.latitude || TEST_LOCATIONS.SAO_PAULO_CENTER.latitude,
    longitude: overrides.longitude || TEST_LOCATIONS.SAO_PAULO_CENTER.longitude,
    status: overrides.status || 'PENDING',
  };
}

/**
 * Script de setup para popular IDs de teste
 * 
 * Execute este comando para obter IDs válidos do staging:
 * 
 * ```bash
 * # No PostgreSQL
 * psql -U medicbank_user -d medicbank_staging -c "
 *   SELECT 
 *     'export const VALID_SHIFT_ID = ' || quote_literal(id) || ';'
 *   FROM shift 
 *   WHERE status = 'open' 
 *   AND \"startTime\" > NOW() 
 *   LIMIT 1;
 * "
 * ```
 */
