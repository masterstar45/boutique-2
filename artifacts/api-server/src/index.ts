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

  // Loyalty balances
  await runMigration("create loyalty_balances", sql`
    CREATE TABLE IF NOT EXISTS loyalty_balances (
      id SERIAL PRIMARY KEY,
      chat_id TEXT NOT NULL UNIQUE,
      points INTEGER NOT NULL DEFAULT 0,
      tier TEXT NOT NULL DEFAULT 'Bronze',
      total_earned INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Loyalty transactions
  await runMigration("create loyalty_transactions", sql`
    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id SERIAL PRIMARY KEY,
      chat_id TEXT NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      order_code TEXT,
      description TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Loyalty settings
  await runMigration("create loyalty_settings", sql`
    CREATE TABLE IF NOT EXISTS loyalty_settings (
      id SERIAL PRIMARY KEY,
      points_per_euro INTEGER NOT NULL DEFAULT 1,
      points_value_cents INTEGER NOT NULL DEFAULT 1,
      min_redeem_points INTEGER NOT NULL DEFAULT 100,
      silver_threshold INTEGER NOT NULL DEFAULT 500,
      gold_threshold INTEGER NOT NULL DEFAULT 1500
    );
  `);

  // Daily stats
  await runMigration("create daily_stats", sql`
    CREATE TABLE IF NOT EXISTS daily_stats (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      order_count INTEGER NOT NULL DEFAULT 0,
      revenue INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Reviews
  await runMigration("create reviews", sql`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      chat_id TEXT NOT NULL,
      username TEXT,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Promo codes
  await runMigration("create promo_codes", sql`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      discount_percent INTEGER NOT NULL DEFAULT 0,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      max_uses INTEGER,
      uses INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TEXT NOT NULL DEFAULT ''
    );
  `);

  // Saved addresses
  await runMigration("create saved_addresses", sql`
    CREATE TABLE IF NOT EXISTS saved_addresses (
      id SERIAL PRIMARY KEY,
      chat_id TEXT NOT NULL,
      label TEXT NOT NULL,
      address TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Favorites
  await runMigration("create favorites", sql`
    CREATE TABLE IF NOT EXISTS favorites (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      product_id INTEGER NOT NULL
    );
  `);

  // Access passwords
  await runMigration("create access_passwords", sql`
    CREATE TABLE IF NOT EXISTS access_passwords (
      id SERIAL PRIMARY KEY,
      password TEXT NOT NULL UNIQUE,
      label TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE
    );
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
