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
  res.setHeader("X-Frame-Options", "DENY");
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (!isProduction || allowedOrigins.size === 0 || allowedOrigins.has(origin.replace(/\/+$/, ""))) {
      return callback(null, true);
    }
    callback(new Error("Origin not allowed"));
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

app.use(express.json({ limit: "2mb" }));
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
