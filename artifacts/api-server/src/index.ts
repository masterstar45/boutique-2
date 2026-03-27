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

async function runMigration(label: string, query: Parameters<typeof db.execute>[0]) {
  try {
    await db.execute(query);
    logger.info(`Migration OK: ${label}`);
  } catch (err: any) {
    logger.warn(`Migration skip (${label}): ${err.message?.slice(0, 80)}`);
  }
}

async function runMigrations() {
  // Ensure bot_settings table exists
  await runMigration("create bot_settings", sql`
    CREATE TABLE IF NOT EXISTS bot_settings (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL
    );
  `);

  // Ensure client_buttons table exists with all columns (including full_width)
  await runMigration("create client_buttons", sql`
    CREATE TABLE IF NOT EXISTS client_buttons (
      id SERIAL PRIMARY KEY,
      label TEXT NOT NULL,
      url TEXT NOT NULL,
      emoji TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      position INTEGER NOT NULL DEFAULT 0,
      full_width BOOLEAN NOT NULL DEFAULT TRUE
    );
  `);

  // Add full_width to existing client_buttons tables that are missing it
  await runMigration("add full_width column", sql`
    ALTER TABLE client_buttons ADD COLUMN IF NOT EXISTS full_width BOOLEAN NOT NULL DEFAULT TRUE;
  `);

  // Add admin notes column to orders
  await runMigration("add orders notes", sql`
    ALTER TABLE orders ADD COLUMN notes TEXT;
  `);
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
