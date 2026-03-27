import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull().default(0),
  imageUrl: text("image_url").notNull(),
  videoUrl: text("video_url"),
  category: text("category").notNull(),
  tags: jsonb("tags").$type<string[]>().default([]),
  sticker: text("sticker"),
  stickerFlag: text("sticker_flag"),
  priceOptions: jsonb("price_options").$type<{price: number, weight: string}[]>().default([]),
  stock: text("stock"),
});

export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  selectedPrice: integer("selected_price"),
  selectedWeight: text("selected_weight"),
});

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  name: text("name"),
  addedBy: text("added_by"),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderCode: text("order_code").notNull().unique(),
  sessionId: text("session_id").notNull(),
  chatId: text("chat_id"),
  orderData: text("order_data").notNull(),
  deliveryType: text("delivery_type").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at"),
  notes: text("notes"),
});

export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  productId: integer("product_id").notNull(),
});

export const savedAddresses = pgTable("saved_addresses", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  label: text("label"),
  address: text("address").notNull(),
  postalCode: text("postal_code").notNull(),
  city: text("city").notNull(),
  isDefault: boolean("is_default").default(false),
});

export const botUsers = pgTable("bot_users", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  isUnlocked: boolean("is_unlocked").notNull().default(false),
  unlockedAt: text("unlocked_at"),
});

export const accessPasswords = pgTable("access_passwords", {
  id: serial("id").primaryKey(),
  password: text("password").notNull(),
  label: text("label"),
  usageLimit: integer("usage_limit"),
  usageCount: integer("usage_count").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  username: text("username"),
  firstName: text("first_name"),
  text: text("text").notNull(),
  approved: boolean("approved").notNull().default(false),
});

export const promoCodes = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  discountPercent: integer("discount_percent").notNull(),
  active: boolean("active").notNull().default(true),
});

export const dailyStats = pgTable("daily_stats", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(),
  orderCount: integer("order_count").notNull().default(0),
  revenue: integer("revenue").notNull().default(0),
});

export const loyaltyBalances = pgTable("loyalty_balances", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull().unique(),
  points: integer("points").notNull().default(0),
  tier: text("tier").notNull().default("Bronze"),
  totalEarned: integer("total_earned").notNull().default(0),
});

export const loyaltyTransactions = pgTable("loyalty_transactions", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  orderCode: text("order_code"),
  description: text("description"),
  createdAt: text("created_at").notNull(),
});

export const loyaltySettings = pgTable("loyalty_settings", {
  id: serial("id").primaryKey(),
  pointsPerEuro: integer("points_per_euro").notNull().default(1),
  pointsValueCents: integer("points_value_cents").notNull().default(1),
  minRedeemPoints: integer("min_redeem_points").notNull().default(100),
  silverThreshold: integer("silver_threshold").notNull().default(500),
  goldThreshold: integer("gold_threshold").notNull().default(1500),
});

export const clientButtons = pgTable("client_buttons", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  url: text("url").notNull(),
  emoji: text("emoji"),
  active: boolean("active").notNull().default(true),
  position: integer("position").notNull().default(0),
  fullWidth: boolean("full_width").notNull().default(true),
});

export const botSettings = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertCartItemSchema = createInsertSchema(cartItems).omit({ id: true });
export const insertAdminSchema = createInsertSchema(admins).omit({ id: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true });
export const insertBotUserSchema = createInsertSchema(botUsers).omit({ id: true });
export const insertAccessPasswordSchema = createInsertSchema(accessPasswords).omit({ id: true });
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true });
export const insertPromoCodeSchema = createInsertSchema(promoCodes).omit({ id: true });
export const insertDailyStatsSchema = createInsertSchema(dailyStats).omit({ id: true });
export const insertLoyaltyBalanceSchema = createInsertSchema(loyaltyBalances).omit({ id: true });
export const insertLoyaltyTransactionSchema = createInsertSchema(loyaltyTransactions).omit({ id: true });
export const insertLoyaltySettingsSchema = createInsertSchema(loyaltySettings).omit({ id: true });
export const insertFavoriteSchema = createInsertSchema(favorites).omit({ id: true });
export const insertSavedAddressSchema = createInsertSchema(savedAddresses).omit({ id: true });
export const insertClientButtonSchema = createInsertSchema(clientButtons).omit({ id: true });

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type BotUser = typeof botUsers.$inferSelect;
export type InsertBotUser = z.infer<typeof insertBotUserSchema>;
export type AccessPassword = typeof accessPasswords.$inferSelect;
export type InsertAccessPassword = z.infer<typeof insertAccessPasswordSchema>;
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type PromoCode = typeof promoCodes.$inferSelect;
export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;
export type DailyStats = typeof dailyStats.$inferSelect;
export type InsertDailyStats = z.infer<typeof insertDailyStatsSchema>;
export type LoyaltyBalance = typeof loyaltyBalances.$inferSelect;
export type InsertLoyaltyBalance = z.infer<typeof insertLoyaltyBalanceSchema>;
export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type InsertLoyaltyTransaction = z.infer<typeof insertLoyaltyTransactionSchema>;
export type LoyaltySettings = typeof loyaltySettings.$inferSelect;
export type InsertLoyaltySettings = z.infer<typeof insertLoyaltySettingsSchema>;
export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type SavedAddress = typeof savedAddresses.$inferSelect;
export type InsertSavedAddress = z.infer<typeof insertSavedAddressSchema>;
export type ClientButton = typeof clientButtons.$inferSelect;
export type InsertClientButton = z.infer<typeof insertClientButtonSchema>;

export type CartItemWithProduct = CartItem & { product: Product };
export type FavoriteWithProduct = Favorite & { product: Product };
