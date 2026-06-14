import { useState, useMemo } from "react";
import { useListProducts } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { CategoryTabs } from "@/components/CategoryTabs";
import { motion } from "framer-motion";
import { useSession } from "@/hooks/use-session";
import { TopBar } from "@/components/TopBar";
import { Search, X } from "lucide-react";

const GOLD = "rgba(201,160,76,";

function isAvailable(product: { stock?: string | null }) {
  if (!product.stock) return true;
  const s = product.stock.toLowerCase().trim();
  return s !== "0" && s !== "épuisé" && s !== "epuise" && s !== "rupture" && s !== "unavailable";
}

export default function Menu() {
  const { username } = useSession();
  const { data: allProductsRaw, isLoading, error } = useListProducts();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const available = useMemo(() => (allProductsRaw ?? []).filter(isAvailable), [allProductsRaw]);

  const categories = useMemo(() => {
    const cats = available.map(p => p.category).filter(Boolean) as string[];
    return [...new Set(cats)].sort();
  }, [available]);

  const products = useMemo(() => {
    let list = available;
    if (selectedCategory) list = list.filter(p => p.category === selectedCategory);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [available, selectedCategory, search]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-destructive p-4 text-center">
        Erreur lors du chargement des produits.
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <TopBar branded subtitle="Collection" />

      {/* Header greeting */}
      <div className="px-5 sm:px-8 pt-5 sm:pt-6 pb-3">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {username ? (
            <>
              <p className="text-[10px] tracking-[0.25em] uppercase mb-1" style={{ color: `${GOLD}0.55)` }}>
                Bienvenue
              </p>
              <h2 className="font-display text-2xl font-medium gradient-gold leading-tight">
                @{username}
              </h2>
            </>
          ) : (
            <>
              <p className="text-[10px] tracking-[0.25em] uppercase mb-1" style={{ color: `${GOLD}0.55)` }}>
                Notre Sélection
              </p>
              <h2 className="font-display text-2xl font-medium gradient-gold leading-tight">
                SOS LE PLUG
              </h2>
            </>
          )}

          <div className="flex items-center gap-2 mt-2">
            <div className="gold-line flex-1" />
            <p className="text-[10px] font-medium tracking-[0.15em] uppercase shrink-0" style={{ color: `${GOLD}0.5)` }}>
              {isLoading ? "Chargement…" : `${products.length} article${products.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Barre de recherche */}
      <div className="px-4 sm:px-8 pb-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: `${GOLD}0.45)` }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un produit…"
            className="w-full pl-10 pr-10 py-3 rounded-2xl text-sm focus:outline-none transition-all"
            style={{
              background: "rgba(201,160,76,0.04)",
              border: `1px solid ${search ? `${GOLD}0.3)` : `${GOLD}0.1)`}`,
              color: "rgba(242,234,218,0.9)",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-opacity"
              style={{ background: `${GOLD}0.1)` }}
            >
              <X className="w-3 h-3" style={{ color: `${GOLD}0.7)` }} />
            </button>
          )}
        </div>
      </div>

      {/* Filtres catégories */}
      {categories.length > 1 && (
        <div className="pb-2">
          <CategoryTabs
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </div>
      )}

      {/* Grid */}
      <main className="px-4 sm:px-8 pb-nav relative z-10">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[4/5] rounded-[1.5rem] animate-pulse"
                style={{ background: "rgba(201,160,76,0.04)", border: "1px solid rgba(201,160,76,0.06)" }} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-16 text-center flex flex-col items-center gap-4 rounded-[2rem] p-8"
            style={{ background: "rgba(201,160,76,0.03)", border: "1px solid rgba(201,160,76,0.08)" }}
          >
            <div className="text-4xl opacity-30">{search || selectedCategory ? "🔍" : "🌿"}</div>
            <div>
              <h3 className="font-display text-xl font-medium mb-1.5">
                {search || selectedCategory ? "Aucun résultat" : "Collection à venir"}
              </h3>
              <p className="text-sm" style={{ color: `${GOLD}0.5)` }}>
                {search || selectedCategory
                  ? "Essaie d'autres mots-clés ou une autre catégorie."
                  : "Revenez bientôt pour de nouveaux arrivages."}
              </p>
            </div>
            {(search || selectedCategory) && (
              <button
                onClick={() => { setSearch(""); setSelectedCategory(""); }}
                className="text-xs font-semibold px-4 py-2 rounded-full mt-1"
                style={{ background: `${GOLD}0.08)`, border: `1px solid ${GOLD}0.2)`, color: `${GOLD}0.8)` }}
              >
                Effacer les filtres
              </button>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {products.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.025, 0.12), duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
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
