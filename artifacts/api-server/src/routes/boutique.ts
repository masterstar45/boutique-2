import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  products, cartItems, orders, reviews, promoCodes, dailyStats,
  loyaltyBalances, loyaltyTransactions, loyaltySettings,
  favorites, savedAddresses, botUsers, admins, clientButtons, botSettings, livreurs,
  type InsertProduct, type InsertCartItem, type InsertOrder,
  type InsertReview, type InsertPromoCode, type InsertFavorite,
} from "@workspace/db";
import { eq, and, desc, ilike, or, sql, count, sum, gte, lte } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { objectStorageClient } from "../lib/objectStorage";

const router: IRouter = Router();

// ─── Admin Telegram Notification ──────────────────────────────────────────────

const ADMIN_CHAT_ID = "5818221358";

// URL du panel admin (Mini App Telegram)
const ADMIN_PANEL_URL = (process.env.MINI_APP_URL || "https://boutique-2-production.up.railway.app/boutique") + "/admin";

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
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text, parse_mode: "HTML", ...ADMIN_PANEL_BUTTON, ...extra }),
    });
  } catch {}
}

// ─── Helper : infos client ────────────────────────────────────────────────────

async function getUserLabel(chatId: string | null | undefined): Promise<string> {
  if (!chatId) return "Client anonyme";
  try {
    const [user] = await db.select().from(botUsers).where(eq(botUsers.chatId, chatId));
    if (!user) return `#${chatId}`;
    const parts: string[] = [];
    if (user.username) parts.push(`@${user.username}`);
    if (user.firstName) parts.push(user.firstName);
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
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!BOT_TOKEN) { res.status(500).json({ message: "Bot token manquant" }); return; }

    const filePath = await getTelegramFilePath(fileId, BOT_TOKEN);
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
router.post("/upload", (req, res, next) => {
  memUpload.single("file")(req, res, (err) => {
    if (err) {
      console.error("Multer error:", err.message);
      res.status(400).json({ message: err.message || "Fichier refusé par le serveur" });
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

    const ADMIN_CHAT_ID_ENV = "5818221358";
    const ext = path.extname(req.file.originalname).toLowerCase() || ".mp4";
    const filename = `product-${Date.now()}${ext}`;
    const buffer = req.file.buffer;
    const mimetype = req.file.mimetype || "video/mp4";

    const CLOUD_NAME  = process.env.CLOUDINARY_CLOUD_NAME;
    const CDN_KEY     = process.env.CLOUDINARY_API_KEY;
    const CDN_SECRET  = process.env.CLOUDINARY_API_SECRET;
    const hasCloudinary = !!(CLOUD_NAME && CDN_KEY && CDN_SECRET);

    // ── Backup Telegram via sendDocument (pas de traitement vidéo = 5-10× plus rapide)
    const telegramBackup = async (): Promise<string | null> => {
      try {
        const tgForm = new FormData();
        tgForm.append("chat_id", ADMIN_CHAT_ID_ENV);
        tgForm.append("document", new Blob([buffer], { type: mimetype }), filename);
        tgForm.append("caption", "📦 [Vidéo produit — backup — ne pas supprimer]");
        tgForm.append("disable_notification", "true");
        const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
          method: "POST", body: tgForm as any,
        });
        const tgData = await tgRes.json() as any;
        if (!tgData.ok) { console.warn("Telegram backup failed:", tgData.description); return null; }
        const fileId = tgData.result?.document?.file_id;
        return fileId ? `/api/telegram-video/${fileId}` : null;
      } catch (e: any) { console.warn("Telegram backup error:", e.message); return null; }
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
        const cdnRes  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`, {
          method: "POST", body: cdnForm as any,
        });
        const cdnData = await cdnRes.json() as any;
        if (cdnData.secure_url) return cdnData.secure_url as string;
        console.warn("Cloudinary upload failed:", cdnData.error?.message);
        return null;
      } catch (e: any) { console.warn("Cloudinary upload error:", e.message); return null; }
    };

    if (hasCloudinary) {
      // ── Les deux uploads démarrent EN PARALLÈLE
      const cdnPromise = cloudinaryUpload();
      const tgPromise  = telegramBackup(); // démarre en même temps — n'attend pas CDN

      const cdnUrl = await cdnPromise;

      if (cdnUrl) {
        // Cloudinary prêt → répondre IMMÉDIATEMENT (Telegram continue en arrière-plan)
        res.json({ url: cdnUrl });
        tgPromise.then(u => u && console.log(`📹 Telegram backup OK: ${u}`)).catch(() => {});
        return;
      }

      // Cloudinary a échoué → attendre Telegram (déjà en cours)
      const tgUrl = await tgPromise;
      if (tgUrl) { res.json({ url: tgUrl }); return; }
      res.status(500).json({ message: "Upload vidéo échoué (Cloudinary et Telegram en échec)" });
      return;
    }

    // ── Telegram only (sendDocument = rapide car pas de traitement vidéo)
    const tgUrl = await telegramBackup();
    if (tgUrl) {
      console.log(`📹 Vidéo stockée sur Telegram: ${tgUrl}`);
      res.json({ url: tgUrl });
    } else {
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
    res.status(500).json({ message: "Erreur upload image: " + (err.message || "inconnue") });
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
    res.status(500).json({ message: "Erreur lecture: " + (err.message || "inconnue") });
  }
});

// ─── Upload média /start vers Telegram ───────────────────────────────────────

router.post("/admin/upload-start-media", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu" });
    const mimeType = req.file.mimetype;
    const isVideo = mimeType.startsWith("video/");
    const tgMethod = isVideo ? "sendVideo" : "sendPhoto";
    const tgField = isVideo ? "video" : "photo";
    const ADMIN_CHAT_ID = "5818221358";

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
    res.status(500).json({ error: err.message || "Upload échoué" });
  }
});

// ─── Supprimer le média /start ────────────────────────────────────────────────

router.delete("/admin/start-media", async (_req, res) => {
  try {
    await db.insert(botSettings).values({ key: "start_photo_url", value: "" })
      .onConflictDoUpdate({ target: botSettings.key, set: { value: "" } });
    await db.insert(botSettings).values({ key: "start_media_type", value: "" })
      .onConflictDoUpdate({ target: botSettings.key, set: { value: "" } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/uploads/:filename", (req, res) => {
  const filePath = path.resolve(uploadsDir, req.params.filename);
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

router.get("/products", async (req, res) => {
  const category = typeof req.query.category === "string" && req.query.category ? req.query.category : undefined;
  const search = typeof req.query.search === "string" && req.query.search ? req.query.search : undefined;

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

router.post("/products", async (req, res) => {
  const { name, brand, description, price, imageUrl, videoUrl, category, tags, sticker, stickerFlag, priceOptions, stock } = req.body;
  const [product] = await db.insert(products).values({
    name, brand, description, price: price || 0, imageUrl,
    videoUrl, category, tags: tags || [], sticker, stickerFlag,
    priceOptions: priceOptions || [], stock,
  }).returning();
  res.json(product);
});

router.patch("/products/:id", async (req, res) => {
  const { name, brand, description, price, imageUrl, videoUrl, category, tags, sticker, stickerFlag, priceOptions, stock } = req.body;
  const updateData: Partial<InsertProduct> = {};
  if (name !== undefined) updateData.name = name;
  if (brand !== undefined) updateData.brand = brand;
  if (description !== undefined) updateData.description = description;
  if (price !== undefined) updateData.price = price;
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
  if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
  if (category !== undefined) updateData.category = category;
  if (tags !== undefined) updateData.tags = tags;
  if (sticker !== undefined) updateData.sticker = sticker;
  if (stickerFlag !== undefined) updateData.stickerFlag = stickerFlag;
  if (priceOptions !== undefined) updateData.priceOptions = priceOptions;
  if (stock !== undefined) updateData.stock = stock;

  const [updated] = await db.update(products).set(updateData).where(eq(products.id, Number(req.params.id))).returning();
  if (!updated) {
    res.status(404).json({ message: "Product not found" });
    return;
  }
  res.json(updated);
});

router.delete("/products/:id", async (req, res) => {
  await db.delete(products).where(eq(products.id, Number(req.params.id)));
  res.status(204).send();
});

// ─── Cart ─────────────────────────────────────────────────────────────────────

router.get("/cart/:sessionId", async (req, res) => {
  const items = await db.select().from(cartItems).where(eq(cartItems.sessionId, req.params.sessionId));
  const result = await Promise.all(
    items.map(async (item) => {
      const [product] = await db.select().from(products).where(eq(products.id, item.productId));
      return { ...item, product };
    })
  );
  res.json(result.filter((r) => r.product));
});

router.post("/cart", async (req, res) => {
  const { sessionId, productId, quantity, selectedPrice, selectedWeight, chatId } = req.body;
  if (!sessionId || !productId) {
    res.status(400).json({ message: "sessionId and productId are required" });
    return;
  }
  const [item] = await db.insert(cartItems).values({
    sessionId,
    productId: Number(productId),
    quantity: Number(quantity) || 1,
    selectedPrice: selectedPrice ? Number(selectedPrice) : null,
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

router.patch("/cart/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { quantity, sessionId } = req.body;
  if (!sessionId || typeof quantity !== "number") {
    res.status(400).json({ message: "sessionId and quantity required" });
    return;
  }
  await db.update(cartItems).set({ quantity }).where(eq(cartItems.id, id));
  res.json({ success: true });
});

router.delete("/cart/session/:sessionId", async (req, res) => {
  await db.delete(cartItems).where(eq(cartItems.sessionId, req.params.sessionId));
  res.status(204).send();
});

router.delete("/cart/:id", async (req, res) => {
  await db.delete(cartItems).where(eq(cartItems.id, Number(req.params.id)));
  res.status(204).send();
});

// ─── Checkout ─────────────────────────────────────────────────────────────────

router.post("/checkout", async (req, res) => {
  try {
  const { sessionId, chatId, deliveryType, deliveryAddress, promoCode, pointsToRedeem } = req.body;
  if (!sessionId || !deliveryType) {
    res.status(400).json({ message: "sessionId and deliveryType are required" });
    return;
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

  const orderCode = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const orderData = JSON.stringify({ items: itemsWithProducts, deliveryAddress, promoCode, pointsToRedeem });

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
    const existing = await db.select().from(dailyStats).where(eq(dailyStats.date, today));
    if (existing.length === 0) {
      await db.insert(dailyStats).values({ date: today, orderCount: 1, revenue: totalRevenue });
    } else {
      await db.update(dailyStats).set({ orderCount: existing[0].orderCount + 1, revenue: existing[0].revenue + totalRevenue }).where(eq(dailyStats.date, today));
    }
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
    (deliveryAddress ? `📍 ${deliveryAddress}\n` : "") +
    `\n<b>Articles :</b>\n${articleList}\n\n` +
    `💶 <b>Total : ${(totalRevenue / 100).toFixed(2)} €</b>`
  ).catch(() => {});

  res.json(order);
  } catch (err: any) {
    console.error("Checkout error:", err);
    res.status(500).json({ message: err?.message || "Erreur serveur lors du checkout" });
  }
});

// ─── Orders ───────────────────────────────────────────────────────────────────

router.get("/orders", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const limit = Number(req.query.limit) || 50;
  const offset = Number(req.query.offset) || 0;

  let query = db.select().from(orders).orderBy(desc(orders.id)).limit(limit).offset(offset).$dynamic();
  if (status) query = query.where(eq(orders.status, status));

  const [result, totalResult] = await Promise.all([
    query,
    db.select({ count: count() }).from(orders),
  ]);

  res.json({ orders: result, total: totalResult[0]?.count || 0 });
});

router.patch("/orders/:orderCode/status", async (req, res) => {
  const { status } = req.body;
  const { orderCode } = req.params;
  await db.update(orders).set({ status }).where(eq(orders.orderCode, orderCode));

  // Notify admin of status change
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
  notifyAdmin(`📋 Commande <b>${orderCode}</b>\nStatut mis à jour → <b>${label}</b>`).catch(() => {});

  res.json({ success: true });
});

router.get("/orders/my/:chatId", async (req, res) => {
  const result = await db.select().from(orders).where(eq(orders.chatId, req.params.chatId)).orderBy(desc(orders.id));
  res.json(result);
});

router.delete("/admin/orders/:orderCode", async (req, res) => {
  await db.delete(orders).where(eq(orders.orderCode, req.params.orderCode));
  res.status(204).send();
});

// Save admin notes on an order (lazy-add column if missing)
router.patch("/admin/orders/:orderCode/notes", async (req, res) => {
  const doUpdate = async () =>
    db.execute(sql`UPDATE orders SET notes = ${req.body.notes ?? null} WHERE order_code = ${req.params.orderCode}`);
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
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: enriched order list (with user info) ──────────────────────────────
router.get("/admin/orders/enriched", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
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
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: bot users list ────────────────────────────────────────────────────
router.get("/admin/bot-users", async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
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
    res.status(500).json({ error: err.message });
  }
});

// Orders for a specific user
router.get("/admin/user-orders/:chatId", async (req, res) => {
  try {
    const result = await db.select().from(orders)
      .where(eq(orders.chatId, req.params.chatId))
      .orderBy(desc(orders.id)).limit(20);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Send a Telegram message from admin bot to any chatId
router.post("/admin/send-telegram", async (req, res) => {
  const { chatId, text } = req.body;
  if (!chatId || !text) return res.status(400).json({ error: "chatId and text required" });
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: "Bot token not configured" });
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    const data = await r.json() as any;
    if (!data.ok) return res.status(400).json({ error: data.description });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: Stats report & broadcast ─────────────────────────────────────────

router.post("/admin/notify-stats", async (req, res) => {
  try {
    const date = (req.body?.date) as string | undefined;
    await sendDailyStatsToAdmin(date);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Test notification (diagnostic Railway) ──────────────────────────────────
router.post("/admin/test-notification", async (req, res) => {
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
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/admin/broadcast", async (req, res) => {
  const { text, onlyUnlocked } = req.body;
  if (!text) return res.status(400).json({ error: "text required" });
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
        body: JSON.stringify({ chat_id: u.chatId, text, parse_mode: "HTML" }),
      });
      const data = await r.json() as any;
      if (data.ok) sent++; else failed++;
    } catch { failed++; }
    await new Promise(resolve => setTimeout(resolve, 50)); // rate limit
  }
  res.json({ ok: true, sent, failed, total: users.length });
});

// ─── Reviews ──────────────────────────────────────────────────────────────────

router.get("/reviews", async (req, res) => {
  const result = await db.select().from(reviews).where(eq(reviews.approved, true)).orderBy(desc(reviews.id));
  res.json(result);
});

router.get("/reviews/pending", async (req, res) => {
  const result = await db.select().from(reviews).where(eq(reviews.approved, false)).orderBy(desc(reviews.id));
  res.json(result);
});

router.post("/reviews", async (req, res) => {
  const { chatId, username, firstName, text: reviewText } = req.body;
  if (!chatId || !reviewText) {
    res.status(400).json({ message: "chatId and text are required" });
    return;
  }
  const [review] = await db.insert(reviews).values({ chatId, username, firstName, text: reviewText, approved: false }).returning();
  res.json(review);
});

router.post("/reviews/:id/approve", async (req, res) => {
  await db.update(reviews).set({ approved: true }).where(eq(reviews.id, Number(req.params.id)));
  res.json({ success: true });
});

router.delete("/reviews/:id", async (req, res) => {
  await db.delete(reviews).where(eq(reviews.id, Number(req.params.id)));
  res.status(204).send();
});

// ─── Promo codes ──────────────────────────────────────────────────────────────

router.post("/promo/validate", async (req, res) => {
  const { code } = req.body;
  const [promo] = await db.select().from(promoCodes).where(and(eq(promoCodes.code, code.toUpperCase()), eq(promoCodes.active, true)));
  if (!promo) {
    res.status(404).json({ message: "Code promo invalide ou expiré" });
    return;
  }
  res.json(promo);
});

router.get("/admin/promo-codes", async (req, res) => {
  const result = await db.select().from(promoCodes).orderBy(desc(promoCodes.id));
  res.json(result);
});

router.post("/admin/promo-codes", async (req, res) => {
  const { code, discountPercent, active } = req.body;
  const [promo] = await db.insert(promoCodes).values({ code: code.toUpperCase(), discountPercent, active: active !== false }).returning();
  res.json(promo);
});

router.delete("/admin/promo-codes/:id", async (req, res) => {
  await db.delete(promoCodes).where(eq(promoCodes.id, Number(req.params.id)));
  res.status(204).send();
});

// ─── Loyalty ──────────────────────────────────────────────────────────────────

router.get("/loyalty/:chatId", async (req, res) => {
  const [balance] = await db.select().from(loyaltyBalances).where(eq(loyaltyBalances.chatId, req.params.chatId));
  if (!balance) {
    res.json({ id: 0, chatId: req.params.chatId, points: 0, tier: "Bronze", totalEarned: 0 });
    return;
  }
  res.json(balance);
});

router.get("/loyalty/:chatId/transactions", async (req, res) => {
  const result = await db.select().from(loyaltyTransactions)
    .where(eq(loyaltyTransactions.chatId, req.params.chatId))
    .orderBy(desc(loyaltyTransactions.id))
    .limit(20);
  res.json(result);
});

// ─── Favorites ────────────────────────────────────────────────────────────────

router.get("/favorites/:chatId", async (req, res) => {
  const favs = await db.select().from(favorites).where(eq(favorites.chatId, req.params.chatId));
  const result = await Promise.all(
    favs.map(async (fav) => {
      const [product] = await db.select().from(products).where(eq(products.id, fav.productId));
      return { ...fav, product };
    })
  );
  res.json(result.filter((r) => r.product));
});

router.post("/favorites", async (req, res) => {
  const { chatId, productId } = req.body;
  const existing = await db.select().from(favorites).where(and(eq(favorites.chatId, chatId), eq(favorites.productId, Number(productId))));
  if (existing.length === 0) {
    await db.insert(favorites).values({ chatId, productId: Number(productId) });
  }
  res.json({ success: true });
});

router.delete("/favorites/:chatId/:productId", async (req, res) => {
  await db.delete(favorites).where(and(eq(favorites.chatId, req.params.chatId), eq(favorites.productId, Number(req.params.productId))));
  res.status(204).send();
});

// ─── Admin Stats ──────────────────────────────────────────────────────────────

// Photo de profil Telegram — proxy serveur (cache 1h, ne pas exposer le token)
router.get("/user-photo/:chatId", async (req, res) => {
  const { chatId } = req.params;
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
    res.setHeader("Cache-Control", "public, max-age=7200, stale-while-revalidate=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");

    const buf = await imgRes.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch {
    res.status(500).end();
  }
});

router.get("/admin/stats", async (req, res) => {
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
router.post("/admin/reset-daily-revenue", async (req, res) => {
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
           COALESCE(full_width, TRUE) AS full_width
    FROM client_buttons ORDER BY position;
  `);
  return res.rows;
}

async function rawInsertButton(label: string, url: string, emoji: string | null, position: number, fullWidth: boolean) {
  const res = await db.execute(sql`
    INSERT INTO client_buttons (label, url, emoji, active, position, full_width)
    VALUES (${label}, ${url}, ${emoji}, TRUE, ${position}, ${fullWidth})
    RETURNING *;
  `);
  return res.rows[0];
}


router.get("/admin/client-buttons", async (_req, res) => {
  await clientButtonsReady;
  try {
    const rows = await rawSelectButtons();
    res.json(rows);
  } catch (err: any) {
    console.error("GET client-buttons error:", err?.message, err?.cause?.message);
    res.json([]);
  }
});

router.post("/admin/client-buttons", async (req, res) => {
  await clientButtonsReady;
  try {
    const { label, url, emoji, position, fullWidth } = req.body;
    if (!label || !url) return res.status(400).json({ error: "label and url required" });
    const maxRes = await db.execute(sql`SELECT COALESCE(MAX(position), -1) + 1 AS next FROM client_buttons;`);
    const nextPos = Number((maxRes.rows[0] as any).next ?? 0);
    const row = await rawInsertButton(label, url, emoji || null, position ?? nextPos, fullWidth !== false);
    res.json(row);
  } catch (err: any) {
    const pg = err?.cause?.message || err?.cause?.code || "";
    console.error("POST client-buttons error:", err?.message, pg);
    res.status(500).json({ error: err.message || "Erreur serveur", pg });
  }
});

router.patch("/admin/client-buttons/:id", async (req, res) => {
  await clientButtonsReady;
  try {
    const id = Number(req.params.id);
    const { label, url, emoji, active, position, fullWidth } = req.body;
    // Build update via drizzle for type safety
    const update: Record<string, any> = {};
    if (label !== undefined) update.label = label;
    if (url !== undefined) update.url = url;
    if (emoji !== undefined) update.emoji = emoji;
    if (active !== undefined) update.active = active;
    if (position !== undefined) update.position = position;
    if (fullWidth !== undefined) update.fullWidth = fullWidth;
    const [row] = await db.update(clientButtons).set(update).where(eq(clientButtons.id, id)).returning();
    res.json(row);
  } catch (err: any) {
    const pg = err?.cause?.message || err?.cause?.code || "";
    console.error("PATCH client-buttons error:", err?.message, pg);
    res.status(500).json({ error: err.message || "Erreur serveur", pg });
  }
});

// ─── Bot Settings ─────────────────────────────────────────────────────────────

router.get("/admin/bot-settings", async (_req, res) => {
  const rows = await db.select().from(botSettings);
  const settings: Record<string, string> = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

router.post("/admin/bot-settings", async (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: "key required" });
  await db.insert(botSettings).values({ key, value: value ?? "" })
    .onConflictDoUpdate({ target: botSettings.key, set: { value: value ?? "" } });
  res.json({ ok: true });
});

router.delete("/admin/client-buttons/:id", async (req, res) => {
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

router.get("/admin/livreurs", async (_req, res) => {
  const rows = await db.select().from(livreurs).orderBy(desc(livreurs.id));
  res.json(rows);
});

router.post("/admin/livreurs", async (req, res) => {
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

router.patch("/admin/livreurs/:id/toggle", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(livreurs).where(eq(livreurs.id, id));
  if (!row) return res.status(404).json({ error: "Livreur introuvable" });
  const [updated] = await db.update(livreurs).set({ isActive: !row.isActive }).where(eq(livreurs.id, id)).returning();
  res.json(updated);
});

router.delete("/admin/livreurs/:id", async (req, res) => {
  await db.delete(livreurs).where(eq(livreurs.id, Number(req.params.id)));
  res.json({ ok: true });
});

// Ping de test vers un livreur
router.post("/admin/livreurs/:id/ping", async (req, res) => {
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
router.patch("/admin/orders/:orderCode/livreur", async (req, res) => {
  const { livreurId } = req.body;  // null pour désassigner
  await db.execute(sql`UPDATE orders SET livreur_id = ${livreurId ?? null} WHERE order_code = ${req.params.orderCode}`);
  res.json({ ok: true });
});

// Transmettre la commande au livreur via Telegram
router.post("/admin/orders/:orderCode/transmit-livreur", async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: "Token manquant" });

  const { livreurId } = req.body;
  if (!livreurId) return res.status(400).json({ error: "livreurId requis" });

  const [livreur] = await db.select().from(livreurs).where(eq(livreurs.id, Number(livreurId)));
  if (!livreur) return res.status(404).json({ error: "Livreur introuvable" });

  // Récupère la commande
  const [order] = await db.select().from(orders).where(eq(orders.orderCode, req.params.orderCode));
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
    if (user) clientInfo = `${user.firstName || ""}${user.username ? ` @${user.username}` : ""}`.trim() || clientInfo;
  }

  const msg = [
    `🛵 <b>Nouvelle livraison à effectuer</b>`,
    ``,
    `📦 Commande : <b>#${order.orderCode}</b>`,
    `👤 Client : ${clientInfo}`,
    parsed.deliveryAddress ? `📍 Adresse : ${parsed.deliveryAddress}` : `🏪 Retrait en magasin`,
    parsed.deliveryNotes ? `📝 Note client : ${parsed.deliveryNotes}` : null,
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
    await db.execute(sql`UPDATE orders SET livreur_id = ${livreurId} WHERE order_code = ${req.params.orderCode}`);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Admin List Management ────────────────────────────────────────────────────

const SUPER_ADMIN = "5818221358";

router.get("/is-admin/:chatId", async (req, res) => {
  const { chatId } = req.params;
  if (chatId === SUPER_ADMIN) return res.json({ isAdmin: true });
  const [row] = await db.select().from(admins).where(eq(admins.telegramId, chatId));
  res.json({ isAdmin: !!row });
});

router.get("/admin/admins", async (_req, res) => {
  const rows = await db.select().from(admins).orderBy(desc(admins.id));
  res.json(rows);
});

router.post("/admin/admins", async (req, res) => {
  const { telegramId, name, addedBy } = req.body;
  if (!telegramId) return res.status(400).json({ error: "telegramId required" });
  const [existing] = await db.select().from(admins).where(eq(admins.telegramId, telegramId));
  if (existing) return res.status(409).json({ error: "Admin already exists" });
  const [row] = await db.insert(admins).values({ telegramId, name: name || null, addedBy: addedBy || null }).returning();
  res.json(row);
});

router.delete("/admin/admins/:id", async (req, res) => {
  await db.delete(admins).where(eq(admins.id, Number(req.params.id)));
  res.json({ ok: true });
});

export default router;

