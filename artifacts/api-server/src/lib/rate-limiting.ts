import type { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

/**
 * Rate limiter store: IP → { count, resetTime }
 * Utilise la mémoire (en production, utiliser Redis)
 */
const rateLimitStores: Map<string, RateLimitStore> = new Map();

/**
 * Crée un middleware de rate limiting par endpoint
 * @param windowMs - Fenêtre de temps en ms (ex: 60000 = 1 minute)
 * @param maxRequests - Nombre max de requêtes par fenêtre
 * @param keyGenerator - Fonction pour générer la clé (défaut: IP)
 */
export function createRateLimiter(
  windowMs: number,
  maxRequests: number,
  keyGenerator?: (req: Request) => string
) {
  const store: RateLimitStore = {};

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator ? keyGenerator(req) : req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    // Initialiser ou récupérer l'entry
    if (!store[key] || now >= store[key].resetTime) {
      store[key] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    store[key].count += 1;

    // Set headers pour informer le client
    res.setHeader("X-RateLimit-Limit", String(maxRequests));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, maxRequests - store[key].count)));
    res.setHeader(
      "X-RateLimit-Reset",
      String(Math.ceil(store[key].resetTime / 1000))
    );

    // Dépasser la limite
    if (store[key].count > maxRequests) {
      res.status(429).json({
        error: "Too many requests",
        retryAfter: Math.ceil((store[key].resetTime - now) / 1000),
      });
      return;
    }

    next();
  };
}

/**
 * Rate limiter pour les opérations sensibles (admin)
 * Plus strict que le global limiter
 * 5 requêtes par minute par admin
 */
export const adminRateLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  5, // max 5 requests
  (req) => {
    // Utiliser le chatId Telegram si disponible, sinon l'IP
    const telegramUser = (req as any).telegramUser;
    return telegramUser?.chatId || req.ip || "unknown";
  }
);

/**
 * Rate limiter pour les uploads
 * 3 uploads par 10 minutes
 */
export const uploadRateLimiter = createRateLimiter(
  10 * 60 * 1000, // 10 minutes
  3, // max 3 uploads
  (req) => {
    const telegramUser = (req as any).telegramUser;
    return telegramUser?.chatId || req.ip || "unknown";
  }
);

/**
 * Rate limiter pour les broadcasts
 * 1 broadcast par heure
 */
export const broadcastRateLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 heure
  1, // max 1 broadcast
  (req) => {
    const telegramUser = (req as any).telegramUser;
    return telegramUser?.chatId || req.ip || "unknown";
  }
);
