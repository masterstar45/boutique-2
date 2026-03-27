import { Link } from "wouter";
import { Play } from "lucide-react";
import { motion } from "framer-motion";
import type { Product } from "@workspace/api-client-react";

interface ProductCardProps {
  product: Product;
}

const GOLD = "rgba(201,160,76,";

export function ProductCard({ product }: ProductCardProps) {
  const priceOptions = product.priceOptions || [];
  const tags = product.tags || [];

  let minPrice = product.price;
  if (priceOptions.length > 0) {
    const prices = priceOptions.map(o => o.price);
    minPrice = Math.min(...prices);
  }

  const hasMultiplePrices = priceOptions.length > 1;

  return (
    <Link href={`/product/${product.id}`}>
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="group flex flex-col h-full rounded-[1.5rem] overflow-hidden cursor-pointer shine-effect"
        style={{
          background: "rgba(16, 12, 8, 0.7)",
          border: "1px solid rgba(201,160,76,0.1)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,240,180,0.03)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Image */}
        <div className="relative aspect-square w-full overflow-hidden"
          style={{ background: "rgba(12,9,5,0.5)" }}>
          {/* Sticker badge */}
          {product.sticker && (
            <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full"
              style={{
                background: "rgba(8,6,3,0.85)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(201,160,76,0.2)",
              }}>
              {product.stickerFlag && <span className="text-[9px] leading-none">{product.stickerFlag}</span>}
              <span className="text-[9px] font-medium tracking-widest uppercase" style={{ color: `${GOLD}0.9)` }}>
                {product.sticker}
              </span>
            </div>
          )}

          {/* Video badge */}
          {product.videoUrl && (
            <div className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(8,6,3,0.8)",
                border: "1px solid rgba(201,160,76,0.2)",
              }}>
              <Play className="w-3 h-3 fill-current ml-0.5" style={{ color: `${GOLD}0.9)` }} />
            </div>
          )}

          <img
            src={product.imageUrl || "https://images.unsplash.com/photo-1603584860006-25f0a0584b42?w=800&h=800&fit=crop"}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
            loading="lazy"
          />

          {/* Bottom gradient */}
          <div className="absolute inset-0"
            style={{ background: "linear-gradient(to top, rgba(8,6,3,0.95) 0%, rgba(8,6,3,0.3) 40%, transparent 70%)" }} />

          {/* Gold shimmer on hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: "radial-gradient(circle at 50% 50%, rgba(201,160,76,0.06) 0%, transparent 70%)" }} />
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-3.5">
          {/* Brand */}
          {product.brand && (
            <p className="text-[9px] font-medium tracking-[0.2em] uppercase mb-1"
              style={{ color: `${GOLD}0.6)` }}>
              {product.brand}
            </p>
          )}

          {/* Name */}
          <h3 className="font-display font-medium text-sm leading-tight line-clamp-2 mb-2"
            style={{ color: "rgba(242,234,218,0.92)", letterSpacing: "0.01em" }}>
            {product.name}
          </h3>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2.5">
              {tags.slice(0, 2).map((tag) => (
                <span key={tag}
                  className="text-[8px] font-medium tracking-[0.15em] uppercase px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(201,160,76,0.06)",
                    border: "1px solid rgba(201,160,76,0.15)",
                    color: `${GOLD}0.7)`,
                  }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Price row */}
          <div className="mt-auto pt-2.5 flex items-center justify-between"
            style={{ borderTop: "1px solid rgba(201,160,76,0.08)" }}>
            <div>
              {minPrice > 0 ? (
                <div className="flex items-baseline gap-1">
                  {hasMultiplePrices && (
                    <span className="text-[9px] font-medium" style={{ color: `${GOLD}0.55)` }}>dès</span>
                  )}
                  <span className="font-display text-base font-medium gradient-gold">{minPrice}€</span>
                </div>
              ) : (
                <span className="font-display text-base font-medium" style={{ color: `${GOLD}0.9)` }}>
                  {product.price}€
                </span>
              )}
            </div>

            {/* Plus button */}
            <div className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110"
              style={{
                background: "rgba(201,160,76,0.08)",
                border: "1px solid rgba(201,160,76,0.2)",
              }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke={`${GOLD}0.9)`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="M12 5v14"/>
              </svg>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
