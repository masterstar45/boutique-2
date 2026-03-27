import { useListProducts } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { Package } from "lucide-react";
import { motion } from "framer-motion";
import { useSession } from "@/hooks/use-session";
import { TopBar } from "@/components/TopBar";

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
      <TopBar subtitle="Produits disponibles" />

      {/* Greeting */}
      <div className="px-4 pt-5 pb-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          {username ? (
            <h2 className="text-2xl font-black font-display">
              Bonjour <span className="gradient-plug">@{username}</span> 👋
            </h2>
          ) : (
            <h2 className="text-2xl font-black font-display">
              🔌 <span className="gradient-plug">SOS LE PLUG</span>
            </h2>
          )}
          <p className="text-sm text-muted-foreground mt-0.5">
            {products.length} produit{products.length !== 1 ? "s" : ""} disponible{products.length !== 1 ? "s" : ""}
          </p>
        </motion.div>
      </div>

      {/* Grid */}
      <main className="px-4 pb-10 relative z-10">
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
            className="py-16 text-center glass-panel border-white/5 rounded-[2rem] p-8 flex flex-col items-center"
          >
            <Package className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-bold mb-2">Aucun produit disponible</h3>
            <p className="text-sm text-muted-foreground">Revenez bientôt pour de nouveaux arrivages.</p>
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
