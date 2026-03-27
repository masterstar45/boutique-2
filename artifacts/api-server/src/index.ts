import app from "./app";
import { logger } from "./lib/logger";
import { setupWebhook } from "./routes/telegram";
import { sendDailyStatsToAdmin } from "./routes/boutique";
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

// ─── Daily Stats Scheduler ────────────────────────────────────────────────────
// Sends a daily report to the admin every day at 20:00 Paris time (UTC+1/+2)

let lastStatsSentDate = "";

function scheduleDailyStats() {
  setInterval(async () => {
    try {
      // Paris time = UTC + offset (1h winter, 2h summer)
      const now = new Date();
      const parisOffset = 60 * (now.getTimezoneOffset() < 0 ? 1 : 1); // always use UTC+1 as safe default
      const parisNow = new Date(now.getTime() + (parisOffset - now.getTimezoneOffset()) * 60000);
      // Use a simple UTC check: 19:00 UTC ≈ 20:00 Paris (winter), 18:00 UTC ≈ 20:00 Paris (summer)
      const utcHour = now.getUTCHours();
      const utcMinute = now.getUTCMinutes();
      const todayStr = now.toISOString().split("T")[0];

      // Fire between 19:00-19:01 UTC (≈ 20:00-21:00 Paris depending on DST)
      if ((utcHour === 19) && utcMinute === 0 && lastStatsSentDate !== todayStr) {
        lastStatsSentDate = todayStr;
        logger.info("Sending daily stats to admin...");
        await sendDailyStatsToAdmin(todayStr);
        logger.info("Daily stats sent");
      }
    } catch (err) {
      logger.error({ err }, "Daily stats scheduler error");
    }
  }, 60 * 1000); // check every minute
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
      scheduleDailyStats();
    }
  });
});
