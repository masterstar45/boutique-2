import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  products, cartItems, orders, reviews, promoCodes, dailyStats,
  loyaltyBalances, loyaltyTransactions, loyaltySettings,
  favorites, savedAddresses, botUsers, admins, clientButtons, botSettings, livreurs,
  type InsertProduct, type InsertCartItem, type InsertOrder,
  type InsertReview, type InsertPromoCode, type InsertFavorite,
} from "@workspace/db";
import { eq, and, desc, ilike, or, sql, count, sum, gte, lte, lt } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { objectStorageClient } from "../lib/objectStorage";
import { requireTelegramAuth, requireTelegramAdmin, verifyTelegramWebhookSignature, type TelegramMiniAppData } from "../lib/telegram-auth";
import { adminRateLimiter, uploadRateLimiter, broadcastRateLimiter, cartRateLimiter, telegramMessageRateLimiter, createRateLimiter } from "../lib/rate-limiting";

const promoValidateRateLimiter = createRateLimiter(60 * 1000, 3);
const productsRateLimiter = createRateLimiter(60 * 1000, 60);
import { logAdminAction, extractDetailsFromRequest, ADMIN_ACTIONS } from "../lib/audit-logging";

const router: IRouter = Router();

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// En production, on ne renvoie jamais les messages d'erreur bruts (peuvent contenir
// des noms de colonnes SQL, des détails de schéma, etc.)
function safeErr(err: any, fallback = "Erreur interne du serveur"): string {
  return IS_PRODUCTION ? fallback : (err?.message || fallback);
}

function isValidSessionId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length < 12 || value.length > 128) return false;
  return /^[A-Za-z0-9_-]+$/.test(value);
}


async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
  if (!TURNSTILE_SECRET_KEY) {
    return true;
  }

  const body = new URLSearchParams();
  body.set("secret", TURNSTILE_SECRET_KEY);
  body.set("response", token);
  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json() as { success?: boolean };
    return !!data.success;
  } catch {
    return false;
  }
}

// NOTE: Admin endpoints are protected by Telegram authentication (Mini App inside Telegram)
// No need for additional API key authentication here

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function escapeTelegramHtml(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Admin Telegram Notification ──────────────────────────────────────────────

const ADMIN_CHAT_ID = process.env.TELEGRAM_SUPER_ADMIN_ID || process.env.TELEGRAM_ADMIN_CHAT_ID || "";

// URL du panel admin (Mini App Telegram)
const ADMIN_PANEL_URL = (process.env.MINI_APP_URL || process.env.APP_URL || "") + "/admin";

const ADMIN_PANEL_BUTTON = {
  reply_markup: {
    inline_keyboard: [[
      { text: "⚙️ Ouvrir Panel Admin", web_app: { url: ADMIN_PANEL_URL } }
    ]]
  }
};

async function notifyAdmin(text: string, extra: object = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  // Récupérer tous les admins enregistrés en DB + le super admin
  let adminIds: string[] = [ADMIN_CHAT_ID];
  try {
    const rows = await db.select({ telegramId: admins.telegramId }).from(admins);
    const dbIds = rows.map(r => r.telegramId).filter(Boolean) as string[];
    // Fusionner sans doublons
    adminIds = [...new Set([ADMIN_CHAT_ID, ...dbIds])];
  } catch {}

  const payload = { text, parse_mode: "HTML", ...ADMIN_PANEL_BUTTON, ...extra };
  await Promise.allSettled(
    adminIds.map(chatId =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, ...payload }),
      })
    )
  );
}

// ─── Helper : infos client ────────────────────────────────────────────────────

async function getUserLabel(chatId: string | null | undefined): Promise<string> {
  if (!chatId) return "Client anonyme";
  try {
    const [user] = await db.select().from(botUsers).where(eq(botUsers.chatId, chatId));
    if (!user) return `#${chatId}`;
    const parts: string[] = [];
    if (user.username) parts.push(`@${escapeTelegramHtml(user.username)}`);
    if (user.firstName) parts.push(escapeTelegramHtml(user.firstName));
    parts.push(`(#${chatId})`);
    return parts.join(" ");
  } catch {
    return `#${chatId}`;
  }
}

// ─── Daily Stats Builder ───────────────────────────────────────────────────────

export async function buildDailyStatsMessage(date?: string): Promise<string> {
  const today = date || new Date().toISOString().split("T")[0];
  const [stat] = await db.select().from(dailyStats).where(eq(dailyStats.date, today));
  const orderCount = stat?.orderCount ?? 0;
  const revenue = stat?.revenue ?? 0;

  const allOrders = await db.select().from(orders)
    .where(sql`DATE(created_at) = ${today}`)
    .orderBy(desc(orders.id));

  const pending = allOrders.filter(o => o.status === "pending").length;
  const confirmed = allOrders.filter(o => o.status === "confirmed").length;
  const delivered = allOrders.filter(o => o.status === "delivered").length;
  const cancelled = allOrders.filter(o => o.status === "cancelled").length;

  const [newUsers] = await db.select({ count: count() }).from(botUsers)
    .where(sql`DATE(created_at) = ${today}`).catch(() => [{ count: 0 }]);

  const lines = [
    `📊 <b>Rapport du ${new Date(today).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" })}</b>`,
    ``,
    `🛒 <b>Commandes :</b> ${orderCount}`,
    `💶 <b>Chiffre d'affaires :</b> ${(revenue / 100).toFixed(2)} €`,
    ``,
    `📋 <b>Statuts :</b>`,
    pending > 0 ? `  ⏳ En attente : ${pending}` : null,
    confirmed > 0 ? `  ✅ Confirmées : ${confirmed}` : null,
    delivered > 0 ? `  📦 Livrées : ${delivered}` : null,
    cancelled > 0 ? `  ❌ Annulées : ${cancelled}` : null,
    newUsers?.count > 0 ? `` : null,
    newUsers?.count > 0 ? `👤 <b>Nouveaux clients :</b> ${newUsers.count}` : null,
  ].filter(l => l !== null).join("\n");

  return lines || `📊 Aucune activité le ${today}`;
}

export async function sendDailyStatsToAdmin(date?: string) {
  const msg = await buildDailyStatsMessage(date);
  await notifyAdmin(msg);
}

// ─── File Upload ─────────────────────────────────────────────────────────────

// Disk-based multer (pour upload-start-media → Telegram)
const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedExt = /\.(jpg|jpeg|png|gif|webp|mp4|mov|webm)$/i;
    const allowedMime = /^(image\/(jpeg|png|gif|webp)|video\/(mp4|quicktime|webm))$/;
    if (allowedExt.test(path.extname(file.originalname)) && allowedMime.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Type de fichier non supporté"));
    }
  },
});

// Memory-based multer (pour upload produit → GCS)
const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Accepter images + toutes variantes de vidéo
    const isImage = /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype);
    const isVideo = file.mimetype.startsWith("video/") ||
      /\.(mp4|mov|webm|avi|mkv|m4v|3gp|hevc|heic)$/i.test(file.originalname);
    if (isImage || isVideo) {
      cb(null, true);
    } else {
      cb(new Error(`Type de fichier non supporté: ${file.mimetype}`));
    }
  },
});

// ─── Telegram Video Proxy ─────────────────────────────────────────────────────
// Cache en mémoire fileId → { filePath, cachedAt }
// Le file_path Telegram est stable tant que le fichier existe
const tgFilePathCache = new Map<string, { filePath: string; cachedAt: number }>();
const TG_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 heures

// Nettoyage périodique du cache pour éviter les fuites mémoire
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of tgFilePathCache.entries()) {
    if (now - value.cachedAt > TG_CACHE_TTL) tgFilePathCache.delete(key);
  }
}, TG_CACHE_TTL);

const TELEGRAM_FILE_ID_REGEX = /^[A-Za-z0-9_\-]{10,200}$/;

async function getTelegramFilePath(fileId: string, botToken: string): Promise<string> {
  const cached = tgFilePathCache.get(fileId);
  if (cached && Date.now() - cached.cachedAt < TG_CACHE_TTL) return cached.filePath;

  const getFileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const getFileData = await getFileRes.json() as any;
  if (!getFileData.ok) throw new Error("Fichier introuvable sur Telegram");

  const filePath: string = getFileData.result.file_path;
  tgFilePathCache.set(fileId, { filePath, cachedAt: Date.now() });
  return filePath;
}

// Sert les vidéos stockées sur Telegram sans exposer le bot token dans l'URL
// Supporte les Range requests pour le seek vidéo
router.get("/telegram-video/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!TELEGRAM_FILE_ID_REGEX.test(fileId)) {
      res.status(400).json({ message: "fileId invalide" });
      return;
    }

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!BOT_TOKEN) { res.status(500).json({ message: "Bot token manquant" }); return; }

    const filePath = await getTelegramFilePath(fileId, BOT_TOKEN);
    if (!filePath || filePath.includes("..") || /^\//.test(filePath)) {
      res.status(400).json({ message: "Chemin de fichier invalide" });
      return;
    }
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

    // Transmet le header Range si le client veut un segment (seek vidéo)
    const rangeHeader = req.headers["range"];
    const fetchHeaders: Record<string, string> = {};
    if (rangeHeader) fetchHeaders["Range"] = rangeHeader;

    const videoRes = await fetch(fileUrl, { headers: fetchHeaders });
    if (!videoRes.ok && videoRes.status !== 206) {
      // Invalide le cache si le fichier n'est plus dispo
      tgFilePathCache.delete(fileId);
      res.status(videoRes.status === 404 ? 404 : 502).json({ message: "Téléchargement Telegram échoué" });
      return;
    }

    const contentType = videoRes.headers.get("content-type") || "video/mp4";
    const contentLength = videoRes.headers.get("content-length");
    const contentRange = videoRes.headers.get("content-range");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=86400");
    if (contentLength) res.setHeader("Content-Length", contentLength);
    if (contentRange) res.setHeader("Content-Range", contentRange);

    // 206 Partial Content si c'est une réponse Range, sinon 200
    res.status(videoRes.status === 206 ? 206 : 200);

    // Stream le contenu, gère la déconnexion client proprement
    const { Readable } = await import("stream");
    const nodeStream = Readable.fromWeb(videoRes.body as any);
    nodeStream.on("error", () => res.end());
    req.on("close", () => nodeStream.destroy());
    nodeStream.pipe(res);
  } catch (err: any) {
    console.error("Telegram video proxy error:", err);
    if (!res.headersSent) res.status(500).json({ message: "Erreur proxy vidéo" });
  }
});

// ─── Upload produit ────────────────────────────────────────────────────────────
// Vidéos → Telegram (fonctionne partout, pas besoin du sidecar Replit)
// Images → GCS si dispo, sinon base64 en réponse
router.post("/upload", requireTelegramAuth, uploadRateLimiter, (req, res, next) => {
  // Upload authenticated via Telegram Mini App and rate-limited
  memUpload.single("file")(req, res, (err) => {
    if (err) {
      console.error("Multer error:", err.message);
      res.status(400).json({ message: safeErr(err, "Fichier refusé par le serveur") });
      return;
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "Aucun fichier envoyé" });
    return;
  }

  const isVideo = req.file.mimetype.startsWith("video/") ||
    /\.(mp4|mov|webm|avi|mkv|m4v|3gp)$/i.test(req.file.originalname);

  // ── Vidéo → Cloudinary (CDN) + Telegram (backup) en parallèle ─────────────
  if (isVideo) {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!BOT_TOKEN) { res.status(500).json({ message: "Bot token manquant" }); return; }

    const ADMIN_CHAT_ID_ENV = process.env.TELEGRAM_SUPER_ADMIN_ID || process.env.TELEGRAM_ADMIN_CHAT_ID || "";
    const ext = path.extname(req.file.originalname).toLowerCase() || ".mp4";
    const filename = `product-${Date.now()}${ext}`;
    const buffer = req.file.buffer;
    const mimetype = req.file.mimetype || "video/mp4";

    const CLOUD_NAME  = process.env.CLOUDINARY_CLOUD_NAME;
    const CDN_KEY     = process.env.CLOUDINARY_API_KEY;
    const CDN_SECRET  = process.env.CLOUDINARY_API_SECRET;
    const hasCloudinary = !!(CLOUD_NAME && CDN_KEY && CDN_SECRET);
    
    console.log(`📹 Video upload config: Cloudinary=${hasCloudinary ? "✅ configured" : "❌ not configured"}`);


    // ── Backup Telegram via sendDocument (pas de traitement vidéo = 5-10× plus rapide)
    const telegramBackup = async (): Promise<string | null> => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30 secondes timeout
        
        const tgForm = new FormData();
        tgForm.append("chat_id", ADMIN_CHAT_ID_ENV);
        tgForm.append("document", new Blob([buffer], { type: mimetype }), filename);
        tgForm.append("caption", "📦 [Vidéo produit — backup — ne pas supprimer]");
        tgForm.append("disable_notification", "true");
        
        const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
          method: "POST", body: tgForm as any, signal: controller.signal as AbortSignal,
        });
        clearTimeout(timeout);
        
        const tgData = await tgRes.json() as any;
        if (!tgData.ok) { console.warn("❌ Telegram backup failed:", tgData.description); return null; }
        const fileId = tgData.result?.document?.file_id;
        return fileId ? `/api/telegram-video/${fileId}` : null;
      } catch (e: any) { 
        console.warn("❌ Telegram backup error:", e.message); 
        return null; 
      }
    };

    // ── Upload Cloudinary (CDN principal)
    const cloudinaryUpload = async (): Promise<string | null> => {
      if (!hasCloudinary) return null;
      try {
        const { createHmac } = await import("crypto");
        const timestamp = Math.round(Date.now() / 1000);
        const folder    = "sos-le-plug/videos";
        const publicId  = `product-${Date.now()}`;
        const paramStr  = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}`;
        const signature = createHmac("sha1", CDN_SECRET!).update(paramStr).digest("hex");
        const cdnForm = new FormData();
        cdnForm.append("file", new Blob([buffer], { type: mimetype }), filename);
        cdnForm.append("api_key",    CDN_KEY!);
        cdnForm.append("timestamp",  String(timestamp));
        cdnForm.append("folder",     folder);
        cdnForm.append("public_id",  publicId);
        cdnForm.append("signature",  signature);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); // 60 secondes timeout (Cloudinary peut être lent)
        
        console.log("📹 Starting Cloudinary upload...");
        const cdnRes  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`, {
          method: "POST", body: cdnForm as any, signal: controller.signal as AbortSignal,
        });
        clearTimeout(timeout);
        
        const cdnData = await cdnRes.json() as any;
        if (cdnData.secure_url) {
          console.log(`✅ Cloudinary upload OK: ${cdnData.secure_url}`);
          return cdnData.secure_url as string;
        }
        console.warn("❌ Cloudinary upload failed:", cdnData.error?.message || JSON.stringify(cdnData));
        return null;
      } catch (e: any) { 
        console.warn("❌ Cloudinary upload error:", e.message); 
        return null; 
      }
    };

    if (hasCloudinary) {
      // ── Les deux uploads démarrent EN PARALLÈLE
      console.log("📹 Video upload starting (with Cloudinary + Telegram backup)");
      const cdnPromise = cloudinaryUpload();
      const tgPromise  = telegramBackup(); // démarre en même temps — n'attend pas CDN

      const cdnUrl = await cdnPromise;

      if (cdnUrl) {
        // Cloudinary prêt → répondre IMMÉDIATEMENT (Telegram continue en arrière-plan)
        res.json({ url: cdnUrl });
        tgPromise.then(u => u && console.log(`✅ Telegram backup OK: ${u}`)).catch(() => {});
        return;
      }

      // Cloudinary a échoué → attendre Telegram (déjà en cours)
      console.log("⚠️  Cloudinary failed, waiting for Telegram backup...");
      const tgUrl = await tgPromise;
      if (tgUrl) { 
        console.log(`✅ Using Telegram backup: ${tgUrl}`);
        res.json({ url: tgUrl }); 
        return; 
      }
      console.error("❌ Both Cloudinary and Telegram failed");
      res.status(500).json({ message: "Upload vidéo échoué (Cloudinary et Telegram en échec)" });
      return;
    }

    // ── Telegram only (sendDocument = rapide car pas de traitement vidéo)
    console.log("📹 Video upload starting (Telegram only - no Cloudinary configured)");
    const tgUrl = await telegramBackup();
    if (tgUrl) {
      console.log(`✅ Vidéo stockée sur Telegram: ${tgUrl}`);
      res.json({ url: tgUrl });
    } else {
      console.error("❌ Telegram upload failed");
      res.status(500).json({ message: "Erreur upload vidéo" });
    }
    return;
  }

  // ── Image → GCS si disponible
  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) throw new Error("Bucket GCS non configuré");

    const ext = path.extname(req.file.originalname).toLowerCase() || ".jpg";
    const objectName = `product-uploads/${Date.now()}-${randomUUID()}${ext}`;

    const bucket = objectStorageClient.bucket(bucketId);
    const gcsFile = bucket.file(objectName);
    await gcsFile.save(req.file.buffer, { contentType: req.file.mimetype, resumable: false });

    const url = `/api/gcs-media/${objectName}`;
    res.json({ url });
  } catch (err: any) {
    console.error("GCS upload error:", err);
    res.status(500).json({ message: "Erreur upload image" });
  }
});

// Streaming GCS (vidéos + images produit — supporte Range pour le seek vidéo)
// router.use() évite path-to-regexp et donne req.path directement
router.use("/gcs-media", async (req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") { next(); return; }
  try {
    // req.path = "/product-uploads/uuid.mp4" → on retire le "/" initial
    const objectName = req.path.replace(/^\//, "");
    if (!objectName) { res.status(400).json({ message: "Chemin manquant" }); return; }
    // Restrict to the product-uploads folder to prevent accessing arbitrary GCS objects
    if (!objectName.startsWith("product-uploads/")) {
      res.status(403).json({ message: "Accès refusé" }); return;
    }

    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) { res.status(500).json({ message: "Storage non configuré" }); return; }

    const bucket = objectStorageClient.bucket(bucketId);
    const gcsFile = bucket.file(objectName);
    const [exists] = await gcsFile.exists();
    if (!exists) { res.status(404).json({ message: "Fichier introuvable" }); return; }

    const [meta] = await gcsFile.getMetadata();
    const contentType = (meta.contentType as string) || "application/octet-stream";
    const fileSize = Number(meta.size || 0);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Accept-Ranges", "bytes");

    const rangeHeader = req.headers.range;
    if (rangeHeader && fileSize > 0) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Content-Length", chunkSize);
      res.status(206);
      gcsFile.createReadStream({ start, end }).pipe(res);
    } else {
      if (fileSize > 0) res.setHeader("Content-Length", fileSize);
      gcsFile.createReadStream().pipe(res);
    }
  } catch (err: any) {
    console.error("GCS serve error:", err);
    res.status(500).json({ message: "Erreur lecture" });
  }
});

// ─── Upload média /start vers Telegram ───────────────────────────────────────

router.post("/admin/upload-start-media", requireTelegramAuth, requireTelegramAdmin, uploadRateLimiter, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu" });
    const mimeType = req.file.mimetype;
    const isVideo = mimeType.startsWith("video/");
    const tgMethod = isVideo ? "sendVideo" : "sendPhoto";
    const tgField = isVideo ? "video" : "photo";
    const ADMIN_CHAT_ID = process.env.TELEGRAM_SUPER_ADMIN_ID || process.env.TELEGRAM_ADMIN_CHAT_ID || "";

    const fileBuffer = fs.readFileSync(req.file.path);
    const formData = new FormData();
    formData.append("chat_id", ADMIN_CHAT_ID);
    formData.append(tgField, new Blob([fileBuffer], { type: mimeType }), req.file.originalname);

    const tgRes = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${tgMethod}`,
      { method: "POST", body: formData }
    );
    const tgData = await tgRes.json();

    try { fs.unlinkSync(req.file.path); } catch {}

    if (!tgData.ok) {
      return res.status(500).json({ error: tgData.description || "Erreur Telegram" });
    }

    let fileId: string;
    if (isVideo) {
      fileId = tgData.result.video.file_id;
    } else {
      const photos: any[] = tgData.result.photo;
      fileId = photos[photos.length - 1].file_id;
    }

    await db.insert(botSettings).values({ key: "start_photo_url", value: fileId })
      .onConflictDoUpdate({ target: botSettings.key, set: { value: fileId } });
    await db.insert(botSettings).values({ key: "start_media_type", value: isVideo ? "video" : "photo" })
      .onConflictDoUpdate({ target: botSettings.key, set: { value: isVideo ? "video" : "photo" } });

    res.json({ ok: true, fileId, type: isVideo ? "video" : "photo" });
  } catch (err: any) {
    console.error("start-media upload error:", err);
    res.status(500).json({ error: "Upload échoué" });
  }
});

// ─── Supprimer le média /start ────────────────────────────────────────────────

router.delete("/admin/start-media", requireTelegramAuth, requireTelegramAdmin, async (_req, res) => {
  try {
    await db.insert(botSettings).values({ key: "start_photo_url", value: "" })
      .onConflictDoUpdate({ target: botSettings.key, set: { value: "" } });
    await db.insert(botSettings).values({ key: "start_media_type", value: "" })
      .onConflictDoUpdate({ target: botSettings.key, set: { value: "" } });
    res.json({ ok: true });
  } catch (err: any) {
    console.error("start-media delete error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/uploads/:filename", (req, res) => {
  const rawFilename = req.params.filename;
  if (rawFilename !== path.basename(rawFilename) || rawFilename.includes("..")) {
    res.status(400).json({ message: "Invalid filename" });
    return;
  }

  const filePath = path.resolve(uploadsDir, rawFilename);
  if (!filePath.startsWith(path.resolve(uploadsDir) + path.sep)) {
    res.status(400).json({ message: "Invalid path" });
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ message: "File not found" });
    return;
  }
  res.sendFile(filePath);
});

// ─── Products ─────────────────────────────────────────────────────────────────

// Retire les data: URL vidéo de la liste (trop lourdes) et expose un flag hasVideo
function stripVideoDataUrl(product: typeof products.$inferSelect) {
  const hasVideo = !!product.videoUrl;
  const videoUrlForList = product.videoUrl?.startsWith("data:") ? null : product.videoUrl;
  return { ...product, videoUrl: videoUrlForList, hasVideo };
}

router.get("/products", productsRateLimiter, async (req, res) => {
  const category = typeof req.query.category === "string" && req.query.category ? req.query.category.slice(0, 100) : undefined;
  const search = typeof req.query.search === "string" && req.query.search ? req.query.search.slice(0, 100) : undefined;

  let query = db.select().from(products).$dynamic();
  const conditions = [];
  if (category) conditions.push(eq(products.category, category));
  if (search) conditions.push(or(ilike(products.name, `%${search}%`), ilike(products.brand, `%${search}%`)));
  if (conditions.length > 0) query = query.where(and(...conditions));

  const result = await query;
  res.json(result.map(stripVideoDataUrl));
});

router.get("/products/:id", async (req, res) => {
  const [product] = await db.select().from(products).where(eq(products.id, Number(req.params.id)));
  if (!product) {
    res.status(404).json({ message: "Product not found" });
    return;
  }
  res.json(product);
});

// Endpoint dédié pour récupérer la vidéo d'un produit (évite de charger les data: URL en masse)
router.get("/products/:id/video", async (req, res) => {
  const [product] = await db.select({ videoUrl: products.videoUrl }).from(products).where(eq(products.id, Number(req.params.id)));
  if (!product) {
    res.status(404).json({ message: "Product not found" });
    return;
  }
  res.json({ videoUrl: product.videoUrl });
});

function isValidMediaUrl(url: string | undefined | null): boolean {
  if (!url) return true; // optionnel
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

router.post("/products", requireTelegramAuth, requireTelegramAdmin, adminRateLimiter, async (req, res) => {
  const { name, brand, description, price, imageUrl, videoUrl, category, tags, sticker, stickerFlag, priceOptions, stock } = req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 200) {
    res.status(400).json({ error: "name requis (1-200 caractères)" }); return;
  }
  if (!brand || typeof brand !== "string" || brand.trim().length === 0 || brand.length > 100) {
    res.status(400).json({ error: "brand requis (1-100 caractères)" }); return;
  }
  if (!description || typeof description !== "string" || description.trim().length === 0 || description.length > 2000) {
    res.status(400).json({ error: "description requise (1-2000 caractères)" }); return;
  }
  if (!isValidMediaUrl(imageUrl) || !isValidMediaUrl(videoUrl)) {
    res.status(400).json({ error: "URL d'image ou de vidéo invalide" });
    return;
  }

  try {
    const [product] = await db.insert(products).values({
      name, brand, description, price: price || 0, imageUrl,
      videoUrl, category, tags: tags || [], sticker, stickerFlag,
      priceOptions: priceOptions || [], stock,
    }).returning();
    
    logAdminAction(req, ADMIN_ACTIONS.PRODUCT_CREATE, {
      status: 201,
      details: { productId: product.id, name: product.name },
    });
    
    res.status(201).json(product);
  } catch (err: any) {
    logAdminAction(req, ADMIN_ACTIONS.PRODUCT_CREATE, {
      status: 500,
      error: err.message,
    });
    res.status(500).json({ error: safeErr(err) });
  }
});

router.patch("/products/:id", requireTelegramAuth, requireTelegramAdmin, adminRateLimiter, async (req, res) => {
  const productId = Number(req.params.id);
  
  // Whitelist of editable product fields
  const PRODUCT_EDITABLE_FIELDS = [
    'name', 'brand', 'description', 'price', 'imageUrl', 'videoUrl',
    'category', 'tags', 'sticker', 'stickerFlag', 'priceOptions', 'stock'
  ] as const;
  
  if (!isValidMediaUrl(req.body.imageUrl) || !isValidMediaUrl(req.body.videoUrl)) {
    res.status(400).json({ error: "URL d'image ou de vidéo invalide" });
    return;
  }

  const updateData: Partial<InsertProduct> = {};

  // Only allow whitelisted fields
  for (const field of PRODUCT_EDITABLE_FIELDS) {
    if (field in req.body && req.body[field] !== undefined) {
      (updateData as any)[field] = req.body[field];
    }
  }
  
  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  try {
    const [updated] = await db.update(products).set(updateData).where(eq(products.id, productId)).returning();
    if (!updated) {
      logAdminAction(req, ADMIN_ACTIONS.PRODUCT_UPDATE, {
        status: 404,
        error: "Product not found",
      });
      res.status(404).json({ message: "Product not found" });
      return;
    }
    
    logAdminAction(req, ADMIN_ACTIONS.PRODUCT_UPDATE, {
      status: 200,
      details: { productId, name: updated.name },
    });
    res.json(updated);
  } catch (err: any) {
    logAdminAction(req, ADMIN_ACTIONS.PRODUCT_UPDATE, {
      status: 500,
      error: err.message,
    });
    res.status(500).json({ error: safeErr(err) });
  }
});

router.delete("/products/:id", requireTelegramAuth, requireTelegramAdmin, adminRateLimiter, async (req, res) => {
  const productId = Number(req.params.id);
  
  try {
    // Récupérer le produit avant suppression pour l'audit
    const [product] = await db.select().from(products).where(eq(products.id, productId));
    
    await db.delete(products).where(eq(products.id, productId));
    
    logAdminAction(req, ADMIN_ACTIONS.PRODUCT_DELETE, {
      status: 204,
      details: { productId, name: product?.name },
    });
    
    res.status(204).send();
  } catch (err: any) {
    logAdminAction(req, ADMIN_ACTIONS.PRODUCT_DELETE, {
      status: 500,
      error: err.message,
    });
    res.status(500).json({ error: safeErr(err) });
  }
});

// ─── Cart ─────────────────────────────────────────────────────────────────────

router.get("/cart/:sessionId", async (req, res) => {
  if (!isValidSessionId(req.params.sessionId)) {
    res.status(400).json({ message: "Invalid sessionId" });
    return;
  }

  const items = await db.select().from(cartItems).where(eq(cartItems.sessionId, req.params.sessionId));
  const result = await Promise.all(
    items.map(async (item) => {
      const [product] = await db.select().from(products).where(eq(products.id, item.productId));
      return { ...item, product };
    })
  );
  res.json(result.filter((r) => r.product));
});

router.post("/cart", cartRateLimiter, async (req, res) => {
  const { sessionId, productId, quantity, selectedPrice, selectedWeight, chatId } = req.body;
  if (!isValidSessionId(sessionId) || !productId) {
    res.status(400).json({ message: "sessionId and productId are required" });
    return;
  }

  const parsedQty = Math.floor(Number(quantity));
  if (!parsedQty || parsedQty < 1 || parsedQty > 100) {
    res.status(400).json({ message: "Quantité invalide (1–100)" });
    return;
  }

  const [product] = await db.select().from(products).where(eq(products.id, Number(productId)));
  if (!product) {
    res.status(404).json({ message: "Produit introuvable" });
    return;
  }

  let validatedPrice: number | null = null;
  if (selectedPrice !== undefined && selectedPrice !== null && selectedPrice !== "") {
    const priceNum = Number(selectedPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      res.status(400).json({ message: "Prix invalide" });
      return;
    }
    if (priceNum > 99999) {
      res.status(400).json({ message: "Prix invalide" });
      return;
    }
    // Vérifier que le prix correspond à une option valide du produit
    const basePrice = (product.price || 0) / 100;
    const priceOptions: number[] = Array.isArray((product as any).priceOptions)
      ? (product as any).priceOptions.map((o: any) => Number(o.price)).filter((p: number) => !isNaN(p))
      : [];
    const allValidPrices = [...priceOptions, basePrice];
    const isValidPrice = allValidPrices.some(p => Math.abs(p - priceNum) < 0.001);
    if (!isValidPrice) {
      res.status(400).json({ message: "Prix invalide pour ce produit" });
      return;
    }
    validatedPrice = priceNum;
  }

  const [item] = await db.insert(cartItems).values({
    sessionId,
    productId: Number(productId),
    quantity: parsedQty,
    selectedPrice: validatedPrice,
    selectedWeight: selectedWeight || null,
  }).returning();
  res.json(item);

  // Notify admin
  try {
    const [product] = await db.select().from(products).where(eq(products.id, Number(productId)));
    const productName = product?.name || `Produit #${productId}`;
    const weightStr = selectedWeight ? ` (${selectedWeight})` : "";
    const qty = Number(quantity) || 1;
    const priceUnit = selectedPrice ? Number(selectedPrice) : product ? product.price / 100 : 0;
    const priceStr = priceUnit ? `${priceUnit}€/u — Total : ${(priceUnit * qty).toFixed(2)}€` : "";
    const userLabel = await getUserLabel(chatId);
    notifyAdmin(
      `🛒 <b>Ajout au panier</b>\n\n` +
      `👤 ${userLabel}\n` +
      `📦 ${qty}× ${productName}${weightStr}\n` +
      (priceStr ? `💶 ${priceStr}` : "")
    ).catch(() => {});
  } catch {}
});

router.patch("/cart/:id", cartRateLimiter, async (req, res) => {
  const id = Number(req.params.id);
  const { quantity, sessionId } = req.body;
  if (!isValidSessionId(sessionId) || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    res.status(400).json({ message: "sessionId et quantité valide (1–100) requis" });
    return;
  }
  // La clause WHERE sessionId garantit qu'un user ne peut modifier que ses propres items
  await db.update(cartItems)
    .set({ quantity })
    .where(and(eq(cartItems.id, id), eq(cartItems.sessionId, sessionId)));
  res.json({ success: true });
});

router.delete("/cart/session/:sessionId", requireTelegramAuth, async (req, res) => {
  const telegramUser = (req as any).telegramUser as TelegramMiniAppData;
  const chatId = typeof req.query.chatId === "string" ? req.query.chatId : undefined;

  if (!isValidSessionId(req.params.sessionId)) {
    res.status(400).json({ message: "Invalid sessionId" });
    return;
  }

  if (!chatId || chatId !== telegramUser.chatId) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  // BOLA fix: verify that at least one cart item in this session belongs to this chatId
  // (via cross-reference with orders table or direct chatId column if available)
  // Simpler mitigation: bind sessionId to chatId via orders table lookup
  // If no orders reference this session for this user, deny (prevents clearing stranger's cart)
  const existingOrders = await db.select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.sessionId, req.params.sessionId), eq(orders.chatId, chatId)))
    .limit(1);

  // Allow clear only if: session has pending order from this user, OR session has no orders at all
  // (fresh checkout clear by the same user who built the cart — session is ephemeral)
  const anyOrderForSession = await db.select({ id: orders.id, chatId: orders.chatId })
    .from(orders)
    .where(eq(orders.sessionId, req.params.sessionId))
    .limit(1);

  if (anyOrderForSession.length > 0 && anyOrderForSession[0].chatId !== chatId) {
    logAdminAction(req, "cart_session_delete_forbidden", {
      status: 403,
      error: "Session belongs to a different user",
      details: { sessionId: req.params.sessionId },
    });
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  await db.delete(cartItems).where(eq(cartItems.sessionId, req.params.sessionId));
  res.status(204).send();
});

router.delete("/cart/:id", async (req, res) => {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;

  if (!sessionId || !isValidSessionId(sessionId)) {
    res.status(400).json({ message: "sessionId is required" });
    return;
  }

  // La clause WHERE (id AND sessionId) garantit qu'on ne supprime que son propre item
  await db.delete(cartItems)
    .where(and(eq(cartItems.id, Number(req.params.id)), eq(cartItems.sessionId, sessionId)));
  res.status(204).send();
});

// ─── Checkout ─────────────────────────────────────────────────────────────────

router.post("/checkout", requireTelegramAuth, async (req, res) => {
  try {
  const telegramUser = (req as any).telegramUser;
  const { sessionId, chatId, deliveryType, deliveryAddress, promoCode, pointsToRedeem, turnstileToken, notes } = req.body;
  
  // Verify chatId belongs to authenticated user (BOLA fix)
  if (chatId !== telegramUser.chatId) {
    logAdminAction(req, "checkout_unauthorized_access", {
      status: 403,
      error: "ChatId does not match authenticated user",
      details: { requestChatId: chatId },
    });
    res.status(403).json({ message: "Forbidden: Different user's cart" });
    return;
  }
  
  const VALID_DELIVERY_TYPES = ["livraison", "meetup", "relais"] as const;
  if (!isValidSessionId(sessionId)) {
    res.status(400).json({ message: "sessionId invalide" });
    return;
  }
  if (!deliveryType || !VALID_DELIVERY_TYPES.includes(deliveryType as any)) {
    res.status(400).json({ message: "deliveryType invalide (livraison | meetup | relais)" });
    return;
  }
  if (deliveryAddress !== undefined && deliveryAddress !== null) {
    if (typeof deliveryAddress !== "string" || deliveryAddress.length > 500) {
      res.status(400).json({ message: "Adresse trop longue (500 caractères max)" });
      return;
    }
  }
  if (notes !== undefined && notes !== null) {
    if (typeof notes !== "string" || notes.length > 1000) {
      res.status(400).json({ message: "Notes trop longues (1000 caractères max)" });
      return;
    }
  }

  if (TURNSTILE_SECRET_KEY) {
    // Si la clé est configurée, le token est obligatoire — pas de bypass silencieux
    if (!turnstileToken || typeof turnstileToken !== "string") {
      res.status(403).json({ message: "Vérification anti-bot requise" });
      return;
    }
    const isTurnstileValid = await verifyTurnstileToken(turnstileToken, req.ip || req.socket.remoteAddress || undefined);
    if (!isTurnstileValid) {
      res.status(403).json({ message: "Vérification anti-bot invalide" });
      return;
    }
  }

  // Valider ET déduire les points de fidélité atomiquement (évite la race condition)
  let sanitizedPointsToRedeem = 0;
  if (pointsToRedeem && Number(pointsToRedeem) > 0 && chatId) {
    const [loyalty] = await db.select().from(loyaltyBalances).where(eq(loyaltyBalances.chatId, chatId));
    const realBalance = loyalty?.points ?? 0;
    sanitizedPointsToRedeem = Math.min(Number(pointsToRedeem), realBalance);
    if (sanitizedPointsToRedeem > 0) {
      // UPDATE atomique : soustrait et vérifie que le solde est suffisant en une seule requête
      const deducted = await db.update(loyaltyBalances)
        .set({ points: sql`${loyaltyBalances.points} - ${sanitizedPointsToRedeem}` })
        .where(and(
          eq(loyaltyBalances.chatId, chatId),
          gte(loyaltyBalances.points, sanitizedPointsToRedeem)
        ))
        .returning();
      if (deducted.length === 0) {
        res.status(400).json({ message: "Points de fidélité insuffisants" });
        return;
      }
    }
  }

  const cartItemsList = await db.select().from(cartItems).where(eq(cartItems.sessionId, sessionId));
  if (cartItemsList.length === 0) {
    res.status(400).json({ message: "Cart is empty" });
    return;
  }

  const itemsWithProducts = await Promise.all(
    cartItemsList.map(async (item) => {
      const [product] = await db.select().from(products).where(eq(products.id, item.productId));
      return { ...item, product };
    })
  );

  // Vérifier le stock (si "Rupture" ou "rupture" → rejeter)
  for (const item of itemsWithProducts) {
    const stockStr = item.product?.stock?.toLowerCase() ?? "";
    if (stockStr.includes("rupture") || stockStr === "0" || stockStr === "out of stock") {
      res.status(400).json({ message: `Produit "${item.product?.name}" est en rupture de stock` });
      return;
    }
  }

  // Vérifier et incrémenter le code promo atomiquement (évite la race condition)
  if (promoCode) {
    const [promo] = await db.select().from(promoCodes).where(and(eq(promoCodes.code, String(promoCode).toUpperCase()), eq(promoCodes.active, true)));
    if (promo) {
      // UPDATE atomique : n'incrémente que si usageCount < usageLimit
      const incremented = await db.update(promoCodes)
        .set({ usageCount: sql`${promoCodes.usageCount} + 1` })
        .where(and(
          eq(promoCodes.id, promo.id),
          promo.usageLimit !== null && promo.usageLimit !== undefined
            ? lt(promoCodes.usageCount, promo.usageLimit)
            : sql`true`
        ))
        .returning();
      if (incremented.length === 0) {
        res.status(410).json({ message: "Ce code promo a atteint sa limite d'utilisation" });
        return;
      }
    }
  }

  const orderCode = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const orderData = JSON.stringify({ items: itemsWithProducts, deliveryAddress, promoCode, pointsToRedeem: sanitizedPointsToRedeem, notes: notes || null });

  const [order] = await db.insert(orders).values({
    orderCode,
    sessionId,
    chatId: chatId || null,
    orderData,
    deliveryType,
    status: "pending",
    createdAt: new Date().toISOString(),
  }).returning();

  // Clear cart
  await db.delete(cartItems).where(eq(cartItems.sessionId, sessionId));

  // Update daily stats
  const priceInCents = (item: any) =>
    item.selectedPrice != null ? item.selectedPrice * 100 : (item.product?.price || 0);
  const today = new Date().toISOString().split("T")[0];
  const totalRevenue = itemsWithProducts.reduce((s, item) => {
    return s + priceInCents(item) * item.quantity;
  }, 0);
  try {
    // Upsert atomique — évite la race condition SELECT→INSERT/UPDATE sous charge
    await db.insert(dailyStats)
      .values({ date: today, orderCount: 1, revenue: totalRevenue })
      .onConflictDoUpdate({
        target: dailyStats.date,
        set: {
          orderCount: sql`${dailyStats.orderCount} + 1`,
          revenue: sql`${dailyStats.revenue} + ${totalRevenue}`,
        },
      });
  } catch { /* stats non bloquantes */ }

  // Notify admin of new order
  const priceEuros = (item: any) =>
    item.selectedPrice != null ? Number(item.selectedPrice) : (item.product?.price || 0) / 100;
  const articleList = itemsWithProducts.map(item => {
    const name = item.product?.name || "Produit";
    const weight = item.selectedWeight ? ` (${item.selectedWeight})` : "";
    const unitPrice = priceEuros(item);
    const lineTotal = (unitPrice * item.quantity).toFixed(2);
    return `  • ${item.quantity}× ${name}${weight} — ${unitPrice}€/u = <b>${lineTotal}€</b>`;
  }).join("\n");
  const delivLabel = deliveryType === "livraison" ? "🚚 Livraison à domicile" : deliveryType === "meetup" ? "🤝 Rendez-vous" : "📦 Point relais";
  const userLabel = await getUserLabel(chatId);
  notifyAdmin(
    `🔔 <b>NOUVELLE COMMANDE</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `👤 <b>Client :</b> ${userLabel}\n` +
    `🆔 <b>Commande :</b> ${orderCode}\n\n` +
    `${delivLabel}\n` +
    (deliveryAddress ? `📍 ${escapeTelegramHtml(String(deliveryAddress).slice(0, 300))}\n` : "") +
    `\n<b>Articles :</b>\n${articleList}\n\n` +
    `💶 <b>Total : ${(totalRevenue / 100).toFixed(2)} €</b>` +
    (notes ? `\n\n📝 <b>Note :</b> ${sanitizeTelegramHtml(String(notes).slice(0, 500))}` : ""),
    {
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Confirmer", callback_data: `status:${orderCode}:confirmed` },
          { text: "❌ Annuler", callback_data: `status:${orderCode}:cancelled` },
        ]]
      }
    }
  ).catch(() => {});

  res.json(order);
  } catch (err: any) {
    console.error("Checkout error:", err);
    res.status(500).json({ message: "Erreur interne du serveur" });
  }
});

// ─── Orders ───────────────────────────────────────────────────────────────────

router.get("/orders", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    let query = db.select().from(orders).orderBy(desc(orders.id)).limit(limit).offset(offset).$dynamic();
    if (status) query = query.where(eq(orders.status, status));

    const [result, totalResult] = await Promise.all([
      query,
      db.select({ count: count() }).from(orders),
    ]);

    logAdminAction(req, ADMIN_ACTIONS.ORDER_VIEW, {
      status: 200,
      details: { limit, offset, status },
    });

    res.json({ orders: result, total: totalResult[0]?.count || 0 });
  } catch (err: any) {
    logAdminAction(req, ADMIN_ACTIONS.ORDER_VIEW, {
      status: 500,
      error: err.message,
    });
    res.status(500).json({ error: safeErr(err) });
  }
});

router.patch("/orders/:orderCode/status", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const { orderCode } = req.params;
    if (!orderCode || !/^ORD-\d+-[A-Z0-9]{4}$/.test(orderCode)) {
      res.status(400).json({ error: "Format de commande invalide" });
      return;
    }
    
    const VALID_STATUSES = ["pending", "confirmed", "preparing", "ready", "delivering", "delivered", "cancelled"] as const;
    type OrderStatus = typeof VALID_STATUSES[number];

    if (!status || !VALID_STATUSES.includes(status as OrderStatus)) {
      res.status(400).json({ error: `Statut invalide. Valeurs acceptées : ${VALID_STATUSES.join(", ")}` });
      return;
    }

    await db.update(orders).set({ status }).where(eq(orders.orderCode, orderCode));

    const STATUS_LABELS: Record<string, string> = {
      pending: "⏳ En attente",
      confirmed: "✅ Confirmée",
      preparing: "👨‍🍳 En préparation",
      ready: "🏁 Prête",
      delivering: "🚚 En livraison",
      delivered: "📦 Livrée",
      cancelled: "❌ Annulée",
    };
    const label = STATUS_LABELS[status] || status;
    
    logAdminAction(req, ADMIN_ACTIONS.ORDER_UPDATE_STATUS, {
      status: 200,
      details: { orderCode, newStatus: status },
    });
    
    notifyAdmin(`📋 Commande <b>${orderCode}</b>\nStatut mis à jour → <b>${label}</b>`).catch(() => {});

    // Notifier le client
    try {
      const [order] = await db.select({ chatId: orders.chatId }).from(orders).where(eq(orders.orderCode, orderCode));
      if (order?.chatId) {
        const CLIENT_MESSAGES: Record<string, string> = {
          confirmed:  `✅ Ta commande <b>#${orderCode}</b> est confirmée ! On s'en occupe.`,
          preparing:  `👨‍🍳 Ta commande <b>#${orderCode}</b> est en préparation.`,
          ready:      `🏁 Ta commande <b>#${orderCode}</b> est prête !`,
          delivering: `🚚 Ta commande <b>#${orderCode}</b> est en route vers toi !`,
          delivered:  `📦 Ta commande <b>#${orderCode}</b> a été livrée. Merci ! 🙏`,
          cancelled:  `❌ Ta commande <b>#${orderCode}</b> a été annulée. Contacte-nous si besoin.`,
        };
        const clientMsg = CLIENT_MESSAGES[status];
        if (clientMsg) {
          const token = process.env.TELEGRAM_BOT_TOKEN;
          if (token) {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: order.chatId, text: clientMsg, parse_mode: "HTML" }),
            }).catch(() => {});
          }
        }
      }
    } catch {}

    res.json({ success: true });
  } catch (err: any) {
    logAdminAction(req, ADMIN_ACTIONS.ORDER_UPDATE_STATUS, {
      status: 500,
      error: err.message,
    });
    res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.get("/orders/my/:chatId", requireTelegramAuth, async (req, res) => {
  const telegramUser = (req as any).telegramUser;

  // Vérifier que telegramUser existe
  if (!telegramUser || !telegramUser.chatId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Verify requesting user owns this chatId (BOLA fix)
  if (telegramUser.chatId !== req.params.chatId) {
    logAdminAction(req, "unauthorized_access_attempt", {
      status: 403,
      error: "Attempted access to other user's orders",
      details: { targetChatId: req.params.chatId },
    });
    res.status(403).json({ error: "Forbidden: Cannot access other users' orders" });
    return;
  }
  
  const result = await db.select().from(orders).where(eq(orders.chatId, req.params.chatId)).orderBy(desc(orders.id));
  res.json(result);
});

router.delete("/admin/orders/:orderCode", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  const { orderCode } = req.params;
  if (!orderCode || !/^ORD-\d+-[A-Z0-9]{4}$/.test(orderCode)) {
    res.status(400).json({ error: "Format de commande invalide" });
    return;
  }
  await db.delete(orders).where(eq(orders.orderCode, orderCode));
  res.status(204).send();
});

// Save admin notes on an order (lazy-add column if missing)
router.patch("/admin/orders/:orderCode/notes", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  const { orderCode } = req.params;
  if (!orderCode || !/^ORD-\d+-[A-Z0-9]{4}$/.test(orderCode)) {
    res.status(400).json({ error: "Format de commande invalide" });
    return;
  }
  const rawNotes = req.body.notes ?? null;
  const sanitizedNotes = rawNotes ? String(rawNotes).slice(0, 1000) : null;
  const doUpdate = async () =>
    db.execute(sql`UPDATE orders SET notes = ${sanitizedNotes} WHERE order_code = ${req.params.orderCode}`);
  try {
    await doUpdate();
    res.json({ ok: true });
  } catch (err: any) {
    if (err?.cause?.code === "42703" || err?.message?.includes("notes")) {
      try {
        await db.execute(sql`ALTER TABLE orders ADD COLUMN notes TEXT`);
        await doUpdate();
        return res.json({ ok: true });
      } catch (e2: any) { return res.status(500).json({ error: e2.message }); }
    }
    res.status(500).json({ error: safeErr(err) });
  }
});

// ─── Admin: enriched order list (with user info) ──────────────────────────────
router.get("/admin/orders/enriched", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.min(Number(req.query.offset) || 0, 10000);
    const status = req.query.status as string | undefined;

    let q = db.select().from(orders).orderBy(desc(orders.id)).limit(limit).offset(offset).$dynamic();
    if (status) q = q.where(eq(orders.status, status));
    const result = await q;

    const chatIds = [...new Set(result.map(o => o.chatId).filter(Boolean))] as string[];
    const users = chatIds.length > 0
      ? await db.select().from(botUsers).where(or(...chatIds.map(id => eq(botUsers.chatId, id))))
      : [];
    const userMap: Record<string, any> = {};
    users.forEach(u => { userMap[u.chatId] = u; });

    const [totalResult] = await db.select({ count: count() }).from(orders);
    res.json({
      orders: result.map(o => ({ ...o, user: o.chatId ? (userMap[o.chatId] ?? null) : null })),
      total: totalResult?.count || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// ─── Admin: orders count ─────────────────────────────────────────────────────
router.get("/admin/orders/count", requireTelegramAuth, requireTelegramAdmin, async (_req, res) => {
  try {
    const result = await db.select({ count: count() }).from(orders);
    res.json({ count: Number(result[0]?.count ?? 0) });
  } catch {
    res.json({ count: 0 });
  }
});

// ─── Admin: bot users list ────────────────────────────────────────────────────
router.get("/admin/bot-users", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.slice(0, 100) : undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    let q = db.select().from(botUsers).orderBy(desc(botUsers.id)).limit(limit).offset(offset).$dynamic();
    if (search) {
      q = q.where(or(
        ilike(botUsers.username, `%${search}%`),
        ilike(botUsers.firstName, `%${search}%`),
        eq(botUsers.chatId, search),
      ));
    }
    const [users, totalResult] = await Promise.all([
      q,
      db.select({ count: count() }).from(botUsers),
    ]);
    res.json({ users, total: totalResult[0]?.count || 0 });
  } catch (err: any) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// Orders for a specific user
router.get("/admin/user-orders/:chatId", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  try {
    const result = await db.select().from(orders)
      .where(eq(orders.chatId, req.params.chatId))
      .orderBy(desc(orders.id)).limit(20);
    
    logAdminAction(req, "admin_view_user_orders", {
      status: 200,
      details: { targetChatId: req.params.chatId, orderCount: result.length },
    });
    
    res.json(result);
  } catch (err: any) {
    logAdminAction(req, "admin_view_user_orders", {
      status: 500,
      error: err.message,
    });
    res.status(500).json({ error: safeErr(err) });
  }
});

// Send a Telegram message from admin bot to any chatId
router.post("/admin/send-telegram", requireTelegramAuth, requireTelegramAdmin, telegramMessageRateLimiter, async (req, res) => {
  const { chatId, text } = req.body;
  if (!chatId || !text) return res.status(400).json({ error: "chatId and text required" });
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: "Bot token not configured" });
  const safeText = sanitizeTelegramHtml(String(text));
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: safeText, parse_mode: "HTML" }),
    });
    const data = await r.json() as any;
    if (!data.ok) return res.status(400).json({ error: data.description });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// ─── Admin: Stats report & broadcast ─────────────────────────────────────────

router.post("/admin/notify-stats", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  try {
    const date = (req.body?.date) as string | undefined;
    await sendDailyStatsToAdmin(date);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// ── Test notification (diagnostic Railway) ──────────────────────────────────
router.post("/admin/test-notification", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.status(500).json({ ok: false, error: "TELEGRAM_BOT_TOKEN non configuré sur ce serveur" });
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: `🔔 <b>Test de notification</b>\n\n✅ Le serveur peut envoyer des messages Telegram.\n🕐 ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`,
        parse_mode: "HTML",
      }),
    });
    const data = await r.json() as any;
    if (!data.ok) {
      return res.status(400).json({ ok: false, error: data.description, details: data });
    }
    res.json({ ok: true, message: "Message envoyé avec succès !" });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: safeErr(err) });
  }
});

// N'autoriser que les balises HTML Telegram légitimes dans les broadcasts
function sanitizeTelegramHtml(input: string): string {
  return input
    .replace(/<(?!\/?(?:b|strong|i|em|u|s|strike|del|code|pre|tg-spoiler)(?:\s[^>]*)?>|a\s+href="https?:\/\/[^"<>]*"[^>]*>|\/a>)[^>]*>/gi, "")
    .slice(0, 4096);
}

router.post("/admin/broadcast", requireTelegramAuth, requireTelegramAdmin, broadcastRateLimiter, async (req, res) => {
  const { text, onlyUnlocked } = req.body;
  if (!text || typeof text !== "string") return res.status(400).json({ error: "text required" });
  const sanitizedText = sanitizeTelegramHtml(text);
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: "Bot token not configured" });

  let users: { chatId: string }[] = [];
  try {
    const q = db.select({ chatId: botUsers.chatId }).from(botUsers);
    if (onlyUnlocked) {
      users = await (q as any).where(eq((botUsers as any).isUnlocked, true));
    } else {
      users = await q;
    }
  } catch {
    users = await db.select({ chatId: botUsers.chatId }).from(botUsers);
  }

  let sent = 0, failed = 0;
  for (const u of users) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: u.chatId, text: sanitizedText, parse_mode: "HTML" }),
      });
      const data = await r.json() as any;
      if (data.ok) sent++; else failed++;
    } catch { failed++; }
    await new Promise(resolve => setTimeout(resolve, 50)); // rate limit
  }
  
  logAdminAction(req, ADMIN_ACTIONS.BROADCAST_SEND, {
    status: 200,
    details: { sent, failed, total: users.length, onlyUnlocked },
  });
  
  res.json({ ok: true, sent, failed, total: users.length });
});

// ─── Reviews ──────────────────────────────────────────────────────────────────

router.get("/reviews", async (req, res) => {
  const result = await db.select().from(reviews).where(eq(reviews.approved, true)).orderBy(desc(reviews.id));
  res.json(result);
});

router.get("/reviews/pending", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  try {
    const result = await db.select().from(reviews).where(eq(reviews.approved, false)).orderBy(desc(reviews.id));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: safeErr(err) });
  }
});

router.post("/reviews", createRateLimiter(60 * 1000, 2), async (req, res) => {
  const { chatId, username, firstName, text: reviewText } = req.body;
  if (!chatId || !reviewText || typeof reviewText !== "string") {
    res.status(400).json({ message: "chatId and text are required" });
    return;
  }
  const sanitizedText = reviewText.trim().slice(0, 500);
  if (sanitizedText.length < 5) {
    res.status(400).json({ message: "Avis trop court (minimum 5 caractères)" });
    return;
  }
  const [review] = await db.insert(reviews).values({
    chatId: String(chatId).slice(0, 50),
    username: username ? String(username).slice(0, 100) : null,
    firstName: firstName ? String(firstName).slice(0, 100) : null,
    text: sanitizedText,
    approved: false,
  }).returning();
  res.json(review);
});

router.post("/reviews/:id/approve", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  try {
    await db.update(reviews).set({ approved: true }).where(eq(reviews.id, Number(req.params.id)));
    
    logAdminAction(req, ADMIN_ACTIONS.REVIEW_APPROVE, {
      status: 200,
      details: { reviewId: req.params.id },
    });
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: safeErr(err) });
  }
});

router.delete("/reviews/:id", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  try {
    await db.delete(reviews).where(eq(reviews.id, Number(req.params.id)));
    
    logAdminAction(req, ADMIN_ACTIONS.REVIEW_DELETE, {
      status: 204,
      details: { reviewId: req.params.id },
    });
    
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// ─── Promo codes ──────────────────────────────────────────────────────────────

router.post("/promo/validate", promoValidateRateLimiter, async (req, res) => {
  const { code } = req.body;
  
  if (!code || typeof code !== 'string' || code.length > 50) {
    res.status(400).json({ message: "Code promo invalide" });
    return;
  }
  
  const [promo] = await db.select().from(promoCodes).where(and(eq(promoCodes.code, code.toUpperCase()), eq(promoCodes.active, true)));
  if (!promo) {
    res.status(404).json({ message: "Code promo invalide ou expiré" });
    return;
  }

  // Vérifier la limite d'usage
  if (promo.usageLimit !== null && promo.usageLimit !== undefined && promo.usageCount >= promo.usageLimit) {
    res.status(410).json({ message: "Ce code promo a atteint sa limite d'utilisation" });
    return;
  }

  res.json({
    id: promo.id,
    code: promo.code,
    discountPercent: promo.discountPercent,
    active: promo.active,
  });
});

router.get("/admin/promo-codes", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  const result = await db.select().from(promoCodes).orderBy(desc(promoCodes.id));
  res.json(result);
});

router.post("/admin/promo-codes", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  const { code, discountPercent, active } = req.body;
  if (!code || typeof code !== "string" || code.trim().length === 0 || code.length > 50) {
    return res.status(400).json({ error: "code requis (1-50 caractères)" });
  }
  const percent = Number(discountPercent);
  if (isNaN(percent) || percent < 1 || percent > 100) {
    return res.status(400).json({ error: "discountPercent doit être entre 1 et 100" });
  }
  const [promo] = await db.insert(promoCodes).values({ code: code.trim().toUpperCase(), discountPercent: percent, active: active !== false }).returning();
  res.json(promo);
});

router.delete("/admin/promo-codes/:id", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  await db.delete(promoCodes).where(eq(promoCodes.id, Number(req.params.id)));
  res.status(204).send();
});

// ─── Loyalty ──────────────────────────────────────────────────────────────────

router.get("/loyalty/:chatId", requireTelegramAuth, async (req, res) => {
  const telegramUser = (req as any).telegramUser;
  
  // Verify requesting user owns this chatId (BOLA fix)
  if (telegramUser.chatId !== req.params.chatId) {
    logAdminAction(req, "unauthorized_loyalty_access", {
      status: 403,
      error: "Attempted access to other user's loyalty balance",
      details: { targetChatId: req.params.chatId },
    });
    res.status(403).json({ error: "Forbidden: Cannot access other users' loyalty" });
    return;
  }
  
  const [balance] = await db.select().from(loyaltyBalances).where(eq(loyaltyBalances.chatId, req.params.chatId));
  if (!balance) {
    res.json({ id: 0, chatId: req.params.chatId, points: 0, tier: "Bronze", totalEarned: 0 });
    return;
  }
  res.json(balance);
});

router.get("/loyalty/:chatId/transactions", requireTelegramAuth, async (req, res) => {
  const telegramUser = (req as any).telegramUser;
  
  // Verify requesting user owns this chatId (BOLA fix)
  if (telegramUser.chatId !== req.params.chatId) {
    logAdminAction(req, "unauthorized_loyalty_transactions_access", {
      status: 403,
      error: "Attempted access to other user's loyalty transactions",
      details: { targetChatId: req.params.chatId },
    });
    res.status(403).json({ error: "Forbidden: Cannot access other users' transactions" });
    return;
  }
  
  const result = await db.select().from(loyaltyTransactions)
    .where(eq(loyaltyTransactions.chatId, req.params.chatId))
    .orderBy(desc(loyaltyTransactions.id))
    .limit(20);
  res.json(result);
});

// ─── Favorites ────────────────────────────────────────────────────────────────

router.get("/favorites/:chatId", requireTelegramAuth, async (req, res) => {
  const telegramUser = (req as any).telegramUser;
  
  // Verify requesting user owns this chatId (BOLA fix)
  if (telegramUser.chatId !== req.params.chatId) {
    logAdminAction(req, "unauthorized_favorites_access", {
      status: 403,
      error: "Attempted access to other user's favorites",
      details: { targetChatId: req.params.chatId },
    });
    res.status(403).json({ error: "Forbidden: Cannot access other users' favorites" });
    return;
  }
  
  const favs = await db.select().from(favorites).where(eq(favorites.chatId, req.params.chatId));
  const result = await Promise.all(
    favs.map(async (fav) => {
      const [product] = await db.select().from(products).where(eq(products.id, fav.productId));
      return { ...fav, product };
    })
  );
  res.json(result.filter((r) => r.product));
});

router.post("/favorites", requireTelegramAuth, async (req, res) => {
  const telegramUser = (req as any).telegramUser;
  const { chatId, productId } = req.body;
  
  // Verify requesting user owns this chatId (BOLA fix)
  if (telegramUser.chatId !== chatId) {
    logAdminAction(req, "unauthorized_favorites_modification", {
      status: 403,
      error: "Attempted to modify other user's favorites",
      details: { targetChatId: chatId, productId },
    });
    res.status(403).json({ error: "Forbidden: Cannot modify other users' favorites" });
    return;
  }
  
  const existing = await db.select().from(favorites).where(and(eq(favorites.chatId, chatId), eq(favorites.productId, Number(productId))));
  if (existing.length === 0) {
    await db.insert(favorites).values({ chatId, productId: Number(productId) });
  }
  res.json({ success: true });
});

router.delete("/favorites/:chatId/:productId", requireTelegramAuth, async (req, res) => {
  const telegramUser = (req as any).telegramUser;
  
  // Verify requesting user owns this chatId (BOLA fix)
  if (telegramUser.chatId !== req.params.chatId) {
    logAdminAction(req, "unauthorized_favorites_deletion", {
      status: 403,
      error: "Attempted to delete other user's favorites",
      details: { targetChatId: req.params.chatId, productId: req.params.productId },
    });
    res.status(403).json({ error: "Forbidden: Cannot delete other users' favorites" });
    return;
  }
  
  await db.delete(favorites).where(and(eq(favorites.chatId, req.params.chatId), eq(favorites.productId, Number(req.params.productId))));
  res.status(204).send();
});

// ─── Admin Stats ──────────────────────────────────────────────────────────────

const userPhotoRateLimiter = createRateLimiter(60 * 1000, 15);

// Photo de profil Telegram — proxy serveur (cache 1h, ne pas exposer le token)
router.get("/user-photo/:chatId", requireTelegramAuth, userPhotoRateLimiter, async (req, res) => {
  const { chatId } = req.params;
  const telegramUser = (req as any).telegramUser;
  // Seul l'utilisateur peut voir sa propre photo — les admins peuvent voir toutes
  if (telegramUser.chatId !== chatId && !telegramUser.isAdmin) {
    res.status(403).end(); return;
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) { res.status(500).end(); return; }

  try {
    // 1. Récupère les photos de profil
    const photosRes = await fetch(
      `https://api.telegram.org/bot${token}/getUserProfilePhotos?user_id=${chatId}&limit=1`
    );
    const photosData: any = await photosRes.json();
    if (!photosData.ok || !photosData.result?.total_count) {
      res.status(404).end(); return;
    }

    // 2. Prend la taille la plus grande du premier set
    const sizes: any[] = photosData.result.photos[0];
    const fileId = sizes[sizes.length - 1].file_id;

    // 3. Résout le file_path
    const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const fileData: any = await fileRes.json();
    if (!fileData.ok || !fileData.result?.file_path) { res.status(404).end(); return; }

    // 4. Télécharge et proxifie l'image (le token ne sort jamais vers le client)
    const imgRes = await fetch(`https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`);
    if (!imgRes.ok) { res.status(404).end(); return; }

    res.setHeader("Content-Type", imgRes.headers.get("Content-Type") || "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");

    const buf = await imgRes.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch {
    res.status(500).end();
  }
});

router.get("/admin/stats", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  const [totalOrdersResult] = await db.select({ count: count() }).from(orders);
  const [pendingOrdersResult] = await db.select({ count: count() }).from(orders).where(eq(orders.status, "pending"));
  const [totalUsersResult] = await db.select({ count: count() }).from(botUsers);
  const [totalProductsResult] = await db.select({ count: count() }).from(products);

  const statsRows = await db.select().from(dailyStats);
  const totalRevenue = statsRows.reduce((s, r) => s + r.revenue, 0);

  res.json({
    totalOrders: totalOrdersResult?.count || 0,
    pendingOrders: pendingOrdersResult?.count || 0,
    totalRevenue,
    totalUsers: totalUsersResult?.count || 0,
    totalProducts: totalProductsResult?.count || 0,
  });
});

// Remet à zéro le revenu journalier d'aujourd'hui
router.post("/admin/reset-daily-revenue", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  await db.insert(dailyStats)
    .values({ date: today, orderCount: 0, revenue: 0 })
    .onConflictDoUpdate({ target: dailyStats.date, set: { revenue: 0 } });
  res.json({ ok: true });
});

// ─── Client Buttons (/start) ─────────────────────────────────────────────────

// Ensure the table + all columns exist.
// ADD COLUMN without IF NOT EXISTS — we catch "already exists" errors intentionally.
async function setupClientButtons() {
  // 1. Ensure table exists with the bare minimum
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS client_buttons (
        id SERIAL PRIMARY KEY,
        label TEXT NOT NULL,
        url TEXT NOT NULL
      );
    `);
  } catch (e: any) {
    console.error("client_buttons CREATE error:", e?.message);
  }

  // 2. Add each optional column independently — safe to run repeatedly
  const migrations: Array<[string, string]> = [
    ["emoji",      "ALTER TABLE client_buttons ADD COLUMN emoji TEXT;"],
    ["active",     "ALTER TABLE client_buttons ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;"],
    ["position",   "ALTER TABLE client_buttons ADD COLUMN position INTEGER NOT NULL DEFAULT 0;"],
    ["full_width", "ALTER TABLE client_buttons ADD COLUMN full_width BOOLEAN NOT NULL DEFAULT TRUE;"],
    ["color",      "ALTER TABLE client_buttons ADD COLUMN color TEXT DEFAULT '#54a0d5';"],
  ];
  for (const [name, ddl] of migrations) {
    try {
      await db.execute(sql.raw(ddl));
      console.log(`client_buttons: column '${name}' added`);
    } catch {
      // column already exists — expected on subsequent restarts
    }
  }
}

const clientButtonsReady: Promise<void> = setupClientButtons();

// Raw-SQL helpers — bypass Drizzle schema so queries work even if full_width is missing
async function rawSelectButtons() {
  const res = await db.execute(sql`
    SELECT id, label, url, emoji, active, position,
           COALESCE(full_width, TRUE) AS full_width,
           COALESCE(color, '#54a0d5') AS color
    FROM client_buttons ORDER BY position;
  `);
  return res.rows;
}

async function rawInsertButton(label: string, url: string, emoji: string | null, position: number, fullWidth: boolean, color: string) {
  const res = await db.execute(sql`
    INSERT INTO client_buttons (label, url, emoji, active, position, full_width, color)
    VALUES (${label}, ${url}, ${emoji}, TRUE, ${position}, ${fullWidth}, ${color})
    RETURNING *;
  `);
  return res.rows[0];
}


router.get("/admin/client-buttons", requireTelegramAuth, requireTelegramAdmin, async (_req, res) => {
  await clientButtonsReady;
  try {
    const rows = await rawSelectButtons();
    console.log("✅ GET /admin/client-buttons:", { count: rows.length, buttons: rows.map(r => ({ id: r.id, label: r.label, active: r.active, position: r.position })) });
    res.json(rows);
  } catch (err: any) {
    console.error("❌ GET client-buttons error:", err?.message, err?.cause?.message);
    res.json([]);
  }
});

router.post("/admin/client-buttons", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  await clientButtonsReady;
  try {
    const { label, url, emoji, position, fullWidth, color } = req.body;
    console.log("📌 POST /admin/client-buttons request:", { label, url, emoji, position, fullWidth, color });
    if (!label || !url) return res.status(400).json({ error: "label and url required" });
    const maxRes = await db.execute(sql`SELECT COALESCE(MAX(position), -1) + 1 AS next FROM client_buttons;`);
    const nextPos = Number((maxRes.rows[0] as any).next ?? 0);
    const row = await rawInsertButton(label, url, emoji || null, position ?? nextPos, fullWidth !== false, color || "#54a0d5");
    console.log("✅ Button created successfully:", { id: row?.id, label: row?.label, active: row?.active, position: row?.position });
    res.json(row);
  } catch (err: any) {
    const pg = err?.cause?.message || err?.cause?.code || "";
    console.error("❌ POST client-buttons error:", err?.message, pg);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.patch("/admin/client-buttons/:id", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  await clientButtonsReady;
  try {
    const id = Number(req.params.id);
    const { label, url, emoji, active, position, fullWidth, color } = req.body;
    console.log("🔄 PATCH /admin/client-buttons/:id:", { id, update: { label, url, emoji, active, position, fullWidth, color } });
    // Build update via drizzle for type safety
    const update: Record<string, any> = {};
    if (label !== undefined) update.label = label;
    if (url !== undefined) update.url = url;
    if (emoji !== undefined) update.emoji = emoji;
    if (active !== undefined) update.active = active;
    if (position !== undefined) update.position = position;
    if (fullWidth !== undefined) update.fullWidth = fullWidth;
    if (color !== undefined) update.color = color;
    const [row] = await db.update(clientButtons).set(update).where(eq(clientButtons.id, id)).returning();
    console.log("✅ Button updated:", { id: row?.id, label: row?.label, active: row?.active, position: row?.position });
    res.json(row);
  } catch (err: any) {
    const pg = err?.cause?.message || err?.cause?.code || "";
    console.error("❌ PATCH client-buttons error:", err?.message, pg);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ─── Bot Settings ─────────────────────────────────────────────────────────────

router.get("/admin/bot-settings", requireTelegramAuth, requireTelegramAdmin, async (_req, res) => {
  const rows = await db.select().from(botSettings);
  const settings: Record<string, string> = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

router.post("/admin/bot-settings", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  const { key, value } = req.body;
  const ALLOWED_KEYS = ["start_photo_url", "start_message", "start_media_type"];
  if (!key || !ALLOWED_KEYS.includes(String(key))) {
    return res.status(400).json({ error: `Clé invalide. Clés autorisées : ${ALLOWED_KEYS.join(", ")}` });
  }
  const safeValue = String(value ?? "").slice(0, 4096);
  await db.insert(botSettings).values({ key: String(key), value: safeValue })
    .onConflictDoUpdate({ target: botSettings.key, set: { value: safeValue } });
  res.json({ ok: true });
});

router.delete("/admin/client-buttons/:id", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  await db.delete(clientButtons).where(eq(clientButtons.id, Number(req.params.id)));
  res.json({ ok: true });
});

// ─── Livreurs ─────────────────────────────────────────────────────────────────

// Migration runtime : création table livreurs si absente (Railway production)
;(async () => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS livreurs (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        username TEXT,
        chat_id TEXT NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TEXT NOT NULL DEFAULT ''
      )
    `);
  } catch (e) { console.warn("livreurs table migration:", e); }
})();

// Migration runtime : ajout colonne livreur_id sur orders
;(async () => {
  try {
    await db.execute(sql`ALTER TABLE orders ADD COLUMN livreur_id INTEGER`);
  } catch {}
})();

router.get("/admin/livreurs", requireTelegramAuth, requireTelegramAdmin, async (_req, res) => {
  const rows = await db.select().from(livreurs).orderBy(desc(livreurs.id));
  res.json(rows);
});

router.post("/admin/livreurs", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  const { name, username, chatId } = req.body;
  if (!name || !chatId) return res.status(400).json({ error: "name et chatId requis" });
  const [existing] = await db.select().from(livreurs).where(eq(livreurs.chatId, chatId));
  if (existing) return res.status(409).json({ error: "Ce livreur existe déjà" });
  const [row] = await db.insert(livreurs).values({
    name: name.trim(),
    username: username?.trim().replace(/^@/, "") || null,
    chatId: chatId.trim(),
    isActive: true,
    createdAt: new Date().toISOString(),
  }).returning();
  res.json(row);
});

router.patch("/admin/livreurs/:id/toggle", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(livreurs).where(eq(livreurs.id, id));
  if (!row) return res.status(404).json({ error: "Livreur introuvable" });
  const [updated] = await db.update(livreurs).set({ isActive: !row.isActive }).where(eq(livreurs.id, id)).returning();
  res.json(updated);
});

router.delete("/admin/livreurs/:id", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  await db.delete(livreurs).where(eq(livreurs.id, Number(req.params.id)));
  res.json({ ok: true });
});

// Ping de test vers un livreur
router.post("/admin/livreurs/:id/ping", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: "Token manquant" });
  const [livreur] = await db.select().from(livreurs).where(eq(livreurs.id, Number(req.params.id)));
  if (!livreur) return res.status(404).json({ error: "Livreur introuvable" });
  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: livreur.chatId,
        text: `🛵 <b>Test de connexion SOS LE PLUG</b>\n\nBonjour <b>${livreur.name}</b> !\nTu es bien configuré comme livreur. ✅\nTu recevras les commandes via ce bot.`,
        parse_mode: "HTML",
      }),
    });
    const tgData: any = await tgRes.json();
    if (!tgData.ok) return res.status(400).json({ error: tgData.description });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Assigner un livreur à une commande
router.patch("/admin/orders/:orderCode/livreur", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  const { orderCode } = req.params;
  if (!orderCode || !/^ORD-\d+-[A-Z0-9]{4}$/.test(orderCode)) {
    res.status(400).json({ error: "Format de commande invalide" });
    return;
  }
  const { livreurId } = req.body;  // null pour désassigner
  await db.execute(sql`UPDATE orders SET livreur_id = ${livreurId ?? null} WHERE order_code = ${orderCode}`);
  res.json({ ok: true });
});

// Transmettre la commande au livreur via Telegram
router.post("/admin/orders/:orderCode/transmit-livreur", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: "Token manquant" });

  const { orderCode: transmitOrderCode } = req.params;
  if (!transmitOrderCode || !/^ORD-\d+-[A-Z0-9]{4}$/.test(transmitOrderCode)) {
    return res.status(400).json({ error: "Format de commande invalide" });
  }

  const { livreurId } = req.body;
  if (!livreurId) return res.status(400).json({ error: "livreurId requis" });

  const [livreur] = await db.select().from(livreurs).where(and(eq(livreurs.id, Number(livreurId)), eq(livreurs.isActive, true)));
  if (!livreur) return res.status(404).json({ error: "Livreur introuvable ou inactif" });

  // Récupère la commande
  const [order] = await db.select().from(orders).where(eq(orders.orderCode, transmitOrderCode));
  if (!order) return res.status(404).json({ error: "Commande introuvable" });

  let parsed: any = {};
  try { parsed = JSON.parse(order.orderData); } catch {}

  // selectedPrice is in euros; product.price is in centimes
  const getPriceEuros = (i: any) => i.selectedPrice != null ? Number(i.selectedPrice) : (i.product?.price || 0) / 100;
  const items = (parsed.items || []).map((i: any) =>
    `• ${i.product?.name || "?"} ×${i.quantity} — ${getPriceEuros(i).toFixed(2)}€${i.selectedWeight ? ` (${i.selectedWeight})` : ""}`
  ).join("\n");
  const total = (parsed.items || []).reduce((s: number, i: any) => s + getPriceEuros(i) * i.quantity, 0);

  // Récupère les infos client si dispo
  const chatIdStr = order.chatId;
  let clientInfo = chatIdStr ? `ID: ${chatIdStr}` : "Anonyme";
  if (chatIdStr) {
    const [user] = await db.select().from(botUsers).where(eq(botUsers.chatId, chatIdStr));
    if (user) {
      const safeName = escapeTelegramHtml(user.firstName || "");
      const safeUsername = user.username ? ` @${escapeTelegramHtml(user.username)}` : "";
      clientInfo = `${safeName}${safeUsername}`.trim() || clientInfo;
    }
  }

  const msg = [
    `🛵 <b>Nouvelle livraison à effectuer</b>`,
    ``,
    `📦 Commande : <b>#${order.orderCode}</b>`,
    `👤 Client : ${clientInfo}`,
    parsed.deliveryAddress ? `📍 Adresse : ${escapeTelegramHtml(String(parsed.deliveryAddress).slice(0, 300))}` : `🏪 Retrait en magasin`,
    parsed.notes ? `📝 Note client : ${escapeTelegramHtml(String(parsed.notes).slice(0, 500))}` : null,
    ``,
    `🛍 Articles :`,
    items,
    ``,
    `💰 Total : <b>${total.toFixed(2)}€</b>`,
    parsed.promoCode ? `🏷️ Promo utilisée : ${parsed.promoCode}` : null,
    ``,
    `⚡ SOS LE PLUG`,
  ].filter(l => l !== null).join("\n");

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: livreur.chatId,
        text: msg,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Terminer la livraison", callback_data: `deliver:${order.orderCode}` }
          ]]
        }
      }),
    });
    const tgData: any = await tgRes.json();
    if (!tgData.ok) return res.status(400).json({ error: tgData.description || "Erreur Telegram" });

    // Assigne le livreur à la commande
    await db.execute(sql`UPDATE orders SET livreur_id = ${livreurId} WHERE order_code = ${transmitOrderCode}`);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Admin List Management ────────────────────────────────────────────────────

router.get("/is-admin/:chatId", requireTelegramAuth, async (req, res) => {
  const telegramUser = (req as any).telegramUser as TelegramMiniAppData;
  const { chatId } = req.params;
  // Only allow a user to check their own admin status
  if (telegramUser.chatId !== chatId) {
    res.json({ isAdmin: false });
    return;
  }
  const superAdminId = process.env.TELEGRAM_SUPER_ADMIN_ID || process.env.TELEGRAM_ADMIN_CHAT_ID || "";
  if (superAdminId && chatId === superAdminId) return res.json({ isAdmin: true });
  const [row] = await db.select().from(admins).where(eq(admins.telegramId, chatId));
  res.json({ isAdmin: !!row });
});

router.get("/admin/admins", requireTelegramAuth, requireTelegramAdmin, async (_req, res) => {
  const rows = await db.select().from(admins).orderBy(desc(admins.id));
  res.json(rows);
});

router.post("/admin/admins", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  const { telegramId, name, addedBy } = req.body;
  if (!telegramId) return res.status(400).json({ error: "telegramId required" });
  const [existing] = await db.select().from(admins).where(eq(admins.telegramId, telegramId));
  if (existing) return res.status(409).json({ error: "Admin already exists" });
  const [row] = await db.insert(admins).values({ telegramId, name: name || null, addedBy: addedBy || null }).returning();
  res.json(row);
});

router.delete("/admin/admins/:id", requireTelegramAuth, requireTelegramAdmin, async (req, res) => {
  await db.delete(admins).where(eq(admins.id, Number(req.params.id)));
  res.json({ ok: true });
});

// ── Proxy autocomplétion adresse — API Adresse data.gouv.fr ──────────────────
const addressSearchRateLimiter = createRateLimiter(60 * 1000, 60);

router.get("/address/autocomplete", addressSearchRateLimiter, async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 3) { res.json({ features: [] }); return; }

  try {
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5&autocomplete=1`;
    const upstream = await fetch(url, {
      headers: { "User-Agent": "SOS-Le-Plug-Bot/1.0" },
      signal: AbortSignal.timeout(4000),
    });
    if (!upstream.ok) { res.json({ features: [] }); return; }
    const data = await upstream.json();
    res.json(data);
  } catch {
    res.json({ features: [] });
  }
});

export default router;

