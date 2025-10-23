import { Request, Response } from 'express';
import { AppDataSource } from '@/config/database';
import { BaseRoutes } from './BaseRoutes';
import { rabbitMQ } from '@/messaging/RabbitMQConnection';
import { redisCache } from '@/services/cache/RedisCache';

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  service: string;
  version: string;
  environment: string;
  checks: {
    database: 'connected' | 'disconnected';
    rabbitmq: 'connected' | 'disconnected';
    redis: 'connected' | 'disconnected';
    memory: {
      used: string;
      total: string;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
  };
}

/**
 * Classe de Rotas de Health Check - POO Pattern
 * 
 * Responsabilidades:
 * - Endpoints de health check
 * - Readiness probe
 * - Liveness probe
 * - Monitoramento de infraestrutura
 */
export class HealthRoutes extends BaseRoutes {
  
  /**
   * Inicializar rotas de health check
   */
  protected initializeRoutes(): void {
    this.setupHealthCheckRoutes();
    console.log('✅ [ROUTES] HealthRoutes inicializadas');
  }

  /**
   * Configurar todas as rotas de health check
   */
  private setupHealthCheckRoutes(): void {
    this.router.get('/', this.healthCheck.bind(this));
    this.router.get('/ready', this.readinessProbe.bind(this));
    this.router.get('/live', this.livenessProbe.bind(this));
    
    this.logRoute('GET', '/health', 'Health check completo');
    this.logRoute('GET', '/health/ready', 'Readiness probe');
    this.logRoute('GET', '/health/live', 'Liveness probe');
  }

  /**
   * Health check completo
   */
  private async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Check database connection
      const isDatabaseConnected = AppDataSource.isInitialized;
      
      // Check RabbitMQ connection
      const isRabbitMQConnected = rabbitMQ.isConnected();
      
      // Check Redis connection
      const isRedisConnected = redisCache.getConnectionStatus();

      // Memory usage
      const memoryUsage = process.memoryUsage();
      const totalMemory = memoryUsage.heapTotal;
      const usedMemory = memoryUsage.heapUsed;
      const memoryPercentage = Math.round((usedMemory / totalMemory) * 100);

      // CPU usage (simplified)
      const cpuUsage = process.cpuUsage();
      const cpuPercentage = Math.round((cpuUsage.user + cpuUsage.system) / 1000000);

      const allHealthy = isDatabaseConnected && isRabbitMQConnected && isRedisConnected;

      const healthStatus: HealthStatus = {
        status: allHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        service: 'attendance-service',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        checks: {
          database: isDatabaseConnected ? 'connected' : 'disconnected',
          rabbitmq: isRabbitMQConnected ? 'connected' : 'disconnected',
          redis: isRedisConnected ? 'connected' : 'disconnected',
          memory: {
            used: `${Math.round(usedMemory / 1024 / 1024)}MB`,
            total: `${Math.round(totalMemory / 1024 / 1024)}MB`,
            percentage: memoryPercentage,
          },
          cpu: {
            usage: cpuPercentage,
          },
        },
      };

      const statusCode = allHealthy ? 200 : 503;
      res.status(statusCode).json(healthStatus);
    } catch (error) {
      console.error('❌ Health check failed:', error);
      
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'attendance-service',
        error: 'Health check failed',
      });
    }
  }

  /**
   * Readiness probe - verifica se o serviço está pronto para receber requisições
   */
  private async readinessProbe(req: Request, res: Response): Promise<void> {
    try {
      const isDatabaseReady = AppDataSource.isInitialized;
      const isRabbitMQReady = rabbitMQ.isConnected();
      const isRedisReady = redisCache.getConnectionStatus();
      
      const isReady = isDatabaseReady && isRabbitMQReady;
      
      if (isReady) {
        res.status(200).json({
          ready: true,
          timestamp: new Date().toISOString(),
          service: 'attendance-service',
          checks: {
            database: isDatabaseReady,
            rabbitmq: isRabbitMQReady,
            redis: isRedisReady,
          },
        });
      } else {
        const reasons = [];
        if (!isDatabaseReady) reasons.push('Database not initialized');
        if (!isRabbitMQReady) reasons.push('RabbitMQ not connected');
        
        res.status(503).json({
          ready: false,
          timestamp: new Date().toISOString(),
          service: 'attendance-service',
          reasons,
        });
      }
    } catch (error) {
      res.status(503).json({
        ready: false,
        timestamp: new Date().toISOString(),
        service: 'attendance-service',
        error: 'Readiness check failed',
      });
    }
  }

  /**
   * Liveness probe - verifica se o processo está vivo
   */
  private livenessProbe(req: Request, res: Response): void {
    res.status(200).json({
      alive: true,
      timestamp: new Date().toISOString(),
      service: 'attendance-service',
      uptime: Math.floor(process.uptime()),
      pid: process.pid,
      memory: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      },
    });
  }
}