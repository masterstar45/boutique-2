import { useState } from "react";
import { useListProducts } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { CategoryTabs } from "@/components/CategoryTabs";
import { Search, Package } from "lucide-react";
import { motion } from "framer-motion";
import { useSession } from "@/hooks/use-session";
import { TopBar } from "@/components/TopBar";

function isAvailable(product: { stock?: string | null }) {
  if (!product.stock) return true;
  const s = product.stock.toLowerCase().trim();
  return s !== "0" && s !== "épuisé" && s !== "epuise" && s !== "rupture" && s !== "unavailable";
}

export default function Menu() {
  const [search, setSearch] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const { username } = useSession();

  const { data: allProductsRaw, isLoading, error } = useListProducts();
  const allProducts = (allProductsRaw ?? []).filter(isAvailable);

  const categories = Array.from(new Set(allProducts.map(p => p.category)));

  const products = allProducts.filter(p => {
    const matchCat = !category || p.category === category;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-destructive p-4 text-center">
        Erreur lors du chargement des produits.
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <TopBar subtitle="Produits disponibles" />

      {/* Greeting */}
      <div className="px-4 pt-5 pb-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          {username ? (
            <h2 className="text-2xl font-black font-display">
              Bonjour{" "}
              <span className="gradient-plug">@{username}</span>{" "}
              <span>👋</span>
            </h2>
          ) : (
            <h2 className="text-2xl font-black font-display">
              🔌 <span className="gradient-plug">SOS LE PLUG</span>
            </h2>
          )}
          <p className="text-sm text-muted-foreground mt-0.5">
            {allProducts.length} produit{allProducts.length !== 1 ? "s" : ""} disponible{allProducts.length !== 1 ? "s" : ""}
          </p>
        </motion.div>
      </div>

      {/* Search */}
      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
          />
        </div>
      </div>

      <CategoryTabs
        categories={categories}
        selected={category}
        onSelect={setCategory}
      />

      {/* Grid */}
      <main className="p-4 relative z-10 pb-10">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[4/5] glass-panel rounded-[1.5rem] animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-16 text-center glass-panel border-white/5 rounded-[2rem] mt-6 p-8 flex flex-col items-center"
          >
            <Package className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-bold mb-2">Aucun produit trouvé</h3>
            <p className="text-sm text-muted-foreground">Essayez une autre recherche ou catégorie.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {products.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.4), duration: 0.4 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
