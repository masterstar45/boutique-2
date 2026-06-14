import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";

const configuredOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const inferredOrigins = [
  process.env.MINI_APP_URL,
  process.env.APP_URL,
  process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : undefined,
]
  .filter((origin): origin is string => !!origin)
  .map((origin) => origin.replace(/\/+$/, ""));

const allowedOrigins = new Set<string>([...configuredOrigins, ...inferredOrigins]);

// Log les origines configurées
if (allowedOrigins.size > 0) {
  logger.info(
    { origins: Array.from(allowedOrigins) },
    "✅ CORS origins configured"
  );
} else {
  logger.warn("⚠️  No CORS origins configured - requests without Origin will be rejected in production");
}

const ipRateState = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 120;

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  
  if (isProduction) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://telegram.org https://challenges.cloudflare.com; img-src 'self' data: https:; font-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.telegram.org https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com"
    );
  }
  
  next();
});

app.use(cors({
  origin(origin, callback) {
    // Requests sans Origin header (ex: same-origin ou certaines requêtes server)
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/+$/, "");

    // Vérifier si l'origine est allowée
    if (isProduction && allowedOrigins.size > 0) {
      // En production STRICTE: vérifier la liste
      if (allowedOrigins.has(normalizedOrigin)) {
        return callback(null, true);
      }
      // Origin non autorisée - rejeter silencieusement
      logger.warn(
        { origin: normalizedOrigin, ip: (this as any).ip },
        "❌ CORS origin rejected"
      );
      return callback(new Error("Origin not allowed"));
    }

    // En développement: accepter tout
    if (!isProduction) {
      return callback(null, true);
    }

    // En production sans CORS_ORIGINS configurées: rejeter
    callback(new Error("CORS not configured"));
  },
}));

app.use((req, res, next) => {
  if (!isProduction) {
    next();
    return;
  }

  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const current = ipRateState.get(ip);

  if (!current || now - current.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipRateState.set(ip, { count: 1, windowStart: now });
    next();
    return;
  }

  current.count += 1;
  if (current.count > RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({ message: "Too many requests" });
    return;
  }

  next();
});

app.use(express.json({
  limit: "2mb",
  verify: (req, _res, buf) => {
    if (req.originalUrl?.startsWith("/api/telegram/webhook")) {
      (req as any).rawBody = buf.toString("utf-8");
    }
  },
}));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  const staticPath = path.resolve(__dirname, "../../boutique/dist/public");
  app.use(express.static(staticPath));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });
}

export default app;
