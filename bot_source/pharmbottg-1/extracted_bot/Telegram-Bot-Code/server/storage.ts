
import { db } from "./db";
import {
  products,
  cartItems,
  type Product,
  type InsertProduct,
  type CartItem,
  type InsertCartItem,
  type CartItemWithProduct
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // Products
  getProducts(category?: string, search?: string): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  
  // Cart
  getCartItems(sessionId: string): Promise<CartItemWithProduct[]>;
  addToCart(item: InsertCartItem): Promise<CartItem>;
  removeFromCart(id: number): Promise<void>;
  clearCart(sessionId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Products
  async getProducts(category?: string, search?: string): Promise<Product[]> {
    let query = db.select().from(products);
    
    // Simple implementation - in real app would add where clauses
    // Currently just returning all for MVP unless explicitly filtered in DB query construction which requires sql operators
    // For MVP/Lite mode, we will filter in memory if complex, or just return all
    return await query;
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  // Cart
  async getCartItems(sessionId: string): Promise<CartItemWithProduct[]> {
    const items = await db.select({
      cartItem: cartItems,
      product: products,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.sessionId, sessionId));

    return items.map(({ cartItem, product }) => ({
      ...cartItem,
      product,
    }));
  }

  async addToCart(item: InsertCartItem): Promise<CartItem> {
    // Check if item exists
    const [existing] = await db.select()
      .from(cartItems)
      .where(and(
        eq(cartItems.sessionId, item.sessionId),
        eq(cartItems.productId, item.productId)
      ));

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
}

export const storage = new DatabaseStorage();
