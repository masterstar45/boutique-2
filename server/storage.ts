import { db } from "./db";
import {
  products,
  cartItems,
  admins,
  orders,
  botUsers,
  reviews,
  promoCodes,
  dailyStats,
  loyaltyBalances,
  loyaltyTransactions,
  loyaltySettings,
  accessPasswords,
  botSettings,
  favorites,
  savedAddresses,
  clientButtons,
  type Product,
  type InsertProduct,
  type CartItem,
  type InsertCartItem,
  type CartItemWithProduct,
  type Admin,
  type InsertAdmin,
  type Order,
  type InsertOrder,
  type BotUser,
  type InsertBotUser,
  type Review,
  type InsertReview,
  type PromoCode,
  type InsertPromoCode,
  type DailyStats,
  type LoyaltyBalance,
  type InsertLoyaltyBalance,
  type LoyaltyTransaction,
  type InsertLoyaltyTransaction,
  type LoyaltySettings,
  type InsertLoyaltySettings,
  type AccessPassword,
  type InsertAccessPassword,
  type Favorite,
  type InsertFavorite,
  type FavoriteWithProduct,
  type SavedAddress,
  type InsertSavedAddress,
  type ClientButton,
  type InsertClientButton
} from "@shared/schema";
import { eq, and, desc, count, ilike, or } from "drizzle-orm";

export interface IStorage {
  getProducts(category?: string, search?: string): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<void>;

  getCartItems(sessionId: string): Promise<CartItemWithProduct[]>;
  addToCart(item: InsertCartItem): Promise<CartItem>;
  removeFromCart(id: number): Promise<void>;
  clearCart(sessionId: string): Promise<void>;

  getAdmins(): Promise<Admin[]>;
  getAdminByTelegramId(telegramId: string): Promise<Admin | undefined>;
  addAdmin(admin: InsertAdmin): Promise<Admin>;
  removeAdmin(id: number): Promise<void>;

  createOrder(order: InsertOrder): Promise<Order>;
  getOrderByCode(orderCode: string): Promise<Order | undefined>;
  updateOrderStatus(orderCode: string, status: string): Promise<void>;
  getOrders(status?: string, limit?: number, offset?: number): Promise<Order[]>;
  getOrdersCount(status?: string): Promise<number>;
  deleteOrder(orderCode: string): Promise<void>;
  getOrdersByChatId(chatId: string): Promise<Order[]>;

  upsertBotUser(user: InsertBotUser): Promise<BotUser>;
  getAllBotUsers(): Promise<BotUser[]>;
  getBotUsersCount(): Promise<number>;
  getBotUserByChatId(chatId: string): Promise<BotUser | undefined>;
  isUserUnlocked(chatId: string): Promise<boolean>;
  unlockUser(chatId: string): Promise<void>;
  lockUser(chatId: string): Promise<void>;
  lockAllUsers(): Promise<void>;
  unlockAllUsers(): Promise<void>;
  deleteBotUser(chatId: string): Promise<void>;

  createReview(review: InsertReview): Promise<Review>;
  getApprovedReviews(): Promise<Review[]>;
  getPendingReviews(): Promise<Review[]>;
  approveReview(id: number): Promise<void>;
  deleteReview(id: number): Promise<void>;

  createPromoCode(promo: InsertPromoCode): Promise<PromoCode>;
  getPromoCodes(): Promise<PromoCode[]>;
  getPromoCodeByCode(code: string): Promise<PromoCode | undefined>;
  togglePromoCode(id: number, active: boolean): Promise<void>;
  deletePromoCode(id: number): Promise<void>;

  getDailyStats(date: string): Promise<DailyStats | undefined>;
  updateDailyStats(date: string, orderCount: number, revenue: number): Promise<DailyStats>;
  getRecentDailyStats(days: number): Promise<DailyStats[]>;

  getLoyaltyBalance(chatId: string): Promise<LoyaltyBalance | undefined>;
  upsertLoyaltyBalance(chatId: string, points: number, tier: string, totalEarned: number): Promise<LoyaltyBalance>;
  addLoyaltyPoints(chatId: string, delta: number, reason: string, orderCode?: string, description?: string): Promise<LoyaltyBalance>;
  getLoyaltyTransactions(chatId: string, limit?: number): Promise<LoyaltyTransaction[]>;
  getLoyaltySettings(): Promise<LoyaltySettings>;
  updateLoyaltySettings(settings: Partial<InsertLoyaltySettings>): Promise<LoyaltySettings>;
  getTopLoyaltyUsers(limit?: number): Promise<LoyaltyBalance[]>;
  searchLoyaltyUser(query: string): Promise<LoyaltyBalance | undefined>;

  createAccessPassword(password: string, label?: string, usageLimit?: number): Promise<AccessPassword>;
  getAccessPasswords(): Promise<AccessPassword[]>;
  validateAccessPassword(password: string): Promise<AccessPassword | null>;
  toggleAccessPassword(id: number, active: boolean): Promise<void>;
  deleteAccessPassword(id: number): Promise<void>;

  getBotSetting(key: string): Promise<string | null>;
  setBotSetting(key: string, value: string): Promise<void>;

  getFavorites(chatId: string): Promise<FavoriteWithProduct[]>;
  addFavorite(chatId: string, productId: number): Promise<Favorite>;
  removeFavorite(chatId: string, productId: number): Promise<void>;
  isFavorite(chatId: string, productId: number): Promise<boolean>;

  getSavedAddresses(chatId: string): Promise<SavedAddress[]>;
  addSavedAddress(address: InsertSavedAddress): Promise<SavedAddress>;
  updateSavedAddress(id: number, address: Partial<InsertSavedAddress>): Promise<SavedAddress | undefined>;
  deleteSavedAddress(id: number): Promise<void>;
  setDefaultAddress(chatId: string, addressId: number): Promise<void>;

  getClientButtons(activeOnly?: boolean): Promise<ClientButton[]>;
  getClientButton(id: number): Promise<ClientButton | undefined>;
  createClientButton(button: InsertClientButton): Promise<ClientButton>;
  updateClientButton(id: number, button: Partial<InsertClientButton>): Promise<ClientButton | undefined>;
  deleteClientButton(id: number): Promise<void>;
  toggleClientButton(id: number, active: boolean): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getProducts(category?: string, search?: string): Promise<Product[]> {
    let allProducts = await db.select().from(products);
    if (category) {
      allProducts = allProducts.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }
    if (search) {
      const s = search.toLowerCase();
      allProducts = allProducts.filter(p =>
        p.name.toLowerCase().includes(s) ||
        p.brand.toLowerCase().includes(s) ||
        p.description.toLowerCase().includes(s)
      );
    }
    return allProducts;
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db.update(products).set(product).where(eq(products.id, id)).returning();
    return updated;
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async getCartItems(sessionId: string): Promise<CartItemWithProduct[]> {
    const items = await db.select({ cartItem: cartItems, product: products })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.sessionId, sessionId));
    return items.map(({ cartItem, product }) => ({ ...cartItem, product }));
  }

  async addToCart(item: InsertCartItem): Promise<CartItem> {
    const existingItems = await db.select().from(cartItems)
      .where(and(eq(cartItems.sessionId, item.sessionId), eq(cartItems.productId, item.productId)));
    const existing = existingItems.find(e => e.selectedPrice === item.selectedPrice && e.selectedWeight === item.selectedWeight);
    if (existing) {
      const [updated] = await db.update(cartItems)
        .set({ quantity: existing.quantity + (item.quantity || 1) })
        .where(eq(cartItems.id, existing.id))
        .returning();
      return updated;
    }
    const [newItem] = await db.insert(cartItems).values(item).returning();
    return newItem;
  }

  async removeFromCart(id: number): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.id, id));
  }

  async clearCart(sessionId: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.sessionId, sessionId));
  }

  async getAdmins(): Promise<Admin[]> {
    return await db.select().from(admins);
  }

  async getAdminByTelegramId(telegramId: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.telegramId, telegramId));
    return admin;
  }

  async addAdmin(admin: InsertAdmin): Promise<Admin> {
    const [newAdmin] = await db.insert(admins).values(admin).returning();
    return newAdmin;
  }

  async removeAdmin(id: number): Promise<void> {
    await db.delete(admins).where(eq(admins.id, id));
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    return newOrder;
  }

  async getOrderByCode(orderCode: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.orderCode, orderCode));
    return order;
  }

  async updateOrderStatus(orderCode: string, status: string): Promise<void> {
    await db.update(orders).set({ status }).where(eq(orders.orderCode, orderCode));
  }

  async getOrders(status?: string, limit: number = 10, offset: number = 0): Promise<Order[]> {
    if (status) {
      return await db.select().from(orders).where(eq(orders.status, status)).orderBy(desc(orders.id)).limit(limit).offset(offset);
    }
    return await db.select().from(orders).orderBy(desc(orders.id)).limit(limit).offset(offset);
  }

  async getOrdersCount(status?: string): Promise<number> {
    if (status) {
      const result = await db.select({ count: count() }).from(orders).where(eq(orders.status, status));
      return result[0]?.count || 0;
    }
    const result = await db.select({ count: count() }).from(orders);
    return result[0]?.count || 0;
  }

  async deleteOrder(orderCode: string): Promise<void> {
    await db.delete(orders).where(eq(orders.orderCode, orderCode));
  }

  async getOrdersByChatId(chatId: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.chatId, chatId)).orderBy(desc(orders.id));
  }

  async upsertBotUser(user: InsertBotUser): Promise<BotUser> {
    const existing = await db.select().from(botUsers).where(eq(botUsers.chatId, user.chatId));
    if (existing.length > 0) {
      const [updated] = await db.update(botUsers)
        .set({ username: user.username, firstName: user.firstName })
        .where(eq(botUsers.chatId, user.chatId))
        .returning();
      return updated;
    }
    const [newUser] = await db.insert(botUsers).values(user).returning();
    return newUser;
  }

  async getAllBotUsers(): Promise<BotUser[]> {
    return await db.select().from(botUsers);
  }

  async getBotUsersCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(botUsers);
    return result[0]?.count || 0;
  }

  async getBotUserByChatId(chatId: string): Promise<BotUser | undefined> {
    const [user] = await db.select().from(botUsers).where(eq(botUsers.chatId, chatId));
    return user;
  }

  async isUserUnlocked(chatId: string): Promise<boolean> {
    const [user] = await db.select().from(botUsers).where(eq(botUsers.chatId, chatId));
    return user?.isUnlocked || false;
  }

  async unlockUser(chatId: string): Promise<void> {
    const [existingUser] = await db.select().from(botUsers).where(eq(botUsers.chatId, chatId));
    if (existingUser) {
      await db.update(botUsers).set({ isUnlocked: true, unlockedAt: new Date().toISOString() }).where(eq(botUsers.chatId, chatId));
    } else {
      await db.insert(botUsers).values({ chatId, isUnlocked: true, unlockedAt: new Date().toISOString() });
    }
  }

  async lockUser(chatId: string): Promise<void> {
    await db.update(botUsers).set({ isUnlocked: false, unlockedAt: null }).where(eq(botUsers.chatId, chatId));
  }

  async lockAllUsers(): Promise<void> {
    await db.update(botUsers).set({ isUnlocked: false, unlockedAt: null });
  }

  async unlockAllUsers(): Promise<void> {
    await db.update(botUsers).set({ isUnlocked: true, unlockedAt: new Date().toISOString() });
  }

  async deleteBotUser(chatId: string): Promise<void> {
    await db.delete(botUsers).where(eq(botUsers.chatId, chatId));
  }

  async createReview(review: InsertReview): Promise<Review> {
    const [newReview] = await db.insert(reviews).values(review).returning();
    return newReview;
  }

  async getApprovedReviews(): Promise<Review[]> {
    return await db.select().from(reviews).where(eq(reviews.approved, true)).orderBy(desc(reviews.id));
  }

  async getPendingReviews(): Promise<Review[]> {
    return await db.select().from(reviews).where(eq(reviews.approved, false)).orderBy(desc(reviews.id));
  }

  async approveReview(id: number): Promise<void> {
    await db.update(reviews).set({ approved: true }).where(eq(reviews.id, id));
  }

  async deleteReview(id: number): Promise<void> {
    await db.delete(reviews).where(eq(reviews.id, id));
  }

  async createPromoCode(promo: InsertPromoCode): Promise<PromoCode> {
    const [newPromo] = await db.insert(promoCodes).values(promo).returning();
    return newPromo;
  }

  async getPromoCodes(): Promise<PromoCode[]> {
    return await db.select().from(promoCodes).orderBy(desc(promoCodes.id));
  }

  async getPromoCodeByCode(code: string): Promise<PromoCode | undefined> {
    const [promo] = await db.select().from(promoCodes).where(eq(promoCodes.code, code.toUpperCase()));
    return promo;
  }

  async togglePromoCode(id: number, active: boolean): Promise<void> {
    await db.update(promoCodes).set({ active }).where(eq(promoCodes.id, id));
  }

  async deletePromoCode(id: number): Promise<void> {
    await db.delete(promoCodes).where(eq(promoCodes.id, id));
  }

  async getDailyStats(date: string): Promise<DailyStats | undefined> {
    const [stats] = await db.select().from(dailyStats).where(eq(dailyStats.date, date));
    return stats;
  }

  async updateDailyStats(date: string, orderCount: number, revenue: number): Promise<DailyStats> {
    const existing = await this.getDailyStats(date);
    if (existing) {
      const [updated] = await db.update(dailyStats)
        .set({ orderCount: existing.orderCount + orderCount, revenue: existing.revenue + revenue })
        .where(eq(dailyStats.date, date))
        .returning();
      return updated;
    }
    const [newStats] = await db.insert(dailyStats).values({ date, orderCount, revenue }).returning();
    return newStats;
  }

  async getRecentDailyStats(days: number): Promise<DailyStats[]> {
    return await db.select().from(dailyStats).orderBy(desc(dailyStats.date)).limit(days);
  }

  async getLoyaltyBalance(chatId: string): Promise<LoyaltyBalance | undefined> {
    const [balance] = await db.select().from(loyaltyBalances).where(eq(loyaltyBalances.chatId, chatId));
    return balance;
  }

  async upsertLoyaltyBalance(chatId: string, points: number, tier: string, totalEarned: number): Promise<LoyaltyBalance> {
    const existing = await this.getLoyaltyBalance(chatId);
    if (existing) {
      const [updated] = await db.update(loyaltyBalances).set({ points, tier, totalEarned }).where(eq(loyaltyBalances.chatId, chatId)).returning();
      return updated;
    }
    const [newBalance] = await db.insert(loyaltyBalances).values({ chatId, points, tier, totalEarned }).returning();
    return newBalance;
  }

  async addLoyaltyPoints(chatId: string, delta: number, reason: string, orderCode?: string, description?: string): Promise<LoyaltyBalance> {
    const settings = await this.getLoyaltySettings();
    let balance = await this.getLoyaltyBalance(chatId);
    if (!balance) {
      balance = await this.upsertLoyaltyBalance(chatId, 0, 'bronze', 0);
    }
    const newPoints = Math.max(0, balance.points + delta);
    const newTotalEarned = delta > 0 ? balance.totalEarned + delta : balance.totalEarned;
    let newTier = 'bronze';
    if (newTotalEarned >= settings.goldThreshold) newTier = 'gold';
    else if (newTotalEarned >= settings.silverThreshold) newTier = 'silver';

    await db.insert(loyaltyTransactions).values({
      chatId,
      orderCode: orderCode || null,
      delta,
      reason,
      description: description || null,
      createdAt: new Date().toISOString()
    });

    return await this.upsertLoyaltyBalance(chatId, newPoints, newTier, newTotalEarned);
  }

  async getLoyaltyTransactions(chatId: string, limit: number = 20): Promise<LoyaltyTransaction[]> {
    return await db.select().from(loyaltyTransactions).where(eq(loyaltyTransactions.chatId, chatId)).orderBy(desc(loyaltyTransactions.id)).limit(limit);
  }

  async getLoyaltySettings(): Promise<LoyaltySettings> {
    const [settings] = await db.select().from(loyaltySettings);
    if (settings) return settings;
    const [defaultSettings] = await db.insert(loyaltySettings).values({
      earnRate: 100, redeemRate: 10, bronzeThreshold: 0, silverThreshold: 100,
      goldThreshold: 500, silverMultiplier: 125, goldMultiplier: 150
    }).returning();
    return defaultSettings;
  }

  async updateLoyaltySettings(settings: Partial<InsertLoyaltySettings>): Promise<LoyaltySettings> {
    const current = await this.getLoyaltySettings();
    const [updated] = await db.update(loyaltySettings).set(settings).where(eq(loyaltySettings.id, current.id)).returning();
    return updated;
  }

  async getTopLoyaltyUsers(limit: number = 10): Promise<LoyaltyBalance[]> {
    return await db.select().from(loyaltyBalances).orderBy(desc(loyaltyBalances.totalEarned)).limit(limit);
  }

  async searchLoyaltyUser(query: string): Promise<LoyaltyBalance | undefined> {
    const [balance] = await db.select().from(loyaltyBalances).where(eq(loyaltyBalances.chatId, query));
    return balance;
  }

  async createAccessPassword(password: string, label?: string, usageLimit?: number): Promise<AccessPassword> {
    const timestamp = new Date().toISOString().slice(0, 10);
    const [newPassword] = await db.insert(accessPasswords).values({
      password,
      label: label || `MDP-${timestamp}`,
      usageLimit: usageLimit || null,
      usageCount: 0,
      active: true,
      createdAt: new Date().toISOString()
    }).returning();
    return newPassword;
  }

  async getAccessPasswords(): Promise<AccessPassword[]> {
    return await db.select().from(accessPasswords).orderBy(desc(accessPasswords.id));
  }

  async validateAccessPassword(password: string): Promise<AccessPassword | null> {
    const activePasswords = await db.select().from(accessPasswords).where(eq(accessPasswords.active, true));
    for (const pwd of activePasswords) {
      if (pwd.password === password) {
        if (pwd.usageLimit && pwd.usageCount >= pwd.usageLimit) return null;
        await db.update(accessPasswords).set({ usageCount: pwd.usageCount + 1 }).where(eq(accessPasswords.id, pwd.id));
        return pwd;
      }
    }
    return null;
  }

  async toggleAccessPassword(id: number, active: boolean): Promise<void> {
    await db.update(accessPasswords).set({ active }).where(eq(accessPasswords.id, id));
  }

  async deleteAccessPassword(id: number): Promise<void> {
    await db.delete(accessPasswords).where(eq(accessPasswords.id, id));
  }

  async getBotSetting(key: string): Promise<string | null> {
    const [setting] = await db.select().from(botSettings).where(eq(botSettings.key, key));
    return setting?.value || null;
  }

  async setBotSetting(key: string, value: string): Promise<void> {
    const [existing] = await db.select().from(botSettings).where(eq(botSettings.key, key));
    if (existing) {
      await db.update(botSettings).set({ value }).where(eq(botSettings.key, key));
    } else {
      await db.insert(botSettings).values({ key, value });
    }
  }

  async getFavorites(chatId: string): Promise<FavoriteWithProduct[]> {
    const items = await db.select({ favorite: favorites, product: products })
      .from(favorites)
      .innerJoin(products, eq(favorites.productId, products.id))
      .where(eq(favorites.chatId, chatId));
    return items.map(({ favorite, product }) => ({ ...favorite, product }));
  }

  async addFavorite(chatId: string, productId: number): Promise<Favorite> {
    const [existing] = await db.select().from(favorites).where(and(eq(favorites.chatId, chatId), eq(favorites.productId, productId)));
    if (existing) return existing;
    const [newFav] = await db.insert(favorites).values({ chatId, productId }).returning();
    return newFav;
  }

  async removeFavorite(chatId: string, productId: number): Promise<void> {
    await db.delete(favorites).where(and(eq(favorites.chatId, chatId), eq(favorites.productId, productId)));
  }

  async isFavorite(chatId: string, productId: number): Promise<boolean> {
    const [existing] = await db.select().from(favorites).where(and(eq(favorites.chatId, chatId), eq(favorites.productId, productId)));
    return !!existing;
  }

  async getSavedAddresses(chatId: string): Promise<SavedAddress[]> {
    return await db.select().from(savedAddresses).where(eq(savedAddresses.chatId, chatId));
  }

  async addSavedAddress(address: InsertSavedAddress): Promise<SavedAddress> {
    const [newAddress] = await db.insert(savedAddresses).values(address).returning();
    return newAddress;
  }

  async updateSavedAddress(id: number, address: Partial<InsertSavedAddress>): Promise<SavedAddress | undefined> {
    const [updated] = await db.update(savedAddresses).set(address).where(eq(savedAddresses.id, id)).returning();
    return updated;
  }

  async deleteSavedAddress(id: number): Promise<void> {
    await db.delete(savedAddresses).where(eq(savedAddresses.id, id));
  }

  async setDefaultAddress(chatId: string, addressId: number): Promise<void> {
    await db.update(savedAddresses).set({ isDefault: false }).where(eq(savedAddresses.chatId, chatId));
    await db.update(savedAddresses).set({ isDefault: true }).where(eq(savedAddresses.id, addressId));
  }

  async getClientButtons(activeOnly: boolean = false): Promise<ClientButton[]> {
    if (activeOnly) {
      return await db.select().from(clientButtons).where(eq(clientButtons.active, true)).orderBy(clientButtons.position);
    }
    return await db.select().from(clientButtons).orderBy(clientButtons.position);
  }

  async getClientButton(id: number): Promise<ClientButton | undefined> {
    const [button] = await db.select().from(clientButtons).where(eq(clientButtons.id, id));
    return button;
  }

  async createClientButton(button: InsertClientButton): Promise<ClientButton> {
    const [newButton] = await db.insert(clientButtons).values(button).returning();
    return newButton;
  }

  async updateClientButton(id: number, button: Partial<InsertClientButton>): Promise<ClientButton | undefined> {
    const [updated] = await db.update(clientButtons).set(button).where(eq(clientButtons.id, id)).returning();
    return updated;
  }

  async deleteClientButton(id: number): Promise<void> {
    await db.delete(clientButtons).where(eq(clientButtons.id, id));
  }

  async toggleClientButton(id: number, active: boolean): Promise<void> {
    await db.update(clientButtons).set({ active }).where(eq(clientButtons.id, id));
  }
}

export const storage = new DatabaseStorage();
