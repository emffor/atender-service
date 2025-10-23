import { redisCache } from './RedisCache';

/**
 * Cached Shift Data Structure
 */
export interface CachedShift {
  id: string;
  hospitalId: string;
  doctorId?: string;
  value: number;
  finalValue?: number;
  specialty: string;
  startTime: Date;
  endTime: Date;
  status: 'open' | 'closed';
  healthUnitId?: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedAt?: Date;
  approvedBy?: string;
  createdAt: Date;
  cachedAt: Date;
}

/**
 * Cached Hospital Data Structure
 * TODO: Mover para HospitalCacheService quando disponível
 */
export interface CachedHospital {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  cachedAt: Date;
}

/**
 * Service para cache de dados de Shift
 * Mantém dados recebidos via eventos RabbitMQ
 */
export class ShiftCacheService {
  private readonly CACHE_PREFIX = 'shift:';
  private readonly CACHE_TTL = 3600; // 1 hora

  /**
   * Gerar chave de cache
   */
  private getCacheKey(shiftId: string): string {
    return `${this.CACHE_PREFIX}${shiftId}`;
  }

  /**
   * Cachear dados de shift
   */
  async cacheShift(shift: Omit<CachedShift, 'cachedAt'>): Promise<void> {
    try {
      const cachedShift: CachedShift = {
        ...shift,
        cachedAt: new Date(),
      };

      const key = this.getCacheKey(shift.id);
      const value = JSON.stringify(cachedShift);

      await redisCache.set(key, value, this.CACHE_TTL);
      console.log(`💾 Shift ${shift.id} cacheado`);
    } catch (error) {
      console.error('❌ Erro ao cachear shift:', error);
    }
  }

  /**
   * Buscar shift do cache
   */
  async getShiftFromCache(shiftId: string): Promise<CachedShift | null> {
    try {
      const key = this.getCacheKey(shiftId);
      const cachedData = await redisCache.get(key);

      if (!cachedData) {
        return null;
      }

      const shift: CachedShift = JSON.parse(cachedData);
      
      // Converter strings de data para Date objects
      shift.startTime = new Date(shift.startTime);
      shift.endTime = new Date(shift.endTime);
      shift.createdAt = new Date(shift.createdAt);
      shift.cachedAt = new Date(shift.cachedAt);
      
      if (shift.approvedAt) {
        shift.approvedAt = new Date(shift.approvedAt);
      }

      return shift;
    } catch (error) {
      console.error(`❌ Erro ao buscar shift ${shiftId} do cache:`, error);
      return null;
    }
  }

  /**
   * Atualizar shift no cache
   */
  async updateShiftCache(
    shiftId: string, 
    updates: Partial<Omit<CachedShift, 'id' | 'cachedAt'>>
  ): Promise<void> {
    try {
      const existingShift = await this.getShiftFromCache(shiftId);
      
      if (!existingShift) {
        console.warn(`⚠️ Tentativa de atualizar shift ${shiftId} não encontrado no cache`);
        return;
      }

      const updatedShift: CachedShift = {
        ...existingShift,
        ...updates,
        cachedAt: new Date(),
      };

      await this.cacheShift(updatedShift);
      console.log(`🔄 Shift ${shiftId} atualizado no cache`);
    } catch (error) {
      console.error(`❌ Erro ao atualizar shift ${shiftId} no cache:`, error);
    }
  }

  /**
   * Remover shift do cache
   */
  async removeShiftFromCache(shiftId: string): Promise<void> {
    try {
      const key = this.getCacheKey(shiftId);
      await redisCache.del(key);
      console.log(`🗑️ Shift ${shiftId} removido do cache`);
    } catch (error) {
      console.error(`❌ Erro ao remover shift ${shiftId} do cache:`, error);
    }
  }

  /**
   * Verificar se shift existe no cache
   */
  async isShiftCached(shiftId: string): Promise<boolean> {
    try {
      const key = this.getCacheKey(shiftId);
      return await redisCache.exists(key);
    } catch (error) {
      console.error(`❌ Erro ao verificar shift ${shiftId} no cache:`, error);
      return false;
    }
  }

  /**
   * Buscar múltiplos shifts do cache
   */
  async getMultipleShiftsFromCache(shiftIds: string[]): Promise<(CachedShift | null)[]> {
    const promises = shiftIds.map(id => this.getShiftFromCache(id));
    return Promise.all(promises);
  }

  /**
   * Invalidar cache de shift (forçar busca nova)
   */
  async invalidateShiftCache(shiftId: string): Promise<void> {
    await this.removeShiftFromCache(shiftId);
  }

  /**
   * Buscar hospital do cache (dados embedados no shift)
   * TODO: Implementar cache separado de Hospital quando disponível
   */
  async getHospitalFromCache(hospitalId: string): Promise<CachedHospital | null> {
    // Por enquanto, retornar null
    // Futuramente, teremos um HospitalCacheService dedicado
    console.warn('[ShiftCacheService] Hospital cache not implemented yet');
    return null;
  }

  /**
   * Buscar shifts por hospital
   * TODO: Implementar índice secundário quando necessário
   */
  async getShiftsByHospital(hospitalId: string): Promise<CachedShift[]> {
    // Por enquanto, método stub
    // Futuramente, implementar com índice secundário no Redis
    console.warn('[ShiftCacheService] getShiftsByHospital not fully implemented yet');
    return [];
  }
}