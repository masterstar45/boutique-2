import app from "./app";
import { logger } from "./lib/logger";
import { setupWebhook } from "./routes/telegram";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function runMigrations() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bot_settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL
      );
    `);
    await db.execute(sql`
      ALTER TABLE client_buttons ADD COLUMN IF NOT EXISTS full_width BOOLEAN NOT NULL DEFAULT TRUE;
    `);
    logger.info("DB migrations applied");
  } catch (err) {
    logger.warn({ err }, "Migration warning (non-fatal)");
  }
}

runMigrations().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");

    if (process.env.NODE_ENV === "production") {
      setupWebhook().catch((e) => logger.error({ e }, "Webhook setup failed"));
    }
  });
});
