# PharmacyHash

## Overview

PharmacyHash is a Telegram Mini App-style e-commerce platform for a pharmacy/dispensary. It provides a mobile-first web interface with product browsing, shopping cart functionality, customer reviews, and store information. The application includes a Telegram bot for admin product management and integrates with a PostgreSQL database for persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state caching and synchronization
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style variant)
- **Animations**: Framer Motion for page transitions and micro-interactions
- **Build Tool**: Vite with React plugin

The frontend follows a mobile-first design pattern optimized for Telegram's in-app browser. Key pages include Home (landing), Menu (product catalog), Cart, Reviews, and Info. Components are organized with reusable UI primitives in `client/src/components/ui/` and feature components at the `client/src/components/` level.

### Backend Architecture

- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Pattern**: RESTful endpoints defined in `shared/routes.ts` with Zod schema validation
- **Build**: Custom esbuild script for production bundling

The server handles API requests for products and cart operations. In development, Vite middleware serves the frontend with HMR. In production, static files are served from the `dist/public` directory.

### Data Storage

- **Database**: PostgreSQL via Neon serverless driver (`@neondatabase/serverless`)
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-validation integration
- **Schema Location**: `shared/schema.ts` defines tables for `products` and `cart_items`
- **Migrations**: Managed via `drizzle-kit push` command

Cart sessions use client-generated session IDs stored in localStorage, linking anonymous users to their cart items.

### Telegram Bot Integration

- **Library**: `node-telegram-bot-api`
- **Purpose**: Admin interface for product management (add, edit, delete products)
- **Authentication**: Admin identified by `ADMIN_TELEGRAM_ID` environment variable
- **State Machine**: Conversation flow managed via in-memory session tracking

### API Contract

Shared type definitions in `shared/routes.ts` define the API contract using Zod schemas:
- `GET /api/products` - List products with optional category/search filters
- `GET /api/products/:id` - Get single product
- `GET /api/cart/:sessionId` - Get cart items for session
- `POST /api/cart` - Add item to cart
- `DELETE /api/cart/:id` - Remove cart item
- `DELETE /api/cart/session/:sessionId` - Clear entire cart

## Deployment

### Railway (Optional)
The project is compatible with Railway.app. 
- Build: Nixpacks
- Start: \`npm run start\`
- Env vars: \`DATABASE_URL\`, \`TELEGRAM_BOT_TOKEN\`, \`ADMIN_TELEGRAM_ID\`, \`NODE_ENV=production\`

### Replit (Primary)
The app is currently published on Replit.

### Database
- **PostgreSQL**: Primary data store, connected via `DATABASE_URL` environment variable
- **Neon Serverless**: PostgreSQL driver optimized for serverless/edge environments with WebSocket support

### Telegram
- **Telegram Bot API**: Used for admin product management
- **Environment Variables**: `TELEGRAM_BOT_TOKEN`, `ADMIN_TELEGRAM_ID`

### Frontend Libraries
- **Radix UI**: Headless component primitives for accessibility
- **Lucide React**: Icon library
- **date-fns**: Date formatting utilities
- **embla-carousel-react**: Carousel component

### Development Tools
- **Vite**: Development server with HMR
- **Drizzle Kit**: Database migration tooling
- **esbuild**: Production bundling for server code