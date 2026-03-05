import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadsDir = path.resolve(process.cwd(), "client/public/uploads");
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier envoyé' });
    }
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  });

  app.get(api.products.list.path, async (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const products = await storage.getProducts(category, search);
    res.json(products);
  });

  app.get(api.products.get.path, async (req, res) => {
    const product = await storage.getProduct(Number(req.params.id));
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  });

  app.get(api.cart.list.path, async (req, res) => {
    const items = await storage.getCartItems(req.params.sessionId);
    res.json(items);
  });

  app.post(api.cart.add.path, async (req, res) => {
    try {
      const input = api.cart.add.input.parse(req.body);
      const item = await storage.addToCart(input);
      res.json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.patch('/api/cart/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { quantity, sessionId } = req.body;
      if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ message: 'sessionId is required' });
      }
      if (typeof quantity !== 'number' || isNaN(quantity) || !Number.isInteger(quantity)) {
        return res.status(400).json({ message: 'quantity must be a valid integer' });
      }
      const cartItems = await storage.getCartItems(sessionId);
      const item = cartItems.find(i => i.id === id);
      if (!item) {
        return res.status(404).json({ message: 'Cart item not found' });
      }
      await storage.updateCartItemQuantity(id, quantity);
      res.json({ success: true });
    } catch (err) {
      console.error('Error updating cart item:', err);
      res.status(500).json({ message: 'Failed to update cart item' });
    }
  });

  app.delete(api.cart.remove.path, async (req, res) => {
    await storage.removeFromCart(Number(req.params.id));
    res.status(204).send();
  });

  app.delete(api.cart.clear.path, async (req, res) => {
    await storage.clearCart(req.params.sessionId);
    res.status(204).send();
  });

  app.post('/api/checkout', async (req, res) => {
    try {
      let { sessionId, deliveryType, deliveryTime, promoCode, address, postalCode, city, chatId, username, firstName, telegramInitData, pointsToRedeem } = req.body;

      if (telegramInitData && (!chatId || !username || !firstName)) {
        try {
          const crypto = await import('crypto');
          const params = new URLSearchParams(telegramInitData);
          const hash = params.get('hash');
          const botToken = process.env.TELEGRAM_BOT_TOKEN;

          let verified = false;
          if (hash && botToken) {
            params.delete('hash');
            const dataCheckArr = Array.from(params.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => `${k}=${v}`);
            const dataCheckString = dataCheckArr.join('\n');
            const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
            const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
            verified = computedHash === hash;
          }

          if (verified || !botToken) {
            const userJson = params.get('user');
            if (userJson) {
              const tgUser = JSON.parse(userJson);
              if (!chatId && tgUser.id) chatId = tgUser.id.toString();
              if (!username && tgUser.username) username = tgUser.username;
              if (!firstName && tgUser.first_name) firstName = tgUser.first_name;
            }
          } else {
            console.warn('[Checkout] Telegram initData hash verification failed');
          }
        } catch (e) {
          console.error('[Checkout] Failed to parse telegramInitData:', e);
        }
      }

      console.log(`[Checkout] Request received - sessionId: ${sessionId}, chatId: ${chatId || 'NONE'}, username: ${username || 'NONE'}, firstName: ${firstName || 'NONE'}, hasInitData: ${!!telegramInitData}`);

      if (!sessionId || !deliveryType) {
        return res.status(400).json({ message: 'Missing sessionId or deliveryType' });
      }

      if (!address || !postalCode || !city) {
        return res.status(400).json({ message: 'Missing address information' });
      }

      const items = await storage.getCartItems(sessionId);

      if (items.length === 0) {
        return res.status(400).json({ message: 'Cart is empty' });
      }

      const deliveryLabels: Record<string, string> = {
        postal: 'Envoi Postal',
        meetup: 'Meet-up',
        delivery: 'Livraison à domicile'
      };

      const subtotal = items.reduce((sum, item) => {
        const price = item.selectedPrice ? item.selectedPrice : 0;
        return sum + price * item.quantity;
      }, 0);

      let validatedPromo: { code: string; discountPercent: number } | null = null;
      if (promoCode && typeof promoCode === 'string') {
        const promo = await storage.getPromoCodeByCode(promoCode.toUpperCase().trim());
        if (promo && promo.active) {
          validatedPromo = { code: promo.code, discountPercent: promo.discountPercent };
        }
      }

      const promoDiscount = validatedPromo ? Math.round(subtotal * (validatedPromo.discountPercent / 100)) : 0;

      const loyaltySettings = await storage.getLoyaltySettings();
      let pointsDiscount = 0;
      let actualPointsRedeemed = 0;

      if (chatId && pointsToRedeem && pointsToRedeem > 0) {
        const balance = await storage.getLoyaltyBalance(chatId);
        if (balance && balance.points >= pointsToRedeem) {
          actualPointsRedeemed = Math.min(pointsToRedeem, balance.points);
          pointsDiscount = Math.round(actualPointsRedeemed / loyaltySettings.redeemRate);
          const maxDiscount = subtotal - promoDiscount;
          if (pointsDiscount > maxDiscount) {
            pointsDiscount = maxDiscount;
            actualPointsRedeemed = Math.ceil(pointsDiscount * loyaltySettings.redeemRate);
          }
        }
      }

      const totalDiscount = promoDiscount + pointsDiscount;
      const total = subtotal - totalDiscount;

      const formatEuros = (euros: number) => euros.toFixed(2) + ' EUR';

      let orderMessage = 'Nouvelle Commande PharmacyHash\n\n';
      orderMessage += 'Produits:\n';
      items.forEach(item => {
        const priceDisplay = item.selectedPrice && item.selectedWeight
          ? `${item.selectedPrice}€ ${item.selectedWeight}`
          : '0€';
        const itemTotal = (item.selectedPrice || 0) * item.quantity;
        orderMessage += `  - ${item.product.name} (${priceDisplay}) x${item.quantity} = ${formatEuros(itemTotal)}\n`;
      });
      orderMessage += `\nSous-total: ${formatEuros(subtotal)}`;
      if (validatedPromo && promoDiscount > 0) {
        orderMessage += `\nCode promo: ${validatedPromo.code} (-${validatedPromo.discountPercent}%)`;
        orderMessage += `\nReduction promo: -${formatEuros(promoDiscount)}`;
      }
      if (actualPointsRedeemed > 0) {
        orderMessage += `\nPoints utilises: ${actualPointsRedeemed} pts`;
        orderMessage += `\nReduction fidelite: -${formatEuros(pointsDiscount)}`;
      }
      orderMessage += `\nTotal: ${formatEuros(total)}`;
      orderMessage += `\n\nMode de livraison: ${deliveryLabels[deliveryType] || deliveryType}`;
      if (deliveryTime) {
        orderMessage += `\nHoraire souhaite: ${deliveryTime}`;
      }
      orderMessage += `\n\nAdresse de livraison:`;
      orderMessage += `\n   ${address}`;
      orderMessage += `\n   ${postalCode} ${city}`;

      const orderCode = 'ORD' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();

      await storage.createOrder({
        orderCode,
        sessionId,
        chatId: chatId || null,
        orderData: orderMessage,
        deliveryType,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      const today = new Date().toISOString().split('T')[0];
      await storage.updateDailyStats(today, 1, Math.round(total * 100));

      if (chatId && actualPointsRedeemed > 0) {
        await storage.addLoyaltyPoints(
          chatId,
          -actualPointsRedeemed,
          'redemption',
          orderCode,
          `Points utilises pour commande ${orderCode}`
        );
      }

      const botUsernameSetting = await storage.getBotSetting('bot_username');
      const botUsername = botUsernameSetting || 'Zjzhhdhdjdbot';

      const telegramUrl = `https://t.me/${botUsername}?start=order_${orderCode}`;

      console.log(`Order ${orderCode} completed. ChatId: ${chatId || 'NOT PROVIDED'}`);

      try {
        const { sendClientConfirmation, notifyAdminsNewOrder } = await import("./bot");
        notifyAdminsNewOrder(orderCode, orderMessage, chatId || undefined, username || undefined, firstName || undefined).catch(err => {
          console.error('Failed to notify admins:', err);
        });
        if (chatId) {
          sendClientConfirmation(chatId, orderCode, orderMessage).catch(err => {
            console.error('Failed to send client confirmation:', err);
          });
        }
      } catch (e) {
        console.log('Bot module not available for order confirmation');
      }

      await storage.clearCart(sessionId);

      res.json({
        orderCode,
        telegramUrl,
        pointsEarned: 0,
        pointsRedeemed: actualPointsRedeemed
      });
    } catch (err) {
      console.error('Checkout error:', err);
      res.status(500).json({ message: 'Checkout failed' });
    }
  });

  app.get('/api/reviews', async (_req, res) => {
    const reviews = await storage.getApprovedReviews();
    res.json(reviews);
  });

  app.post('/api/reviews', async (req, res) => {
    try {
      const { text, chatId, username, firstName } = req.body;
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ message: 'Text is required' });
      }

      const review = await storage.createReview({
        chatId: chatId || 'web-' + Date.now(),
        username: username || null,
        firstName: firstName || 'Client',
        text: text.trim(),
        approved: false
      });

      try {
        const { notifyAdminsNewReview } = await import("./bot");
        notifyAdminsNewReview(review).catch(err => {
          console.error('Failed to notify admins about review:', err);
        });
      } catch (e) {
        console.log('Bot module not available for review notification');
      }

      res.json(review);
    } catch (err) {
      console.error('Error creating review:', err);
      res.status(500).json({ message: 'Failed to create review' });
    }
  });

  app.post('/api/promo/validate', async (req, res) => {
    try {
      const { code } = req.body;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ valid: false, message: 'Code is required' });
      }

      const promo = await storage.getPromoCodeByCode(code.toUpperCase().trim());

      if (!promo) {
        return res.json({ valid: false, message: 'Code promo invalide' });
      }

      if (!promo.active) {
        return res.json({ valid: false, message: 'Code promo expire' });
      }

      res.json({
        valid: true,
        code: promo.code,
        discountPercent: promo.discountPercent
      });
    } catch (err) {
      console.error('Error validating promo code:', err);
      res.status(500).json({ valid: false, message: 'Error validating code' });
    }
  });

  app.get('/api/loyalty/:chatId', async (req, res) => {
    try {
      const { chatId } = req.params;
      const balance = await storage.getLoyaltyBalance(chatId);
      const settings = await storage.getLoyaltySettings();

      if (!balance) {
        return res.json({
          points: 0,
          tier: 'bronze',
          totalEarned: 0,
          settings: {
            earnRate: settings.earnRate,
            redeemRate: settings.redeemRate,
            silverThreshold: settings.silverThreshold,
            goldThreshold: settings.goldThreshold
          }
        });
      }

      res.json({
        points: balance.points,
        tier: balance.tier,
        totalEarned: balance.totalEarned,
        settings: {
          earnRate: settings.earnRate,
          redeemRate: settings.redeemRate,
          silverThreshold: settings.silverThreshold,
          goldThreshold: settings.goldThreshold
        }
      });
    } catch (err) {
      console.error('Error getting loyalty balance:', err);
      res.status(500).json({ message: 'Failed to get loyalty balance' });
    }
  });

  app.get('/api/loyalty/:chatId/history', async (req, res) => {
    try {
      const { chatId } = req.params;
      const transactions = await storage.getLoyaltyTransactions(chatId, 50);
      res.json(transactions);
    } catch (err) {
      console.error('Error getting loyalty history:', err);
      res.status(500).json({ message: 'Failed to get loyalty history' });
    }
  });

  app.get('/api/loyalty-settings', async (_req, res) => {
    try {
      const settings = await storage.getLoyaltySettings();
      res.json(settings);
    } catch (err) {
      console.error('Error getting loyalty settings:', err);
      res.status(500).json({ message: 'Failed to get settings' });
    }
  });

  app.get('/api/orders/:chatId', async (req, res) => {
    try {
      const { chatId } = req.params;
      const orders = await storage.getOrdersByChatId(chatId);
      res.json(orders);
    } catch (err) {
      console.error('Error getting orders:', err);
      res.status(500).json({ message: 'Failed to get orders' });
    }
  });

  app.get('/api/favorites/:chatId', async (req, res) => {
    try {
      const { chatId } = req.params;
      const favs = await storage.getFavorites(chatId);
      res.json(favs);
    } catch (err) {
      console.error('Error getting favorites:', err);
      res.status(500).json({ message: 'Failed to get favorites' });
    }
  });

  app.post('/api/favorites', async (req, res) => {
    try {
      const { chatId, productId } = req.body;
      if (!chatId || !productId) {
        return res.status(400).json({ message: 'chatId and productId required' });
      }
      const fav = await storage.addFavorite(chatId, productId);
      res.json(fav);
    } catch (err) {
      console.error('Error adding favorite:', err);
      res.status(500).json({ message: 'Failed to add favorite' });
    }
  });

  app.delete('/api/favorites/:chatId/:productId', async (req, res) => {
    try {
      const { chatId, productId } = req.params;
      await storage.removeFavorite(chatId, parseInt(productId));
      res.json({ success: true });
    } catch (err) {
      console.error('Error removing favorite:', err);
      res.status(500).json({ message: 'Failed to remove favorite' });
    }
  });

  app.get('/api/favorites/:chatId/check/:productId', async (req, res) => {
    try {
      const { chatId, productId } = req.params;
      const isFav = await storage.isFavorite(chatId, parseInt(productId));
      res.json({ isFavorite: isFav });
    } catch (err) {
      console.error('Error checking favorite:', err);
      res.status(500).json({ message: 'Failed to check favorite' });
    }
  });

  app.get('/api/addresses/:chatId', async (req, res) => {
    try {
      const { chatId } = req.params;
      const addresses = await storage.getSavedAddresses(chatId);
      res.json(addresses);
    } catch (err) {
      console.error('Error getting addresses:', err);
      res.status(500).json({ message: 'Failed to get addresses' });
    }
  });

  app.post('/api/addresses', async (req, res) => {
    try {
      const { chatId, label, address, postalCode, city, isDefault } = req.body;
      if (!chatId || !address || !postalCode || !city) {
        return res.status(400).json({ message: 'Required fields missing' });
      }
      const newAddress = await storage.addSavedAddress({
        chatId,
        label: label || null,
        address,
        postalCode,
        city,
        isDefault: isDefault || false
      });
      res.json(newAddress);
    } catch (err) {
      console.error('Error adding address:', err);
      res.status(500).json({ message: 'Failed to add address' });
    }
  });

  app.delete('/api/addresses/:id', async (req, res) => {
    try {
      await storage.deleteSavedAddress(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting address:', err);
      res.status(500).json({ message: 'Failed to delete address' });
    }
  });

  app.put('/api/addresses/:id/default', async (req, res) => {
    try {
      const { chatId } = req.body;
      if (!chatId) {
        return res.status(400).json({ message: 'chatId required' });
      }
      await storage.setDefaultAddress(chatId, parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      console.error('Error setting default address:', err);
      res.status(500).json({ message: 'Failed to set default address' });
    }
  });

  // ========== ADMIN API ==========

  app.get('/api/admin/stats', async (_req, res) => {
    try {
      const totalUsers = await storage.getBotUsersCount();
      const totalOrders = await storage.getOrdersCount();
      const pendingOrders = await storage.getOrdersCount('pending');
      const completedOrders = await storage.getOrdersCount('completed');
      const today = new Date().toISOString().split('T')[0];
      const todayStats = await storage.getDailyStats(today);
      const recentStats = await storage.getRecentDailyStats(7);
      const totalProducts = (await storage.getProducts()).length;
      const pendingReviews = (await storage.getPendingReviews()).length;

      res.json({
        totalUsers,
        totalOrders,
        pendingOrders,
        completedOrders,
        totalProducts,
        pendingReviews,
        revenueToday: todayStats?.revenue || 0,
        ordersToday: todayStats?.orderCount || 0,
        recentStats
      });
    } catch (err) {
      console.error('Error getting admin stats:', err);
      res.status(500).json({ message: 'Failed to get stats' });
    }
  });

  app.get('/api/background-settings', async (_req, res) => {
    try {
      const keys = ['bg_preset', 'bg_color1', 'bg_color2', 'bg_color3', 'bg_opacity', 'bg_speed'];
      const settings: Record<string, string | null> = {};
      for (const key of keys) {
        settings[key] = await storage.getBotSetting(key);
      }
      res.json(settings);
    } catch (err) {
      console.error('Error getting background settings:', err);
      res.json({});
    }
  });

  app.put('/api/admin/background-settings', async (req, res) => {
    try {
      const { bg_preset, bg_color1, bg_color2, bg_color3, bg_opacity, bg_speed } = req.body;
      if (bg_preset !== undefined) await storage.setBotSetting('bg_preset', bg_preset);
      if (bg_color1 !== undefined) await storage.setBotSetting('bg_color1', bg_color1);
      if (bg_color2 !== undefined) await storage.setBotSetting('bg_color2', bg_color2);
      if (bg_color3 !== undefined) await storage.setBotSetting('bg_color3', bg_color3);
      if (bg_opacity !== undefined) await storage.setBotSetting('bg_opacity', bg_opacity);
      if (bg_speed !== undefined) await storage.setBotSetting('bg_speed', bg_speed);
      res.json({ success: true });
    } catch (err) {
      console.error('Error updating background settings:', err);
      res.status(500).json({ message: 'Failed to update settings' });
    }
  });

  app.get('/api/admin/orders/new-count', async (_req, res) => {
    try {
      const count = await storage.getRecentOrdersCount(5);
      res.json({ count });
    } catch (err) {
      console.error('Error getting recent orders count:', err);
      res.json({ count: 0 });
    }
  });

  app.get('/api/admin/orders', async (req, res) => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 20;
      const offset = typeof req.query.offset === 'string' ? parseInt(req.query.offset) : 0;
      const orders = await storage.getOrders(status, limit, offset);
      const total = await storage.getOrdersCount(status);
      res.json({ orders, total });
    } catch (err) {
      console.error('Error getting admin orders:', err);
      res.status(500).json({ message: 'Failed to get orders' });
    }
  });

  app.patch('/api/admin/orders/:orderCode/status', async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ message: 'Status is required' });
      }
      await storage.updateOrderStatus(req.params.orderCode, status);
      res.json({ success: true });
    } catch (err) {
      console.error('Error updating order status:', err);
      res.status(500).json({ message: 'Failed to update order' });
    }
  });

  app.delete('/api/admin/orders/:orderCode', async (req, res) => {
    try {
      await storage.deleteOrder(req.params.orderCode);
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting order:', err);
      res.status(500).json({ message: 'Failed to delete order' });
    }
  });

  app.post('/api/admin/products', async (req, res) => {
    try {
      const product = await storage.createProduct(req.body);
      res.json(product);
    } catch (err) {
      console.error('Error creating product:', err);
      res.status(500).json({ message: 'Failed to create product' });
    }
  });

  app.patch('/api/admin/products/:id', async (req, res) => {
    try {
      const product = await storage.updateProduct(Number(req.params.id), req.body);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      res.json(product);
    } catch (err) {
      console.error('Error updating product:', err);
      res.status(500).json({ message: 'Failed to update product' });
    }
  });

  app.delete('/api/admin/products/:id', async (req, res) => {
    try {
      await storage.deleteProduct(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting product:', err);
      res.status(500).json({ message: 'Failed to delete product' });
    }
  });

  app.get('/api/admin/reviews/pending', async (_req, res) => {
    try {
      const reviews = await storage.getPendingReviews();
      res.json(reviews);
    } catch (err) {
      console.error('Error getting pending reviews:', err);
      res.status(500).json({ message: 'Failed to get reviews' });
    }
  });

  app.post('/api/admin/reviews/:id/approve', async (req, res) => {
    try {
      await storage.approveReview(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      console.error('Error approving review:', err);
      res.status(500).json({ message: 'Failed to approve review' });
    }
  });

  app.delete('/api/admin/reviews/:id', async (req, res) => {
    try {
      await storage.deleteReview(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting review:', err);
      res.status(500).json({ message: 'Failed to delete review' });
    }
  });

  app.get('/api/admin/promo-codes', async (_req, res) => {
    try {
      const codes = await storage.getPromoCodes();
      res.json(codes);
    } catch (err) {
      console.error('Error getting promo codes:', err);
      res.status(500).json({ message: 'Failed to get promo codes' });
    }
  });

  app.post('/api/admin/promo-codes', async (req, res) => {
    try {
      const { code, discountPercent } = req.body;
      if (!code || !discountPercent) {
        return res.status(400).json({ message: 'Code and discountPercent required' });
      }
      const promo = await storage.createPromoCode({
        code: code.toUpperCase().trim(),
        discountPercent,
        active: true
      });
      res.json(promo);
    } catch (err) {
      console.error('Error creating promo code:', err);
      res.status(500).json({ message: 'Failed to create promo code' });
    }
  });

  app.patch('/api/admin/promo-codes/:id/toggle', async (req, res) => {
    try {
      const { active } = req.body;
      await storage.togglePromoCode(Number(req.params.id), active);
      res.json({ success: true });
    } catch (err) {
      console.error('Error toggling promo code:', err);
      res.status(500).json({ message: 'Failed to toggle promo code' });
    }
  });

  app.delete('/api/admin/promo-codes/:id', async (req, res) => {
    try {
      await storage.deletePromoCode(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting promo code:', err);
      res.status(500).json({ message: 'Failed to delete promo code' });
    }
  });

  app.get('/api/admin/users', async (_req, res) => {
    try {
      const users = await storage.getAllBotUsers();
      const total = await storage.getBotUsersCount();
      res.json({ users, total });
    } catch (err) {
      console.error('Error getting users:', err);
      res.status(500).json({ message: 'Failed to get users' });
    }
  });

  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existing = await storage.getProducts();
  if (existing.length > 0) return;

  const productImageUrl = "/images/pharmacyhash-product.jpg";

  const seedProducts = [
    {
      name: "AMARETO",
      brand: "CALITE FARM",
      description: "Premium quality strain with distinct aroma.",
      price: 5000,
      imageUrl: productImageUrl,
      category: "Farms",
      tags: ["Lemon"],
      sticker: "STATIC SIFT",
      stickerFlag: "US"
    },
    {
      name: "BISCOTTI",
      brand: "CALITE FARM",
      description: "Classic biscotti flavor profile.",
      price: 6000,
      imageUrl: productImageUrl,
      category: "Farms",
      tags: ["Candy"],
      sticker: "STATIC SIFT",
      stickerFlag: "US"
    },
    {
      name: "H H",
      brand: "CALITE FARM",
      description: "Heavy hitter strain.",
      price: 5500,
      imageUrl: productImageUrl,
      category: "Farms",
      tags: ["Shark"],
      sticker: "STATIC SIFT",
      stickerFlag: "US"
    },
    {
      name: "LEAF CAKE",
      brand: "CALITE FARM",
      description: "Sweet cake flavors.",
      price: 5500,
      imageUrl: productImageUrl,
      category: "Farms",
      tags: ["Plant"],
      sticker: "STATIC SIFT",
      stickerFlag: "US"
    }
  ];

  for (const p of seedProducts) {
    await storage.createProduct(p);
  }
}
