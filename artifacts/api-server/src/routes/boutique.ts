import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  products, cartItems, orders, reviews, promoCodes, dailyStats,
  loyaltyBalances, loyaltyTransactions, loyaltySettings,
  favorites, savedAddresses, botUsers, admins, clientButtons, botSettings,
  type InsertProduct, type InsertCartItem, type InsertOrder,
  type InsertReview, type InsertPromoCode, type InsertFavorite,
} from "@workspace/db";
import { eq, and, desc, ilike, or, sql, count, sum } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";

const router: IRouter = Router();

// ─── File Upload ─────────────────────────────────────────────────────────────

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

router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "Aucun fichier envoyé" });
    return;
  }
  const url = `/api/uploads/${req.file.filename}`;
  res.json({ url });
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
  const { sessionId, productId, quantity, selectedPrice, selectedWeight } = req.body;
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

  // Add loyalty points if chatId provided
  if (chatId) {
    const totalAmount = itemsWithProducts.reduce((sum, item) => {
      const price = item.selectedPrice || item.product?.price || 0;
      return sum + price * item.quantity;
    }, 0);
    const pointsEarned = Math.floor(totalAmount / 100); // 1 point per euro
    if (pointsEarned > 0) {
      const existing = await db.select().from(loyaltyBalances).where(eq(loyaltyBalances.chatId, chatId));
      if (existing.length === 0) {
        await db.insert(loyaltyBalances).values({ chatId, points: pointsEarned, tier: "Bronze", totalEarned: pointsEarned });
      } else {
        const newPoints = existing[0].points + pointsEarned;
        const newTotal = existing[0].totalEarned + pointsEarned;
        const tier = newTotal >= 1500 ? "Gold" : newTotal >= 500 ? "Silver" : "Bronze";
        await db.update(loyaltyBalances).set({ points: newPoints, totalEarned: newTotal, tier }).where(eq(loyaltyBalances.chatId, chatId));
      }
      await db.insert(loyaltyTransactions).values({
        chatId,
        delta: pointsEarned,
        reason: "purchase",
        orderCode,
        description: `Commande ${orderCode}`,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Clear cart
  await db.delete(cartItems).where(eq(cartItems.sessionId, sessionId));

  // Update daily stats
  const today = new Date().toISOString().split("T")[0];
  const totalRevenue = itemsWithProducts.reduce((s, item) => {
    const price = item.selectedPrice || item.product?.price || 0;
    return s + price * item.quantity;
  }, 0);
  const existing = await db.select().from(dailyStats).where(eq(dailyStats.date, today));
  if (existing.length === 0) {
    await db.insert(dailyStats).values({ date: today, orderCount: 1, revenue: totalRevenue });
  } else {
    await db.update(dailyStats).set({ orderCount: existing[0].orderCount + 1, revenue: existing[0].revenue + totalRevenue }).where(eq(dailyStats.date, today));
  }

  res.json(order);
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
  await db.update(orders).set({ status }).where(eq(orders.orderCode, req.params.orderCode));
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

// ─── Client Buttons (/start) ─────────────────────────────────────────────────

router.get("/admin/client-buttons", async (_req, res) => {
  const rows = await db.select().from(clientButtons).orderBy(clientButtons.position);
  res.json(rows);
});

router.post("/admin/client-buttons", async (req, res) => {
  const { label, url, emoji, position, fullWidth } = req.body;
  if (!label || !url) return res.status(400).json({ error: "label and url required" });
  const maxPos = await db.select({ max: sql<number>`max(position)` }).from(clientButtons);
  const nextPos = (maxPos[0]?.max ?? -1) + 1;
  const [row] = await db.insert(clientButtons).values({
    label, url, emoji: emoji || null, active: true,
    position: position ?? nextPos,
    fullWidth: fullWidth !== false,
  }).returning();
  res.json(row);
});

router.patch("/admin/client-buttons/:id", async (req, res) => {
  const { label, url, emoji, active, position, fullWidth } = req.body;
  const update: Record<string, any> = {};
  if (label !== undefined) update.label = label;
  if (url !== undefined) update.url = url;
  if (emoji !== undefined) update.emoji = emoji;
  if (active !== undefined) update.active = active;
  if (position !== undefined) update.position = position;
  if (fullWidth !== undefined) update.fullWidth = fullWidth;
  const [row] = await db.update(clientButtons).set(update).where(eq(clientButtons.id, Number(req.params.id))).returning();
  res.json(row);
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

