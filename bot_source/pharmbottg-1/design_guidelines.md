# Pharmacy E-Commerce Design Guidelines
## Telegram Mini App Style

### Design Approach
**Reference**: Telegram Mini Apps + modern e-commerce (Instacart, Delivery Hero)
**Primary Direction**: Telegram's signature clean interface with card-based layouts, smooth transitions, and bottom-anchored navigation. Dark theme foundation with strategic green health accents.

### Typography
**Font Family**: Inter or SF Pro Display (via Google Fonts CDN)
- **Headings**: 24px/32px (bold/600) for section titles
- **Product Names**: 16px/20px (medium/500)
- **Body**: 14px/20px (regular/400)
- **Captions**: 12px/16px (regular/400) for metadata
- **Prices**: 18px/24px (semibold/600)

### Layout System
**Spacing Units**: Tailwind spacing of 3, 4, 6, 8, 12, 16
- Container padding: px-4 (16px horizontal)
- Section gaps: space-y-6 (24px vertical)
- Card padding: p-4 (16px internal)
- Bottom navigation height: h-16 (64px)

**Grid System**:
- Product grid: 2 columns on mobile (grid-cols-2 gap-3)
- Category pills: Horizontal scroll (flex overflow-x-auto gap-2)
- Reviews: Single column cards (space-y-4)

### Core Components

**Bottom Navigation** (Fixed):
- 4-5 icons: Home, Categories, Cart (with badge), Orders, Profile
- Icons from Heroicons (outline for inactive, solid for active)
- Active state with green accent indicator

**Product Cards**:
- Rounded corners (rounded-xl)
- Image aspect ratio 1:1 with rounded-t-xl
- Overlay badge for "Prescription Required" (top-left)
- Product name, dosage/size, price stacked
- Add to cart button (small, green accent)
- Shadow: shadow-lg for elevation

**Category Navigation**:
- Horizontal scrollable pills below header
- Rounded-full pills with px-4 py-2
- Active category: filled green, inactive: subtle border

**Search Bar** (Sticky Header):
- Rounded-full input field
- Heroicons magnifying-glass-icon left
- Filter icon right
- Backdrop blur effect (backdrop-blur-md)

**Shopping Cart**:
- Slide-up sheet from bottom
- Product rows with thumbnail (48x48), name, quantity stepper
- Subtotal, delivery fee, total breakdown
- Prominent "Checkout" button (full-width, green)

**Product Detail Page**:
- Full-width hero image (aspect-video)
- Image gallery dots indicator
- Sticky bottom bar with price + "Add to Cart"
- Product info: name, manufacturer, dosage, description
- Reviews section with star ratings, user avatars, timestamps

**Review Cards**:
- User avatar (40x40 rounded-full) left
- Name, star rating, date top row
- Review text below with "Read more" for long reviews
- Helpful button count

**Empty States**:
- Centered icon (96x96) with explanatory text
- CTA button below for relevant action

### Images

**Product Images**:
- White/light background products on transparent
- Square format (400x400px minimum)
- Professional pharmacy product photography
- Place in product cards, detail pages, cart items

**Category Headers**:
- Decorative health/wellness illustrations
- Soft gradients or abstract shapes
- Header banners (1200x300px)

**No Hero Section**: Direct to category navigation and product grid for immediate utility

**Empty State Icons**:
- Shopping cart illustration for empty cart
- Search illustration for no results
- Pills/medication icons for categories

### Animations
**Minimal & Purposeful**:
- Cart badge pulse on item add (scale animation)
- Bottom sheet slide-up (transform translate-y)
- Product card press feedback (scale-95 active state)
- Skeleton loading for product grid
- NO scroll-based or decorative animations

### Component Hierarchy
1. **Sticky Header**: Search + Cart icon
2. **Category Pills**: Horizontal scroll
3. **Product Grid**: 2-column masonry
4. **Bottom Navigation**: Fixed, always visible
5. **Floating Action**: Quick reorder button (orders page)

### Accessibility
- Touch targets: min 44x44px
- Contrast: WCAG AA on dark theme
- Focus indicators with green accent
- Semantic HTML for screen readers
- Quantity steppers with aria-labels