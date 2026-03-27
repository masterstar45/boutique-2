import { useListProducts } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { motion } from "framer-motion";
import { useSession } from "@/hooks/use-session";
import { TopBar } from "@/components/TopBar";

const GOLD = "rgba(201,160,76,";

function isAvailable(product: { stock?: string | null }) {
  if (!product.stock) return true;
  const s = product.stock.toLowerCase().trim();
  return s !== "0" && s !== "épuisé" && s !== "epuise" && s !== "rupture" && s !== "unavailable";
}

export default function Menu() {
  const { username } = useSession();
  const { data: allProductsRaw, isLoading, error } = useListProducts();
  const products = (allProductsRaw ?? []).filter(isAvailable);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-destructive p-4 text-center">
        Erreur lors du chargement des produits.
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <TopBar subtitle="Collection" />

      {/* Header greeting */}
      <div className="px-5 pt-5 pb-4">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
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

      {/* Grid */}
      <main className="px-4 pb-12 relative z-10">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3.5">
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
            <div className="text-4xl opacity-30">🌿</div>
            <div>
              <h3 className="font-display text-xl font-medium mb-1.5">Collection à venir</h3>
              <p className="text-sm" style={{ color: `${GOLD}0.5)` }}>Revenez bientôt pour de nouveaux arrivages.</p>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3">
            {products.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.045, 0.35), duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
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
