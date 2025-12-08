/**
 * Rate Limiter for Deno Edge Functions
 * 
 * In-memory rate limiting with sliding window algorithm
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDurationMs?: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
  blockUntil?: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: number | null = null;

  constructor(
    private config: RateLimitConfig
  ) {
    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000) as unknown as number;
  }

  async checkLimit(identifier: string): Promise<{ allowed: boolean; resetIn?: number; reason?: string }> {
    const now = Date.now();
    const entry = this.store.get(identifier);

    // Check if blocked
    if (entry?.blocked && entry.blockUntil && entry.blockUntil > now) {
      return {
        allowed: false,
        resetIn: entry.blockUntil - now,
        reason: `Blocked until ${new Date(entry.blockUntil).toISOString()}`,
      };
    }

    // Reset or create entry
    if (!entry || entry.resetTime <= now) {
      this.store.set(identifier, {
        count: 1,
        resetTime: now + this.config.windowMs,
        blocked: false,
      });
      return { allowed: true };
    }

    // Increment count
    entry.count++;

    // Check if limit exceeded
    if (entry.count > this.config.maxRequests) {
      entry.blocked = true;
      entry.blockUntil = now + (this.config.blockDurationMs || this.config.windowMs * 2);
      
      return {
        allowed: false,
        resetIn: entry.resetTime - now,
        reason: `Rate limit exceeded. ${entry.count} requests in window. Blocked for ${this.config.blockDurationMs || this.config.windowMs * 2}ms`,
      };
    }

    return {
      allowed: true,
      resetIn: entry.resetTime - now,
    };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= now && (!entry.blocked || (entry.blockUntil && entry.blockUntil <= now))) {
        this.store.delete(key);
      }
    }
  }

  getStats(identifier: string) {
    const entry = this.store.get(identifier);
    if (!entry) return null;

    return {
      count: entry.count,
      resetTime: new Date(entry.resetTime).toISOString(),
      blocked: entry.blocked,
      blockUntil: entry.blockUntil ? new Date(entry.blockUntil).toISOString() : null,
    };
  }

  reset(identifier: string): void {
    this.store.delete(identifier);
  }

  destroy(): void {
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// Pre-configured rate limiters
export const rateLimiters = {
  auth: new RateLimiter({
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 60 * 60 * 1000, // 1 hour
  }),
  api: new RateLimiter({
    maxRequests: 60,
    windowMs: 60 * 1000, // 1 minute
    blockDurationMs: 5 * 60 * 1000, // 5 minutes
  }),
  orders: new RateLimiter({
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
    blockDurationMs: 10 * 60 * 1000, // 10 minutes
  }),
};

// Helper to get client identifier from request
export function getClientIdentifier(req: Request): string {
  const ip = req.headers.get('x-forwarded-for') || 
              req.headers.get('x-real-ip') || 
              'unknown';
  return ip.split(',')[0].trim();
}
