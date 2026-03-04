import { Product } from "@shared/schema";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useAddToCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const addToCart = useAddToCart();
  const isPending = addToCart.isPending;

  // Format price from cents to EUR
  const formattedPrice = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(product.price / 100);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="group relative flex flex-col bg-card rounded-[20px] overflow-hidden shadow-sm border border-white/5 active:scale-[0.98] transition-transform duration-200"
    >
      {/* Sticker Badge */}
      {product.sticker && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-black/70 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 shadow-lg">
          {product.stickerFlag && <span className="text-xs">{product.stickerFlag}</span>}
          <span className="text-[10px] font-bold tracking-wider text-white uppercase">{product.sticker}</span>
        </div>
      )}

      {/* Image Container */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted/20">
        <img 
          src={product.imageUrl} 
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Gradient overlay for better text readability if needed */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3">
        <div className="mb-1">
          <h3 className="text-sm font-bold text-white leading-tight line-clamp-2">{product.name}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{product.brand}</p>
        </div>
        
        <div className="mt-auto pt-2 flex items-center justify-between">
          <span className="text-sm font-bold text-primary">{formattedPrice}</span>
          
          <button
            onClick={() => addToCart.mutate(product.id)}
            disabled={isPending}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300",
              isPending 
                ? "bg-muted cursor-not-allowed" 
                : "bg-primary text-white shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-90"
            )}
          >
            {isPending ? (
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
