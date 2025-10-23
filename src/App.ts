import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AppDataSource } from '@/config/database';
import { errorHandler } from '@/middleware/errorHandler';
import { notFoundHandler } from '@/middleware/notFoundHandler';
import { AttendanceRoutes } from '@/routes/AttendanceRoutes';
import { HealthRoutes } from '@/routes/HealthRoutes';
import { rabbitMQ } from '@/messaging/RabbitMQConnection';
import { redisCache } from '@/services/cache/RedisCache';
import { externalEventConsumer } from '@/events/ExternalEventConsumer';
import { ShiftCacheService } from '@/services/cache/ShiftCacheService';
import { UserCacheService } from '@/services/cache/UserCacheService';
import { attendanceEventPublisher } from '@/events/AttendanceEventPublisher';

// Carregar variáveis de ambiente
dotenv.config();

class AttendanceServiceApp {
  private app: express.Application;
  private readonly port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3003');
    
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // CORS
    this.app.use(cors({
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Trust proxy (for production behind load balancer)
    this.app.set('trust proxy', 1);
  }

  private initializeRoutes(): void {
    console.log('🔄 Inicializando rotas...');
    
    // Health check routes (POO) - sempre disponível
    const healthRoutes = new HealthRoutes();
    this.app.use('/health', healthRoutes.getRouter());
    
    // Se estamos em ambiente de teste E2E e DB não está conectado, não inicializar outras rotas
    if (process.env.NODE_ENV === 'test' && process.env.JEST_WORKER_ID && !AppDataSource.isInitialized) {
      console.log('⚠️  [TEST MODE] DB não inicializado - pulando inicialização de rotas de negócio');
      return;
    }
    
    try {
      // Criar cache services (Singleton pattern)
      const shiftCache = new ShiftCacheService();
      const userCache = new UserCacheService();
      
      // Criar serviços especializados
      const faceService = new (require('@/services/FaceRecognitionService').FaceRecognitionService)();
      const notificationService = new (require('@/services/NotificationService').NotificationService)(attendanceEventPublisher);
      
      // Criar repository
      const AttendanceRepositoryClass = require('@/repositories/AttendanceRepository').AttendanceRepository;
      const attendanceRepository = new AttendanceRepositoryClass();
      
      // API routes com dependency injection (POO)
      const attendanceRoutes = new AttendanceRoutes(
        shiftCache, 
        userCache, 
        attendanceEventPublisher,
        faceService,
        notificationService,
        attendanceRepository
      );
      this.app.use('/v2', attendanceRoutes.getRouter());
      
      console.log('✅ Rotas inicializadas com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar rotas:', error);
      if (process.env.NODE_ENV !== 'test') {
        throw error;
      }
    }

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Attendance Service',
        version: '2.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          attendance: '/v2/attendance',
          docs: '/v2/attendance/docs'
        }
      });
    });
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);
    
    // Error handler (deve ser o último middleware)
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Inicializar banco de dados
      console.log('🔄 Conectando ao banco de dados...');
      await AppDataSource.initialize();
      console.log('✅ Banco de dados conectado com sucesso');

      // Inicializar Redis (opcional)
      console.log('🔄 Conectando ao Redis...');
      await redisCache.connect();

      // Inicializar RabbitMQ
      console.log('🔄 Conectando ao RabbitMQ...');
      await rabbitMQ.connect();

      // Inicializar RabbitMQ Request/Reply Service
      console.log('🔄 Inicializando RabbitMQ Request/Reply Service...');
      const { rabbitMQRequestReply } = await import('./services/RabbitMQRequestReplyService');
      await rabbitMQRequestReply.initialize();

      // Iniciar consumo de eventos externos
      console.log('🔄 Iniciando consumo de eventos externos...');
      await externalEventConsumer.startConsuming();

      // Inicializar servidor
      this.app.listen(this.port, () => {
        console.log(`🚀 Attendance Service rodando na porta ${this.port}`);
        console.log(`🏥 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📊 Health check: http://localhost:${this.port}/health`);
        console.log(`📋 API Base: http://localhost:${this.port}/v2/attendance`);
        console.log(`🐰 RabbitMQ Management: http://localhost:15672`);
        console.log('');
        console.log('🎯 Aguardando eventos de Shift e User via RabbitMQ...');
      });
    } catch (error) {
      console.error('❌ Erro ao inicializar Attendance Service:', error);
      process.exit(1);
    }
  }

  public getApp(): express.Application {
    return this.app;
  }

  /**
   * Método para testes E2E - inicializa infraestrutura sem iniciar servidor HTTP
   */
  public async initialize(): Promise<void> {
    try {
      // Inicializar banco de dados
      console.log('🔄 [TEST] Conectando ao banco de dados...');
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }
      console.log('✅ [TEST] Banco de dados conectado');

      // Inicializar Redis (opcional para testes)
      console.log('🔄 [TEST] Conectando ao Redis...');
      await redisCache.connect();
      console.log('✅ [TEST] Redis conectado');

      console.log('✅ [TEST] Inicialização completa (sem servidor HTTP)');
    } catch (error) {
      console.error('❌ [TEST] Erro ao inicializar:', error);
      throw error;
    }
  }

  /**
   * Método para testes E2E - retorna DataSource do TypeORM
   */
  public getDataSource() {
    return AppDataSource;
  }

  /**
   * Método para testes E2E - retorna app Express (compatibilidade)
   */
  public getExpressApp(): express.Application {
    return this.app;
  }
}

// Inicializar aplicação
if (require.main === module) {
  const app = new AttendanceServiceApp();
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('📴 SIGTERM recebido, encerrando Attendance Service...');
    await gracefulShutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('📴 SIGINT recebido, encerrando Attendance Service...');
    await gracefulShutdown();
    process.exit(0);
  });

  async function gracefulShutdown() {
    try {
      // Fechar RabbitMQ
      await rabbitMQ.close();
      
      // Fechar Redis
      await redisCache.close();
      
      // Fechar banco de dados
      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
      }
      
      console.log('✅ Shutdown graceful concluído');
    } catch (error) {
      console.error('❌ Erro durante shutdown:', error);
    }
  }

  app.start();
}

export default AttendanceServiceApp;