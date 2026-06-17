import type { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface IRateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }>;
}

// ─── In-Memory Store (fallback) ───────────────────────────────────────────────

class InMemoryRateLimitStore implements IRateLimitStore {
  private store = new Map<string, RateLimitEntry>();

  constructor() {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "⚠️  Rate limiter using in-memory store — set REDIS_URL for distributed rate limiting across multiple instances"
      );
    }
    setInterval(() => {
      const now = Date.now();
      for (const [k, v] of this.store) {
        if (now >= v.resetTime) this.store.delete(k);
      }
    }, 60_000);
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const existing = this.store.get(key);
    if (!existing || now >= existing.resetTime) {
      const entry: RateLimitEntry = { count: 1, resetTime: now + windowMs };
      this.store.set(key, entry);
      return entry;
    }
    existing.count += 1;
    return existing;
  }
}

// ─── Redis Store ──────────────────────────────────────────────────────────────

class RedisRateLimitStore implements IRateLimitStore {
  private client: any = null;
  private fallback = new InMemoryRateLimitStore();

  constructor(redisUrl: string) {
    this.connect(redisUrl);
  }

  private async connect(redisUrl: string) {
    try {
      const { default: Redis } = await import("ioredis");
      this.client = new Redis(redisUrl, { enableReadyCheck: true, maxRetriesPerRequest: 1 });
      this.client.on("error", (err: Error) => {
        console.error("Redis rate limiter error:", err.message);
      });
      console.log("✅ Rate limiter connected to Redis");
    } catch (e: any) {
      console.error("❌ Redis unavailable, rate limiter falling back to in-memory:", e.message);
      this.client = null;
    }
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    if (!this.client) return this.fallback.increment(key, windowMs);

    const redisKey = `rl:${key}`;
    const now = Date.now();
    try {
      const pipe = this.client.pipeline();
      pipe.incr(redisKey);
      pipe.pttl(redisKey);
      const results = await pipe.exec() as [[null | Error, number], [null | Error, number]];

      const count = results[0][1] ?? 1;
      let ttlMs = results[1][1] ?? -1;

      if (ttlMs < 0) {
        await this.client.pexpire(redisKey, windowMs);
        ttlMs = windowMs;
      }

      return { count, resetTime: now + ttlMs };
    } catch {
      return this.fallback.increment(key, windowMs);
    }
  }
}

// ─── Singleton store ──────────────────────────────────────────────────────────

let _store: IRateLimitStore | null = null;

function getStore(): IRateLimitStore {
  if (!_store) {
    const redisUrl = process.env.REDIS_URL;
    _store = redisUrl ? new RedisRateLimitStore(redisUrl) : new InMemoryRateLimitStore();
  }
  return _store;
}

// ─── Rate Limiter Factory ─────────────────────────────────────────────────────

export function createRateLimiter(
  windowMs: number,
  maxRequests: number,
  keyGenerator?: (req: Request) => string
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = keyGenerator
      ? keyGenerator(req)
      : req.ip || req.socket.remoteAddress || "unknown";

    try {
      const { count, resetTime } = await getStore().increment(key, windowMs);

      res.setHeader("X-RateLimit-Limit", String(maxRequests));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, maxRequests - count)));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetTime / 1000)));

      if (count > maxRequests) {
        const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
        res.status(429).json({ error: "Too many requests", retryAfter });
        return;
      }
    } catch {
      // Si le rate limiting échoue, laisser passer la requête
    }

    next();
  };
}

// ─── Pre-configured limiters ──────────────────────────────────────────────────

const telegramKeyGen = (req: Request) => {
  const telegramUser = (req as any).telegramUser;
  return telegramUser?.chatId || req.ip || "unknown";
};

export const adminRateLimiter = createRateLimiter(60 * 1000, 5, telegramKeyGen);

export const uploadRateLimiter = createRateLimiter(10 * 60 * 1000, 3, telegramKeyGen);

export const broadcastRateLimiter = createRateLimiter(60 * 60 * 1000, 1, telegramKeyGen);

export const cartRateLimiter = createRateLimiter(60 * 1000, 20, telegramKeyGen);

export const telegramMessageRateLimiter = createRateLimiter(60 * 60 * 1000, 20, telegramKeyGen);
