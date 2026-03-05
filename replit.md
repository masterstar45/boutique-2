# PharmacyHash - Telegram Mini App

## Overview
PharmacyHash is a Telegram Mini App for a pharmacy/dispensary bot. It provides product browsing, cart, checkout with multiple delivery options, loyalty points, reviews, and a full admin dashboard.

## Architecture
- **Frontend**: React + Vite, TailwindCSS v4, wouter routing, TanStack Query
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL via Drizzle ORM (Neon in production on Railway)
- **Bot**: node-telegram-bot-api (runs only in production mode)

## Design System
- **Theme**: Dark Glassmorphism
- **Primary color**: `hsl(150 80% 45%)` (green)
- **Background**: `hsl(150 10% 4%)`
- **Glass utility**: `glass-panel` class = `bg-card/60 backdrop-blur-xl border border-white/10 shadow`
- **Fonts**: Outfit (display) + Plus Jakarta Sans (body)
- **Tailwind v4**: Uses `@import "tailwindcss"` and `@theme inline {}` blocks

## Key Files
- `shared/schema.ts` - All Drizzle table definitions and types
- `shared/routes.ts` - API contract with Zod schemas
- `server/db.ts` - Database connection (Neon serverless)
- `server/storage.ts` - Full IStorage interface and DatabaseStorage implementation
- `server/routes.ts` - All API routes (products, cart, checkout, reviews, loyalty, favorites, addresses, admin)
- `server/bot.ts` - Telegram bot with admin menu (products, orders, reviews, promos, loyalty, users, passwords)
- `server/index.ts` - Express server entry point
- `client/src/App.tsx` - Main app with routing
- `client/src/pages/Admin.tsx` - Admin dashboard with real API data

## API Routes

### Public
- `GET /api/products` - List products (with optional category/search filters)
- `GET /api/products/:id` - Get single product
- `GET /api/cart/:sessionId` - Get cart items
- `POST /api/upload` - Upload image/video file (multer, max 50MB, returns URL)
- `POST /api/cart` - Add to cart
- `PATCH /api/cart/:id` - Update cart item quantity (requires sessionId for ownership check)
- `DELETE /api/cart/:id` - Remove from cart
- `DELETE /api/cart/session/:sessionId` - Clear cart
- `POST /api/checkout` - Create order
- `GET /api/reviews` - Get approved reviews
- `POST /api/reviews` - Submit review
- `POST /api/promo/validate` - Validate promo code
- `GET /api/loyalty/:chatId` - Get loyalty balance
- `GET /api/loyalty/:chatId/history` - Get loyalty transactions
- `GET /api/loyalty-settings` - Get loyalty program settings
- `GET /api/admin/orders/new-count` - Count orders in last 5 minutes (admin notification)
- `GET /api/orders/:chatId` - Get user orders
- `GET /api/favorites/:chatId` - Get favorites
- `POST /api/favorites` - Add favorite
- `DELETE /api/favorites/:chatId/:productId` - Remove favorite
- `GET /api/favorites/:chatId/check/:productId` - Check if favorited
- `GET /api/addresses/:chatId` - Get saved addresses
- `POST /api/addresses` - Add address
- `DELETE /api/addresses/:id` - Delete address
- `PUT /api/addresses/:id/default` - Set default address

### Admin
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/orders` - List orders (filterable by status)
- `PATCH /api/admin/orders/:orderCode/status` - Update order status
- `DELETE /api/admin/orders/:orderCode` - Delete order
- `POST /api/admin/products` - Create product
- `PATCH /api/admin/products/:id` - Update product
- `DELETE /api/admin/products/:id` - Delete product
- `GET /api/admin/reviews/pending` - Get pending reviews
- `POST /api/admin/reviews/:id/approve` - Approve review
- `DELETE /api/admin/reviews/:id` - Delete review
- `GET /api/admin/promo-codes` - List promo codes
- `POST /api/admin/promo-codes` - Create promo code
- `PATCH /api/admin/promo-codes/:id/toggle` - Toggle promo code active/inactive
- `DELETE /api/admin/promo-codes/:id` - Delete promo code
- `GET /api/admin/users` - List all bot users

## Deployment
- Target: Railway with Neon PostgreSQL
- Environment variables needed: DATABASE_URL, TELEGRAM_BOT_TOKEN, ADMIN_TELEGRAM_ID, SESSION_SECRET, NODE_ENV=production
- Bot only starts when NODE_ENV=production

## Path Aliases
- `@assets` -> `attached_assets/`
- `@shared` -> `shared/`
- `@` -> `client/src/`

## Notes
- Home page: clean background image only (no text, no logo)
- BottomNav: floating pill-style, hidden on home, cart, product detail, and admin pages
- Admin dashboard accessible at `/admin`
- Telegram user identification via `window.Telegram?.WebApp?.initDataUnsafe?.user?.id`
