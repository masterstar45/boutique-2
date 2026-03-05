import { useState } from "react";
import { useProducts } from "@/hooks/use-products";
import { ProductCard } from "@/components/ProductCard";
import { Search, SlidersHorizontal } from "lucide-react";
import { motion } from "framer-motion";

export default function Menu() {
  const [search, setSearch] = useState<string>("");
  const { data: products, isLoading, error } = useProducts("", search);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-destructive p-4 text-center bg-background">
        Error loading products. Please try again.
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 bg-background relative">
      <div className="animated-bg" />
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/60 backdrop-blur-2xl border-b border-white/5 pt-safe">
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Menu</h1>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Premium Selection</p>
          </div>
          <div className="w-10 h-10 rounded-full glass-panel flex items-center justify-center overflow-hidden border border-primary/20 shadow-[0_0_15px_-5px_rgba(34,197,94,0.3)]">
            <span className="text-primary font-bold text-sm tracking-tighter">PH</span>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="px-4 pb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Rechercher une variété..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-inner"
              data-testid="input-search"
            />
          </div>
          <button className="w-[46px] flex-shrink-0 glass-panel rounded-2xl flex items-center justify-center text-foreground hover:text-primary transition-colors border border-white/10">
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>
        
      </header>

      {/* Grid */}
      <main className="p-4 relative z-10">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[4/5] glass-panel rounded-[1.5rem] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products?.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </div>
        )}

        {!isLoading && products?.length === 0 && (
          <div className="py-16 text-center glass-panel rounded-3xl mt-6 p-8">
            <h3 className="text-lg font-bold mb-2">Aucun produit trouvé</h3>
            <p className="text-sm text-muted-foreground">Essayez une autre recherche ou catégorie.</p>
          </div>
        )}
      </main>
    </div>
  );
}