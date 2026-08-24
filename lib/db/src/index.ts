import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// SSL en production (Railway, Supabase, Neon, etc.).
// - Si un CA est fourni (DATABASE_CA_CERT) → validation stricte du certificat
//   (empêche un MITM sur le lien DB). Recommandé.
// - Sinon (Postgres interne Railway à cert auto-signé) → connexion chiffrée mais
//   sans validation du cert. On peut forcer la validation via
//   DATABASE_SSL_REJECT_UNAUTHORIZED=true.
function buildSslConfig() {
  if (process.env.NODE_ENV !== "production") return {};
  const ca = process.env.DATABASE_CA_CERT;
  if (ca) {
    return { ssl: { ca, rejectUnauthorized: true } };
  }
  const reject = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true";
  return { ssl: { rejectUnauthorized: reject } };
}

const sslConfig = buildSslConfig();

export const pool = new Pool({ connectionString: process.env.DATABASE_URL, ...sslConfig });
export const db = drizzle(pool, { schema });

export * from "./schema";
