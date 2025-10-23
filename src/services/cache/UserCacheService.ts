import { redisCache } from './RedisCache';

/**
 * Cached User Data Structure
 */
export interface CachedUser {
  id: string;
  username: string;
  email: string;
  cpfCnpj: string;
  employeeIdentifier?: string;
  role: 'client_hospital_worker' | 'client_hospital' | 'client_medic' | 'collaborator' | 'admin_master' | 'admin_mini' | 'admin_read';
  use2FA: boolean;
  createdAt: Date;
  cachedAt: Date;
}

/**
 * Service para cache de dados de User
 * Mantém dados recebidos via eventos RabbitMQ
 */
export class UserCacheService {
  private readonly CACHE_PREFIX = 'user:';
  private readonly CACHE_TTL = 3600; // 1 hora

  /**
   * Gerar chave de cache
   */
  private getCacheKey(userId: string): string {
    return `${this.CACHE_PREFIX}${userId}`;
  }

  /**
   * Cachear dados de user
   */
  async cacheUser(user: Omit<CachedUser, 'cachedAt'>): Promise<void> {
    try {
      const cachedUser: CachedUser = {
        ...user,
        cachedAt: new Date(),
      };

      const key = this.getCacheKey(user.id);
      const value = JSON.stringify(cachedUser);

      await redisCache.set(key, value, this.CACHE_TTL);
      console.log(`💾 User ${user.id} (${user.username}) cacheado`);
    } catch (error) {
      console.error('❌ Erro ao cachear user:', error);
    }
  }

  /**
   * Buscar user do cache
   */
  async getUserFromCache(userId: string): Promise<CachedUser | null> {
    try {
      const key = this.getCacheKey(userId);
      const cachedData = await redisCache.get(key);

      if (!cachedData) {
        return null;
      }

      const user: CachedUser = JSON.parse(cachedData);
      
      // Converter strings de data para Date objects
      user.createdAt = new Date(user.createdAt);
      user.cachedAt = new Date(user.cachedAt);

      return user;
    } catch (error) {
      console.error(`❌ Erro ao buscar user ${userId} do cache:`, error);
      return null;
    }
  }

  /**
   * Atualizar user no cache
   */
  async updateUserCache(
    userId: string, 
    updates: Partial<Omit<CachedUser, 'id' | 'cachedAt'>>
  ): Promise<void> {
    try {
      const existingUser = await this.getUserFromCache(userId);
      
      if (!existingUser) {
        console.warn(`⚠️ Tentativa de atualizar user ${userId} não encontrado no cache`);
        return;
      }

      const updatedUser: CachedUser = {
        ...existingUser,
        ...updates,
        cachedAt: new Date(),
      };

      await this.cacheUser(updatedUser);
      console.log(`🔄 User ${userId} atualizado no cache`);
    } catch (error) {
      console.error(`❌ Erro ao atualizar user ${userId} no cache:`, error);
    }
  }

  /**
   * Remover user do cache
   */
  async removeUserFromCache(userId: string): Promise<void> {
    try {
      const key = this.getCacheKey(userId);
      await redisCache.del(key);
      console.log(`🗑️ User ${userId} removido do cache`);
    } catch (error) {
      console.error(`❌ Erro ao remover user ${userId} do cache:`, error);
    }
  }

  /**
   * Verificar se user existe no cache
   */
  async isUserCached(userId: string): Promise<boolean> {
    try {
      const key = this.getCacheKey(userId);
      return await redisCache.exists(key);
    } catch (error) {
      console.error(`❌ Erro ao verificar user ${userId} no cache:`, error);
      return false;
    }
  }

  /**
   * Buscar múltiplos users do cache
   */
  async getMultipleUsersFromCache(userIds: string[]): Promise<(CachedUser | null)[]> {
    const promises = userIds.map(id => this.getUserFromCache(id));
    return Promise.all(promises);
  }

  /**
   * Buscar user por username (menos eficiente, usar com parcimônia)
   */
  async getUserByUsernameFromCache(username: string): Promise<CachedUser | null> {
    // Implementação simplificada - em produção considerar índice separado
    console.warn('⚠️ Busca por username no cache é ineficiente');
    return null;
  }

  /**
   * Invalidar cache de user (forçar busca nova)
   */
  async invalidateUserCache(userId: string): Promise<void> {
    await this.removeUserFromCache(userId);
  }

  /**
   * Verificar se user é médico
   */
  async isDoctor(userId: string): Promise<boolean | null> {
    const user = await this.getUserFromCache(userId);
    return user ? user.role === 'client_medic' : null;
  }

  /**
   * Verificar se user é hospital
   */
  async isHospital(userId: string): Promise<boolean | null> {
    const user = await this.getUserFromCache(userId);
    return user ? ['client_hospital', 'client_hospital_worker'].includes(user.role) : null;
  }
}