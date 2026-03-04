
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { notifyAdminsNewReview, sendOrderConfirmation } from "./bot";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Products
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


  // Cart
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

  app.delete(api.cart.remove.path, async (req, res) => {
    await storage.removeFromCart(Number(req.params.id));
    res.status(204).send();
  });
  
  app.delete(api.cart.clear.path, async (req, res) => {
    await storage.clearCart(req.params.sessionId);
    res.status(204).send();
  });

  // Checkout - save order and redirect to bot
  app.post('/api/checkout', async (req, res) => {
    try {
      const { sessionId, deliveryType, deliveryTime, promoCode, address, postalCode, city, chatId, pointsToRedeem } = req.body;
      
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
        const price = item.selectedPrice ? item.selectedPrice * 100 : item.product.price;
        return sum + price * item.quantity;
      }, 0);

      // Server-side promo code validation - never trust client-provided discount
      let validatedPromo: { code: string; discountPercent: number } | null = null;
      if (promoCode && typeof promoCode === 'string') {
        const promo = await storage.getPromoCodeByCode(promoCode.toUpperCase().trim());
        if (promo && promo.active) {
          validatedPromo = { code: promo.code, discountPercent: promo.discountPercent };
        }
      }

      const promoDiscount = validatedPromo ? Math.round(subtotal * (validatedPromo.discountPercent / 100)) : 0;
      
      // Handle loyalty points redemption
      const loyaltySettings = await storage.getLoyaltySettings();
      let pointsDiscount = 0;
      let actualPointsRedeemed = 0;
      
      if (chatId && pointsToRedeem && pointsToRedeem > 0) {
        const balance = await storage.getLoyaltyBalance(chatId);
        if (balance && balance.points >= pointsToRedeem) {
          actualPointsRedeemed = Math.min(pointsToRedeem, balance.points);
          pointsDiscount = Math.round((actualPointsRedeemed / loyaltySettings.redeemRate) * 100);
          const maxDiscount = subtotal - promoDiscount;
          if (pointsDiscount > maxDiscount) {
            pointsDiscount = maxDiscount;
            actualPointsRedeemed = Math.ceil((pointsDiscount / 100) * loyaltySettings.redeemRate);
          }
        }
      }

      const totalDiscount = promoDiscount + pointsDiscount;
      const total = subtotal - totalDiscount;

      const formatPrice = (cents: number) => (cents / 100).toFixed(2) + ' EUR';

      let orderMessage = '🛒 Nouvelle Commande PharmacyHash\n\n';
      orderMessage += '📦 Produits:\n';
      items.forEach(item => {
        const priceDisplay = item.selectedPrice && item.selectedWeight 
          ? `${item.selectedPrice}€ ${item.selectedWeight}` 
          : formatPrice(item.product.price);
        const itemTotal = item.selectedPrice ? item.selectedPrice * 100 * item.quantity : item.product.price * item.quantity;
        orderMessage += `  • ${item.product.name} (${priceDisplay}) x${item.quantity} = ${formatPrice(itemTotal)}\n`;
      });
      orderMessage += `\n💰 Sous-total: ${formatPrice(subtotal)}`;
      if (validatedPromo && promoDiscount > 0) {
        orderMessage += `\n🏷️ Code promo: ${validatedPromo.code} (-${validatedPromo.discountPercent}%)`;
        orderMessage += `\n✅ Réduction promo: -${formatPrice(promoDiscount)}`;
      }
      if (actualPointsRedeemed > 0) {
        orderMessage += `\n🎯 Points utilisés: ${actualPointsRedeemed} pts`;
        orderMessage += `\n✅ Réduction fidélité: -${formatPrice(pointsDiscount)}`;
      }
      orderMessage += `\n💵 Total: ${formatPrice(total)}`;
      orderMessage += `\n\n🚚 Mode de livraison: ${deliveryLabels[deliveryType] || deliveryType}`;
      if (deliveryTime) {
        orderMessage += `\n🕐 Horaire souhaité: ${deliveryTime}`;
      }
      orderMessage += `\n\n📍 Adresse de livraison:`;
      orderMessage += `\n   ${address}`;
      orderMessage += `\n   ${postalCode} ${city}`;

      // Generate unique order code
      const orderCode = 'ORD' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();

      // Save order to database
      await storage.createOrder({
        orderCode,
        sessionId,
        chatId: chatId || null,
        orderData: orderMessage,
        deliveryType,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      // Update daily stats
      const today = new Date().toISOString().split('T')[0];
      await storage.updateDailyStats(today, 1, total);

      // Handle loyalty points - only deduct redeemed points
      // Points earning is handled manually by admin via bot
      if (chatId && actualPointsRedeemed > 0) {
        await storage.addLoyaltyPoints(
          chatId,
          -actualPointsRedeemed,
          'redemption',
          orderCode,
          `Points utilisés pour commande ${orderCode}`
        );
      }

      // Bot username from database
      const botUsernameSetting = await storage.getBotSetting('bot_username');
      const botUsername = botUsernameSetting || 'Zjzhhdhdjdbot';
      
      // Create deep link to bot with order code
      const telegramUrl = `https://t.me/${botUsername}?start=order_${orderCode}`;
      
      // Send confirmation message to user via Telegram bot
      console.log(`Order ${orderCode} completed. ChatId: ${chatId || 'NOT PROVIDED'}`);
      if (chatId) {
        console.log(`Sending order confirmation to chatId: ${chatId}`);
        sendOrderConfirmation(chatId, orderCode, orderMessage).catch(err => {
          console.error('Failed to send order confirmation:', err);
        });
      } else {
        console.log('No chatId provided - cannot send Telegram confirmation');
      }
      
      // Clear the cart after successful order
      await storage.clearCart(sessionId);
      
      res.json({ 
        orderCode,
        telegramUrl,
        pointsEarned: 0, // Points are added manually by admin
        pointsRedeemed: actualPointsRedeemed
      });
    } catch (err) {
      console.error('Checkout error:', err);
      res.status(500).json({ message: 'Checkout failed' });
    }
  });

  // Reviews
  app.get('/api/reviews', async (req, res) => {
    const reviews = await storage.getApprovedReviews();
    res.json(reviews);
  });

  app.post('/api/reviews', async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ message: 'Text is required' });
      }
      
      const review = await storage.createReview({
        chatId: 'web-' + Date.now(),
        username: null,
        firstName: 'Client',
        text: text.trim(),
        approved: false
      });
      
      // Notify admins about new review
      notifyAdminsNewReview(review).catch(err => {
        console.error('Failed to notify admins about review:', err);
      });
      
      res.json(review);
    } catch (err) {
      console.error('Error creating review:', err);
      res.status(500).json({ message: 'Failed to create review' });
    }
  });

  // Promo codes validation
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
        return res.json({ valid: false, message: 'Code promo expiré' });
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

  // Loyalty endpoints
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

  app.get('/api/loyalty-settings', async (req, res) => {
    try {
      const settings = await storage.getLoyaltySettings();
      res.json(settings);
    } catch (err) {
      console.error('Error getting loyalty settings:', err);
      res.status(500).json({ message: 'Failed to get settings' });
    }
  });

  // Orders by ChatId
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

  // Favorites
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

  // Saved Addresses
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
      const { id } = req.params;
      await storage.deleteSavedAddress(parseInt(id));
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting address:', err);
      res.status(500).json({ message: 'Failed to delete address' });
    }
  });

  app.put('/api/addresses/:id/default', async (req, res) => {
    try {
      const { id } = req.params;
      const { chatId } = req.body;
      if (!chatId) {
        return res.status(400).json({ message: 'chatId required' });
      }
      await storage.setDefaultAddress(chatId, parseInt(id));
      res.json({ success: true });
    } catch (err) {
      console.error('Error setting default address:', err);
      res.status(500).json({ message: 'Failed to set default address' });
    }
  });

  // SEED DATA
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existing = await storage.getProducts();
  if (existing.length > 0) return;

  const productImageUrl = "/images/pharmacyhash-product.jpg";
  
  const products = [
    {
      name: "AMARETO",
      brand: "CALITE FARM 🦍",
      description: "Premium quality strain with distinct aroma.",
      price: 5000, // 50.00
      imageUrl: productImageUrl,
      category: "Farms",
      tags: ["Lemon"],
      sticker: "STATIC SIFT",
      stickerFlag: "🇺🇸"
    },
    {
      name: "BISCOTTI",
      brand: "CALITE FARM 🦍",
      description: "Classic biscotti flavor profile.",
      price: 6000,
      imageUrl: productImageUrl,
      category: "Farms",
      tags: ["Candy"],
      sticker: "STATIC SIFT",
      stickerFlag: "🇺🇸"
    },
    {
      name: "H H 🦈",
      brand: "CALITE FARM 🦍",
      description: "Heavy hitter strain.",
      price: 5500,
      imageUrl: productImageUrl,
      category: "Farms",
      tags: ["Shark"],
      sticker: "STATIC SIFT",
      stickerFlag: "🇺🇸"
    },
    {
      name: "LEAF CAKE",
      brand: "CALITE FARM 🦍",
      description: "Sweet cake flavors.",
      price: 5500,
      imageUrl: productImageUrl,
      category: "Farms",
      tags: ["Plant"],
      sticker: "STATIC SIFT",
      stickerFlag: "🇺🇸"
    }
  ];

  for (const p of products) {
    await storage.createProduct(p);
  }
}
