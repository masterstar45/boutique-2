import { Link } from "wouter";
import { Play } from "lucide-react";
import { motion } from "framer-motion";
import type { Product } from "@workspace/api-client-react";

interface ProductCardProps {
  product: Product;
}

const tagColors: Record<string, string> = {
  indica: "bg-purple-500/20 text-purple-400",
  sativa: "bg-amber-500/20 text-amber-400",
  hybrid: "bg-emerald-500/20 text-emerald-400",
  cbd: "bg-blue-500/20 text-blue-400",
  premium: "bg-yellow-500/20 text-yellow-400",
};

export function ProductCard({ product }: ProductCardProps) {
  const priceOptions = product.priceOptions || [];
  const tags = product.tags || [];

  let minPrice = product.price;
  if (priceOptions.length > 0) {
    const prices = priceOptions.map(o => o.price);
    minPrice = Math.min(...prices);
  }

  return (
    <Link href={`/product/${product.id}`}>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }}
        className="group flex flex-col h-full glass-panel shine-effect rounded-[1.5rem] overflow-hidden cursor-pointer"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-white/5">
          {product.sticker && (
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-white/10">
              {product.stickerFlag && <span className="text-[10px] leading-none">{product.stickerFlag}</span>}
              <span className="text-[10px] font-bold tracking-widest text-white uppercase">{product.sticker}</span>
            </div>
          )}
          
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          {/* Unsplash fallback for missing images or just render URL */}
          <img 
            src={product.imageUrl || "https://images.unsplash.com/photo-1603584860006-25f0a0584b42?w=800&h=800&fit=crop"} 
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
          
          {product.videoUrl && (
            <div className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg">
              <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
            </div>
          )}
        </div>

        <div className="flex flex-col flex-1 p-4">
          <div className="mb-2">
            <p className="text-[11px] font-medium text-primary tracking-wider uppercase mb-1">{product.brand}</p>
            <h3 className="text-sm font-bold text-foreground leading-tight line-clamp-2">{product.name}</h3>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${tagColors[tag.toLowerCase()] || "bg-white/10 text-white/60"}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          
          <div className="mt-auto pt-3 flex items-center justify-between border-t border-white/5">
            <div className="flex flex-col">
              {minPrice > 0 ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Dès</span>
                  <span className="text-sm font-extrabold text-foreground">{minPrice}€</span>
                </div>
              ) : (
                <span className="text-sm font-extrabold text-foreground">{product.price}€</span>
              )}
            </div>
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
