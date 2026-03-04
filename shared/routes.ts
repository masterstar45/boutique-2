
import { z } from 'zod';
import { insertCartItemSchema, products, cartItems } from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  products: {
    list: {
      method: 'GET' as const,
      path: '/api/products',
      input: z.object({
        category: z.string().optional(),
        search: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof products.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/products/:id',
      responses: {
        200: z.custom<typeof products.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/products',
      input: z.object({
        name: z.string(),
        brand: z.string(),
        description: z.string(),
        price: z.number(),
        imageUrl: z.string(),
        videoUrl: z.string().optional(),
        category: z.string(),
        tags: z.array(z.string()).optional(),
        sticker: z.string().optional(),
        stickerFlag: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof products.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/products/:id',
      input: z.object({
        name: z.string().optional(),
        brand: z.string().optional(),
        description: z.string().optional(),
        price: z.number().optional(),
        imageUrl: z.string().optional(),
        videoUrl: z.string().optional(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        sticker: z.string().optional(),
        stickerFlag: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof products.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/products/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  cart: {
    list: {
      method: 'GET' as const,
      path: '/api/cart/:sessionId',
      responses: {
        200: z.array(z.custom<typeof cartItems.$inferSelect & { product: typeof products.$inferSelect }>()),
      },
    },
    add: {
      method: 'POST' as const,
      path: '/api/cart',
      input: insertCartItemSchema,
      responses: {
        200: z.custom<typeof cartItems.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    remove: {
      method: 'DELETE' as const,
      path: '/api/cart/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    clear: {
      method: 'DELETE' as const,
      path: '/api/cart/session/:sessionId',
      responses: {
        204: z.void(),
      },
    },
  },
};

// ============================================
// REQUIRED: buildUrl helper
// ============================================
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
