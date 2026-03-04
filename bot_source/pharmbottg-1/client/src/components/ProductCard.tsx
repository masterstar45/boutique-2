import { Product } from "@shared/schema";
import { useLocation } from "wouter";
import { ShoppingCart } from "lucide-react";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const [, navigate] = useLocation();

  const formattedPrice = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(product.price / 100);

  return (
    <div 
      onClick={() => navigate(`/product/${product.id}`)}
      className="group relative flex flex-col bg-card rounded-2xl overflow-hidden shadow-lg shadow-black/20 border border-primary/10 active:scale-[0.97] transition-all duration-200 cursor-pointer animate-fade-in"
      data-testid={`card-product-${product.id}`}
    >
        {product.sticker && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-primary/90 backdrop-blur-md px-2.5 py-1 rounded-full shadow-lg">
            {product.stickerFlag && <span className="text-xs">{product.stickerFlag}</span>}
            <span className="text-[10px] font-bold tracking-wider text-white uppercase">{product.sticker}</span>
          </div>
        )}

        <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-muted/30 to-muted/10">
          <img 
            src={product.imageUrl} 
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute bottom-2 right-2 w-8 h-8 bg-primary/90 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
            <ShoppingCart className="w-4 h-4 text-white" />
          </div>
        </div>

        <div className="flex flex-col flex-1 p-3 bg-gradient-to-b from-card to-card/80">
          <div className="mb-1">
            <h3 className="text-sm font-bold text-white leading-tight line-clamp-2">{product.name}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{product.brand}</p>
          </div>
          
          <div className="mt-auto pt-2 flex items-center justify-between">
            <span className="text-base font-bold text-primary">{formattedPrice}</span>
            {product.stock && (
              <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                Stock: {product.stock}
              </span>
            )}
          </div>
        </div>
    </div>
  );
}
