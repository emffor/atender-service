/**
 * Script para validar e configurar dados de teste do banco de staging
 * 
 * Este script:
 * 1. Conecta ao banco de staging
 * 2. Verifica se há shifts disponíveis
 * 3. Cria um arquivo com IDs reais para usar nos testes
 * 
 * Execute: npm run setup-test-data
 */

import { AppDataSource } from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

interface ValidShift {
  id: string;
  hospitalId: string;
  doctorId: string | null;
  specialty: string;
  startTime: Date;
  endTime: Date;
  status: string;
}

async function setupTestData() {
  console.log('🔍 Conectando ao banco de staging...');
  
  try {
    await AppDataSource.initialize();
    console.log('✅ Conectado ao banco de staging\n');

    // Buscar shifts disponíveis
    console.log('📋 Buscando shifts disponíveis...');
    const shifts = await AppDataSource.query(`
      SELECT id, "hospitalId", "doctorId", specialty, "startTime", "endTime", status
      FROM shift
      WHERE status = 'open'
      AND "startTime" >= NOW()
      ORDER BY "startTime" ASC
      LIMIT 5
    `) as ValidShift[];

    if (shifts.length === 0) {
      console.error('❌ ERRO: Nenhum shift encontrado no banco de staging!');
      console.log('\n💡 Dica: Execute o shift-service e crie alguns shifts primeiro.');
      process.exit(1);
    }

    console.log(`✅ Encontrados ${shifts.length} shifts disponíveis\n`);

    // Mostrar shifts encontrados
    console.log('📊 Shifts disponíveis:');
    console.log('─'.repeat(80));
    shifts.forEach((shift, index) => {
      console.log(`${index + 1}. ID: ${shift.id}`);
      console.log(`   Hospital: ${shift.hospitalId}`);
      console.log(`   Médico: ${shift.doctorId || 'Não atribuído'}`);
      console.log(`   Especialidade: ${shift.specialty}`);
      console.log(`   Início: ${shift.startTime}`);
      console.log(`   Fim: ${shift.endTime}`);
      console.log(`   Status: ${shift.status}`);
      console.log('─'.repeat(80));
    });

    // Gerar arquivo de configuração
    const testDataContent = generateTestDataFile(shifts);
    const outputPath = path.join(__dirname, '../tests/fixtures/testData.generated.ts');
    
    fs.writeFileSync(outputPath, testDataContent);
    console.log(`\n✅ Arquivo gerado: ${outputPath}`);

    // Gerar resumo
    console.log('\n📝 RESUMO:');
    console.log(`   - Shifts disponíveis: ${shifts.length}`);
    console.log(`   - Shifts com médico: ${shifts.filter(s => s.doctorId).length}`);
    console.log(`   - Shifts sem médico: ${shifts.filter(s => !s.doctorId).length}`);
    console.log(`   - Hospitais únicos: ${new Set(shifts.map(s => s.hospitalId)).size}`);

    console.log('\n✨ Configuração concluída! Agora você pode rodar os testes:');
    console.log('   npm run test:integration');

  } catch (error) {
    console.error('❌ Erro ao configurar dados de teste:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

function generateTestDataFile(shifts: ValidShift[]): string {
  const openWithDoctor = shifts.find(s => s.doctorId !== null);
  const openWithoutDoctor = shifts.find(s => s.doctorId === null);
  const anyShift = shifts[0];

  return `/**
 * Dados de teste gerados automaticamente do banco de staging
 * 
 * ⚠️ ATENÇÃO: Este arquivo é gerado automaticamente.
 * Não edite manualmente! Execute 'npm run setup-test-data' para regenerar.
 * 
 * Gerado em: ${new Date().toISOString()}
 * Total de shifts disponíveis: ${shifts.length}
 */

export const GENERATED_TEST_DATA = {
  /**
   * Shifts disponíveis no staging
   */
  SHIFTS: {
    ${openWithDoctor ? `
    // Shift aberto COM médico atribuído
    OPEN_WITH_DOCTOR: {
      id: '${openWithDoctor.id}',
      hospitalId: '${openWithDoctor.hospitalId}',
      doctorId: '${openWithDoctor.doctorId}',
      specialty: '${openWithDoctor.specialty}',
      startTime: new Date('${openWithDoctor.startTime.toISOString()}'),
      endTime: new Date('${openWithDoctor.endTime.toISOString()}'),
      status: '${openWithDoctor.status}',
    },` : ''}
    ${openWithoutDoctor ? `
    // Shift aberto SEM médico atribuído
    OPEN_WITHOUT_DOCTOR: {
      id: '${openWithoutDoctor.id}',
      hospitalId: '${openWithoutDoctor.hospitalId}',
      doctorId: null,
      specialty: '${openWithoutDoctor.specialty}',
      startTime: new Date('${openWithoutDoctor.startTime.toISOString()}'),
      endTime: new Date('${openWithoutDoctor.endTime.toISOString()}'),
      status: '${openWithoutDoctor.status}',
    },` : ''}

    // Shift genérico (primeiro disponível)
    ANY_SHIFT: {
      id: '${anyShift.id}',
      hospitalId: '${anyShift.hospitalId}',
      doctorId: ${anyShift.doctorId ? `'${anyShift.doctorId}'` : 'null'},
      specialty: '${anyShift.specialty}',
      startTime: new Date('${anyShift.startTime.toISOString()}'),
      endTime: new Date('${anyShift.endTime.toISOString()}'),
      status: '${anyShift.status}',
    },
  },

  /**
   * IDs únicos extraídos dos shifts
   */
  IDS: {
    HOSPITAL_IDS: ${JSON.stringify([...new Set(shifts.map(s => s.hospitalId))], null, 6)},
    DOCTOR_IDS: ${JSON.stringify([...new Set(shifts.map(s => s.doctorId).filter(Boolean))], null, 6)},
    SHIFT_IDS: ${JSON.stringify(shifts.map(s => s.id), null, 6)},
  },

  /**
   * Coordenadas de teste (locais conhecidos)
   */
  LOCATIONS: {
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
  },

  /**
   * Estatísticas
   */
  STATS: {
    totalShifts: ${shifts.length},
    shiftsWithDoctor: ${shifts.filter(s => s.doctorId).length},
    shiftsWithoutDoctor: ${shifts.filter(s => !s.doctorId).length},
    uniqueHospitals: ${new Set(shifts.map(s => s.hospitalId)).size},
    uniqueDoctors: ${new Set(shifts.map(s => s.doctorId).filter(Boolean)).size},
    generatedAt: '${new Date().toISOString()}',
  },
};

/**
 * Helper para criar attendance de teste
 */
export function createTestAttendanceData(overrides: Partial<{
  shiftId: string;
  doctorId: string;
  type: 'IN' | 'OUT';
  timestamp: Date;
  latitude: number;
  longitude: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}> = {}) {
  const defaultShift = GENERATED_TEST_DATA.SHIFTS.OPEN_WITH_DOCTOR || GENERATED_TEST_DATA.SHIFTS.ANY_SHIFT;
  
  return {
    shiftId: overrides.shiftId || defaultShift.id,
    doctorId: overrides.doctorId || defaultShift.doctorId || GENERATED_TEST_DATA.IDS.DOCTOR_IDS[0],
    type: overrides.type || 'IN',
    timestamp: overrides.timestamp || new Date(),
    latitude: overrides.latitude || GENERATED_TEST_DATA.LOCATIONS.SAO_PAULO_CENTER.latitude,
    longitude: overrides.longitude || GENERATED_TEST_DATA.LOCATIONS.SAO_PAULO_CENTER.longitude,
    status: overrides.status || 'PENDING',
  };
}
`;
}

// Executar
setupTestData();
