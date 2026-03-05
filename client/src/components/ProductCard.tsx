import { Product } from "@shared/schema";
import { useLocation } from "wouter";
import { Plus, Play } from "lucide-react";
import { motion } from "framer-motion";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const [, navigate] = useLocation();

  const priceOptions = (product.priceOptions || []) as { price: number; weight: string }[];

  let priceDisplay = "";
  if (priceOptions.length > 0) {
    const prices = priceOptions.map(o => o.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    priceDisplay = min === max ? `${min}€` : `${min}€ - ${max}€`;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onClick={() => navigate(`/product/${product.id}`)}
      className="group flex flex-col glass-panel rounded-[1.5rem] overflow-hidden cursor-pointer"
      data-testid={`card-product-${product.id}`}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-white/5">
        {product.sticker && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-white/10">
            {product.stickerFlag && <span className="text-[10px] leading-none">{product.stickerFlag}</span>}
            <span className="text-[10px] font-bold tracking-widest text-white uppercase">{product.sticker}</span>
          </div>
        )}
        
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <img 
          src={product.imageUrl} 
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
        
        <div className="mt-auto pt-3 flex items-center justify-between border-t border-white/5">
          <div className="flex flex-col">
            {priceDisplay ? (
              <span className="text-sm font-extrabold text-foreground" data-testid={`text-price-${product.id}`}>{priceDisplay}</span>
            ) : (
              <span className="text-xs font-medium text-muted-foreground">Voir options</span>
            )}
            {product.stock && (
              <span className="text-[10px] text-muted-foreground flex items-center mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mr-1.5 shadow-[0_0_5px_rgba(34,197,94,0.8)]" />
                {product.stock} dispo
              </span>
            )}
          </div>
          
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-active:scale-95 shadow-sm">
            <Plus className="w-5 h-5" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
