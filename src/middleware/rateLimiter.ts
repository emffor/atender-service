import { Request, Response, NextFunction } from 'express';

/**
 * Opções de configuração do Rate Limiter
 */
export interface RateLimitOptions {
  /** Janela de tempo em milissegundos */
  windowMs: number;
  /** Máximo de requisições permitidas na janela */
  maxRequests: number;
  /** Mensagem personalizada quando limite excedido */
  message?: string;
  /** Nome do limitador (para identificação nos logs) */
  name?: string;
  /** Prefixo da chave */
  keyPrefix?: string;
  /** Lista de IPs para whitelist (bypass do rate limit) */
  whitelist?: string[];
}

/**
 * Informações do rate limit para um IP
 */
export interface RateLimitInfo {
  totalRequests: number;
  remainingRequests: number;
  resetTime: Date;
  limit: number;
  windowMs: number;
}

/**
 * Normaliza IP removendo prefixo IPv6-mapped IPv4 e tratando variações
 */
function normalizeIP(ip: string): string {
  // Remove ::ffff: prefix (IPv6-mapped IPv4)
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  
  // Normaliza localhost variations
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
    return '127.0.0.1';
  }
  
  // Remove zona de escopo IPv6 (ex: fe80::1%eth0 -> fe80::1)
  const zoneIndex = ip.indexOf('%');
  if (zoneIndex !== -1) {
    return ip.substring(0, zoneIndex);
  }
  
  return ip;
}

/**
 * Rate Limiter baseado em memória com sliding window correto
 * Usa timestamps individuais para evitar contabilização múltipla
 */
export class RateLimiter {
  private options: Required<Omit<RateLimitOptions, 'whitelist'>> & {
    whitelist: string[];
  };

  // Store: Map<IP, Array<timestamp>>
  private static store = new Map<string, number[]>();
  
  // Cleanup interval para remover IPs inativos
  private static cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: RateLimitOptions) {
    this.options = {
      windowMs: options.windowMs,
      maxRequests: options.maxRequests,
      message: options.message || 'Too many requests, please try again later.',
      name: options.name || 'rate-limiter',
      keyPrefix: options.keyPrefix || 'rate_limit',
      whitelist: options.whitelist || [],
    };

    // Iniciar limpeza automática se ainda não foi iniciada
    if (!RateLimiter.cleanupInterval) {
      RateLimiter.startCleanup();
    }
  }

  /**
   * Inicia processo de limpeza automática a cada 5 minutos
   */
  private static startCleanup(): void {
    RateLimiter.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      
      for (const [key, timestamps] of RateLimiter.store.entries()) {
        // Remove IPs sem atividade há mais de 1 hora
        const hasRecentActivity = timestamps.some(ts => now - ts < 60 * 60 * 1000);
        
        if (!hasRecentActivity) {
          RateLimiter.store.delete(key);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        console.log(`🧹 [RATE LIMIT] Limpeza automática: ${cleaned} IPs inativos removidos`);
      }
    }, 5 * 60 * 1000); // 5 minutos
  }

  /**
   * Extrai e normaliza IP do cliente considerando proxies e load balancers
   */
  private getClientIP(req: Request): string {
    // Prioridade: CF-Connecting-IP > X-Real-IP > X-Forwarded-For > req.ip
    const cfIP = req.headers['cf-connecting-ip'] as string;
    const realIP = req.headers['x-real-ip'] as string;
    const forwarded = req.headers['x-forwarded-for'] as string;

    let ip: string;

    if (cfIP) {
      ip = cfIP;
    } else if (realIP) {
      ip = realIP;
    } else if (forwarded) {
      // X-Forwarded-For pode conter múltiplos IPs: "client, proxy1, proxy2"
      ip = forwarded.split(',')[0].trim();
    } else {
      ip = req.ip || req.socket.remoteAddress || 'unknown';
    }

    return normalizeIP(ip);
  }

  /**
   * Verifica se IP deve bypass o rate limit
   */
  private shouldBypass(ip: string): boolean {
    // Ambiente de desenvolvimento/test
    const env = process.env.NODE_ENV || 'development';
    if (['development', 'test', 'staging'].includes(env)) {
      return true;
    }

    // IP na whitelist (já normalizado)
    if (this.options.whitelist.some(whitelistedIP => normalizeIP(whitelistedIP) === ip)) {
      return true;
    }

    // IPs locais
    if (ip === '127.0.0.1' || ip === 'localhost' || ip === '::1') {
      return true;
    }

    // Ranges de IPs privados (RFC 1918)
    if (
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
    ) {
      return true;
    }

    // IPv6 private addresses
    if (
      ip.startsWith('fc00:') || // Unique Local Addresses
      ip.startsWith('fd00:') ||
      ip.startsWith('fe80:')    // Link-Local
    ) {
      return true;
    }

    return false;
  }

  /**
   * Gera chave única para o IP
   */
  private getKey(ip: string): string {
    return `${this.options.keyPrefix}:${this.options.name}:${ip}`;
  }

  /**
   * Remove timestamps fora da janela de tempo (cleanup)
   */
  private cleanupTimestamps(timestamps: number[], windowStart: number): number[] {
    return timestamps.filter(ts => ts > windowStart);
  }

  /**
   * Obtém informações atuais do rate limit (NÃO incrementa contador)
   */
  async getRateLimitInfo(ip: string): Promise<RateLimitInfo> {
    try {
      const now = Date.now();
      const windowStart = now - this.options.windowMs;
      const key = this.getKey(ip);

      // Obter timestamps
      const timestamps = RateLimiter.store.get(key) || [];
      
      // Filtrar apenas timestamps válidos (dentro da janela)
      const validTimestamps = this.cleanupTimestamps(timestamps, windowStart);
      
      // Atualizar store com timestamps limpos (sem incrementar)
      if (validTimestamps.length > 0) {
        RateLimiter.store.set(key, validTimestamps);
      } else {
        RateLimiter.store.delete(key);
      }

      const resetTime = new Date(now + this.options.windowMs);

      return {
        totalRequests: validTimestamps.length,
        remainingRequests: Math.max(0, this.options.maxRequests - validTimestamps.length),
        resetTime,
        limit: this.options.maxRequests,
        windowMs: this.options.windowMs,
      };
    } catch (error) {
      console.error(`❌ [RATE LIMIT ${this.options.name}] Erro ao consultar info:`, error);
      // Fail-open em caso de erro
      return {
        totalRequests: 0,
        remainingRequests: this.options.maxRequests,
        resetTime: new Date(Date.now() + this.options.windowMs),
        limit: this.options.maxRequests,
        windowMs: this.options.windowMs,
      };
    }
  }

  /**
   * Incrementa contador APENAS UMA VEZ por requisição
   * Retorna o novo total de requests
   */
  private incrementCounter(ip: string): number {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    const key = this.getKey(ip);

    // Obter timestamps atuais
    const timestamps = RateLimiter.store.get(key) || [];
    
    // Remover timestamps fora da janela
    const validTimestamps = this.cleanupTimestamps(timestamps, windowStart);
    
    // Adicionar novo timestamp ÚNICO para esta requisição
    validTimestamps.push(now);
    
    // Atualizar store
    RateLimiter.store.set(key, validTimestamps);
    
    return validTimestamps.length;
  }

  /**
   * Middleware Express de rate limiting
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const ip = this.getClientIP(req);

        // Verificar bypass
        if (this.shouldBypass(ip)) {
          res.set({
            'X-RateLimit-Limit': this.options.maxRequests.toString(),
            'X-RateLimit-Remaining': this.options.maxRequests.toString(),
            'X-RateLimit-Bypass': 'true',
          });
          return next();
        }

        // IMPORTANTE: Obter info ANTES de incrementar
        const rateLimitInfo = await this.getRateLimitInfo(ip);

        // Verificar se JÁ excedeu limite (antes de incrementar)
        if (rateLimitInfo.totalRequests >= this.options.maxRequests) {
          console.warn(
            `🚫 [RATE LIMIT ${this.options.name}] IP ${ip} excedeu limite ` +
            `(${rateLimitInfo.totalRequests}/${this.options.maxRequests})`
          );

          res.set({
            'X-RateLimit-Limit': this.options.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(rateLimitInfo.resetTime.getTime() / 1000).toString(),
            'X-RateLimit-Window-Ms': this.options.windowMs.toString(),
          });

          res.status(429).json({
            error: 'Too Many Requests',
            message: this.options.message,
            limit: this.options.maxRequests,
            remaining: 0,
            resetTime: rateLimitInfo.resetTime.toISOString(),
            retryAfter: Math.ceil((rateLimitInfo.resetTime.getTime() - Date.now()) / 1000),
          });
          return;
        }

        // Incrementar contador APENAS UMA VEZ
        const newCount = this.incrementCounter(ip);
        const remaining = Math.max(0, this.options.maxRequests - newCount);

        // Adicionar headers informativos (após incremento)
        res.set({
          'X-RateLimit-Limit': this.options.maxRequests.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': Math.ceil(rateLimitInfo.resetTime.getTime() / 1000).toString(),
          'X-RateLimit-Window-Ms': this.options.windowMs.toString(),
        });

        // Log apenas para volumes significativos (evitar spam)
        if (newCount % 50 === 0 && newCount > 0) {
          console.log(
            `📊 [RATE LIMIT ${this.options.name}] IP ${ip}: ` +
            `${newCount}/${this.options.maxRequests} requisições`
          );
        }

        next();
      } catch (error) {
        console.error(`❌ [RATE LIMIT ${this.options.name}] Erro no middleware:`, error);
        // Fail-open: permitir requisição em caso de erro
        next();
      }
    };
  }

  /**
   * Para testes: limpa todo o store
   */
  static clearAll(): void {
    RateLimiter.store.clear();
  }

  /**
   * Para cleanup: para o intervalo de limpeza
   */
  static stopCleanup(): void {
    if (RateLimiter.cleanupInterval) {
      clearInterval(RateLimiter.cleanupInterval);
      RateLimiter.cleanupInterval = null;
    }
  }
}


// ===== INSTÂNCIAS PRÉ-CONFIGURADAS =====

/**
 * Rate limiter global: 1000 requisições por minuto
 */
export const globalRateLimit = new RateLimiter({
  name: 'global',
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 1000,
  message: 'Limite global de requisições excedido. Tente novamente em 1 minuto.',
});

/**
 * Rate limiter para APIs sensíveis: 10 requisições por minuto
 */
export const sensitiveApiRateLimit = new RateLimiter({
  name: 'sensitive-api',
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 10,
  message: 'Muitas tentativas em API sensível. Aguarde 1 minuto.',
});

/**
 * Rate limiter para upload: 20 uploads por hora
 */
export const uploadRateLimit = new RateLimiter({
  name: 'upload',
  windowMs: 60 * 60 * 1000, // 1 hora
  maxRequests: 20,
  message: 'Limite de uploads excedido. Tente novamente em 1 hora.',
});

/**
 * Rate limiter para attendance: 100 registros por minuto
 */
export const attendanceRateLimit = new RateLimiter({
  name: 'attendance',
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 100,
  message: 'Muitos registros de presença. Aguarde 1 minuto.',
});

// ===== FUNÇÕES UTILITÁRIAS =====

/**
 * Reseta contador de rate limit para um IP específico
 */
export async function resetRateLimitForIP(ip: string, limiterName = 'global'): Promise<void> {
  try {
    const normalizedIP = normalizeIP(ip);
    const key = `rate_limit:${limiterName}:${normalizedIP}`;
    RateLimiter['store'].delete(key);
    console.log(`✅ [RATE LIMIT] Contador resetado: ${limiterName} para IP ${normalizedIP}`);
  } catch (error) {
    console.error('❌ [RATE LIMIT] Erro ao resetar:', error);
  }
}

/**
 * Obtém estatísticas de rate limiting
 */
export async function getRateLimitStats(limiterName = 'global'): Promise<{
  totalActiveIPs: number;
  topIPs: Array<{ ip: string; requests: number }>;
}> {
  try {
    const prefix = `rate_limit:${limiterName}:`;
    const topIPs: Array<{ ip: string; requests: number }> = [];

    // Iterar sobre as chaves do store
    for (const [key, timestamps] of RateLimiter['store'].entries()) {
      if (key.startsWith(prefix)) {
        const ip = key.replace(prefix, '');
        topIPs.push({ ip, requests: timestamps.length });
      }
    }

    topIPs.sort((a, b) => b.requests - a.requests);

    return {
      totalActiveIPs: topIPs.length,
      topIPs: topIPs.slice(0, 10),
    };
  } catch (error) {
    console.error('❌ [RATE LIMIT] Erro ao obter stats:', error);
    return { totalActiveIPs: 0, topIPs: [] };
  }
}

export default RateLimiter;
