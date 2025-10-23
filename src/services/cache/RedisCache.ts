/**
 * Redis Client para cache
 * 
 * TODO: Instalar dependência redis:
 * npm install redis @types/redis
 */

interface MockRedisClient {
  connect(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<string>;
  setEx(key: string, ttl: number, value: string): Promise<string>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  disconnect(): Promise<void>;
  on(event: string, handler: (error: Error) => void): void;
}

class RedisCache {
  private client?: MockRedisClient;
  private isConnected = false;
  private mockCache: Map<string, string> = new Map(); // Mock temporário

  async connect(): Promise<void> {
    try {
      const redisHost = process.env.REDIS_HOST || 'localhost';
      const redisPort = parseInt(process.env.REDIS_PORT || '6379');
      const redisPassword = process.env.REDIS_PASSWORD;

      // TODO: Descomentar quando instalar redis
      // const { createClient } = await import('redis');
      // this.client = createClient({
      //   socket: { host: redisHost, port: redisPort },
      //   password: redisPassword,
      // });

      // Mock temporário
      this.client = {
        connect: async () => console.log('📦 [MOCK] Redis conectado (usando Map)'),
        get: async (key: string) => this.mockCache.get(key) || null,
        set: async (key: string, value: string) => {
          this.mockCache.set(key, value);
          return 'OK';
        },
        setEx: async (key: string, ttl: number, value: string) => {
          this.mockCache.set(key, value);
          // Mock não implementa TTL real, mas aceita o parâmetro
          return 'OK';
        },
        del: async (key: string) => {
          this.mockCache.delete(key);
          return 1;
        },
        exists: async (key: string) => {
          return this.mockCache.has(key) ? 1 : 0;
        },
        disconnect: async () => console.log('📦 [MOCK] Redis desconectado'),
        on: (_event: string, _handler: (error: Error) => void) => {
          // Mock event handler - não faz nada
        },
      };

      await this.client!.connect();
      this.isConnected = true;
      console.log('✅ Redis conectado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao conectar Redis:', error);
      // Não é crítico, pode funcionar sem cache
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.isConnected || !this.client) return;

    try {
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      console.error(`❌ Erro ao salvar no Redis (${key}):`, error);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected || !this.client) return null;

    try {
      return await this.client.get(key);
    } catch (error) {
      console.error(`❌ Erro ao buscar do Redis (${key}):`, error);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected || !this.client) return;

    try {
      await this.client.del(key);
    } catch (error) {
      console.error(`❌ Erro ao deletar do Redis (${key}):`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`❌ Erro ao verificar existência no Redis (${key}):`, error);
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
      console.log('✅ Redis desconectado');
    }
  }

  /**
   * Verificar se está conectado
   */
  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export const redisCache = new RedisCache();