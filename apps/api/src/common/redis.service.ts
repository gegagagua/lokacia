import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ENV, type Env } from '../config/env';

/** Redis with an in-memory fallback so dev/test work without Redis. */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger('Redis');
  readonly client: Redis | null;
  private readonly memory = new Map<string, { value: string; expiresAt: number }>();
  available = false;

  constructor(@Inject(ENV) private readonly env: Env) {
    if (env.NODE_ENV === 'test' || env.QUEUE_DRIVER === 'inline') {
      this.client = null;
      return;
    }
    this.client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: false, enableOfflineQueue: true });
    this.client.on('ready', () => (this.available = true));
    this.client.on('error', (e) => {
      if (this.available) this.logger.warn(`redis error: ${e.message}`);
      this.available = false;
    });
  }

  /** Fixed-window counter. Returns the new count. */
  async incr(key: string, ttlSeconds: number): Promise<number> {
    if (this.client && this.available) {
      const n = await this.client.incr(key);
      if (n === 1) await this.client.expire(key, ttlSeconds);
      return n;
    }
    const now = Date.now();
    const cur = this.memory.get(key);
    const next = !cur || cur.expiresAt < now ? 1 : Number(cur.value) + 1;
    this.memory.set(key, { value: String(next), expiresAt: cur && cur.expiresAt >= now ? cur.expiresAt : now + ttlSeconds * 1000 });
    return next;
  }

  async get(key: string): Promise<string | null> {
    if (this.client && this.available) return this.client.get(key);
    const cur = this.memory.get(key);
    return cur && cur.expiresAt > Date.now() ? cur.value : null;
  }

  async set(key: string, value: string, ttlSeconds: number) {
    if (this.client && this.available) {
      await this.client.set(key, value, 'EX', ttlSeconds);
      return;
    }
    this.memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string) {
    if (this.client && this.available) await this.client.del(key);
    this.memory.delete(key);
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => undefined);
  }
}

@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  /** Throws 429 problem when `limit` is exceeded within `windowSeconds`. */
  async hit(bucket: string, limit: number, windowSeconds: number): Promise<{ count: number; remaining: number }> {
    const count = await this.redis.incr(`rl:${bucket}:${Math.floor(Date.now() / 1000 / windowSeconds)}`, windowSeconds);
    if (count > limit) {
      const { problems } = await import('./problem');
      throw problems.tooMany();
    }
    return { count, remaining: limit - count };
  }
}
