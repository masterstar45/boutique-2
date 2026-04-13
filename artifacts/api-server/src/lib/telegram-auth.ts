import { createHmac, timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { admins } from "@workspace/db";
import { eq } from "drizzle-orm";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const isProduction = process.env.NODE_ENV === "production";
const allowUnsignedMiniAppAuth = process.env.ALLOW_UNSIGNED_MINIAPP_AUTH === "true" || !isProduction;

/**
 * Valide la signature d'un webhook Telegram
 * @see https://core.telegram.org/bots/webhooks#validating-the-signature
 */
export function verifyTelegramWebhookSignature(body: string, signature: string | undefined): boolean {
  if (!BOT_TOKEN || !signature) {
    console.warn("⚠️  Telegram webhook signature verification failed: missing BOT_TOKEN or signature header");
    return false;
  }

  try {
    const hmac = createHmac("sha256", BOT_TOKEN);
    hmac.update(body);
    const computedSignature = hmac.digest("hex");
    
    // Timing-safe comparison to prevent timing attacks
    return timingSafeEqual(
      Buffer.from(computedSignature),
      Buffer.from(signature)
    );
  } catch (e) {
    console.error("❌ Webhook signature error:", e);
    return false;
  }
}

/**
 * Type pour les données du Mini App Telegram
 */
export interface TelegramMiniAppData {
  chatId: string;
  userId: number;
  username?: string;
  firstName?: string;
  isBot?: boolean;
  isAdmin?: boolean;
}

/**
 * Extrait et valide les données du Mini App Telegram depuis le header
 * Format: Base64(JSON{chatId, userId, username, ...})
 */
export function extractTelegramMiniAppData(header: string | undefined): TelegramMiniAppData | null {
  if (!header) {
    console.warn("⚠️  Missing Telegram Mini App header");
    return null;
  }

  try {
    // Format supporté:
    // 1) base64(json)
    // 2) base64(json):hex_hmac_signature
    const [payloadB64, signature] = header.split(":", 2);

    if (signature) {
      if (!BOT_TOKEN) {
        console.warn("⚠️  BOT_TOKEN missing for Mini App signature verification");
        return null;
      }

      const computedSignature = createHmac("sha256", BOT_TOKEN).update(payloadB64).digest("hex");
      const expected = Buffer.from(computedSignature, "utf-8");
      const provided = Buffer.from(signature, "utf-8");

      if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
        console.warn("⚠️  Invalid Mini App signature");
        return null;
      }
    } else if (!allowUnsignedMiniAppAuth) {
      console.warn("⚠️  Unsigned Mini App header rejected in production");
      return null;
    }

    const decoded = Buffer.from(payloadB64, "base64").toString("utf-8");
    const data = JSON.parse(decoded);

    // Valider les champs requis
    if (!data.chatId || !data.userId) {
      console.warn("⚠️  Invalid Telegram Mini App data: missing chatId or userId");
      return null;
    }

    return {
      chatId: String(data.chatId),
      userId: Number(data.userId),
      username: data.username,
      firstName: data.firstName,
      isBot: !!data.isBot,
      isAdmin: !!data.isAdmin,
    };
  } catch (e) {
    console.warn("⚠️  Failed to parse Telegram Mini App data:", e);
    return null;
  }
}

/**
 * Middleware pour valider l'authentification Telegram
 * Obtient les données du header X-Telegram-Mini-App
 */
export async function requireTelegramAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const miniAppData = extractTelegramMiniAppData(req.header("x-telegram-mini-app"));
  
  if (!miniAppData) {
    res.status(401).json({ error: "Unauthorized: Invalid or missing Telegram authentication" });
    return;
  }

  // Stocker dans req pour utilisation dans les routes
  (req as any).telegramUser = miniAppData;
  next();
}

/**
 * Middleware pour valider que l'utilisateur est admin
 * Doit être utilisé APRÈS requireTelegramAuth
 */
export async function requireTelegramAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const telegramUser: TelegramMiniAppData | undefined = (req as any).telegramUser;

  if (!telegramUser) {
    res.status(401).json({ error: "Unauthorized: Telegram auth required" });
    return;
  }

  try {
    // Vérifier si l'utilisateur est dans la liste des admins
    const [admin] = await db.select().from(admins).where(eq(admins.telegramId, telegramUser.chatId));

    if (!admin) {
      console.warn(`⚠️  Access denied for non-admin user: ${telegramUser.chatId}`);
      res.status(403).json({ error: "Forbidden: Admin access required" });
      return;
    }

    next();
  } catch (e) {
    console.error("❌ Admin verification error:", e);
    res.status(500).json({ error: "Server error" });
  }
}

/**
 * Middleware pour valider la signature du webhook Telegram
 * Le header doit être X-Telegram-Webhook-Signature
 */
export function requireTelegramWebhookSignature(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const signature = req.header("x-telegram-webhook-signature");
  const body = req.rawBody || JSON.stringify(req.body); // rawBody doit être set par un middleware

  if (!verifyTelegramWebhookSignature(body, signature)) {
    console.error("❌ Invalid Telegram webhook signature");
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  next();
}

/**
 * Middleware pour capturer le body brut (nécessaire pour vérifier les signatures)
 */
export function captureRawBody(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  let data = "";

  req.on("data", (chunk: Buffer) => {
    data += chunk;
  });

  req.on("end", () => {
    (req as any).rawBody = data;
    next();
  });
}
