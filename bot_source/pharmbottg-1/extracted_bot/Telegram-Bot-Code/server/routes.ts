
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

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

  // SEED DATA
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existing = await storage.getProducts();
  if (existing.length > 0) return;

  const products = [
    {
      name: "AMARETO",
      brand: "CALITE FARM 🦍",
      description: "Premium quality strain with distinct aroma.",
      price: 5000, // 50.00
      imageUrl: "https://placehold.co/400x600/2a2a2a/white?text=Amareto",
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
      imageUrl: "https://placehold.co/400x600/2a2a2a/white?text=Biscotti",
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
      imageUrl: "https://placehold.co/400x600/2a2a2a/white?text=HH",
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
      imageUrl: "https://placehold.co/400x600/2a2a2a/white?text=Leaf+Cake",
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
