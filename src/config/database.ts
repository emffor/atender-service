import { DataSource } from 'typeorm';
import { Attendance } from '@/entities';

/**
 * Configuração do banco de dados do Attendance Service
 * 
 * IMPORTANTE: Este microserviço possui APENAS a entidade Attendance.
 * Dados de Shift e User são acessados via cache Redis, alimentado por eventos RabbitMQ.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  username: process.env.DATABASE_USERNAME || 'medicbank_user',
  password: process.env.DATABASE_PASSWORD || '',
  database: process.env.DATABASE_NAME || 'medicbank_attendance',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  entities: [Attendance], // Apenas Attendance!
  migrations: ['src/migrations/*.ts'],
  subscribers: ['src/subscribers/*.ts'],
  connectTimeoutMS: 30000,
  extra: {
    connectionLimit: 10,
  },
});