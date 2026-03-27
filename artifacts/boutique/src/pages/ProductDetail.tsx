import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Minus, Plus, ShoppingBag, CheckCircle, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGetProduct, useAddToCart, useListProducts, getGetCartQueryKey } from "@workspace/api-client-react";
import { useSession } from "@/hooks/use-session";
import { useQueryClient } from "@tanstack/react-query";
import { ProductCard } from "@/components/ProductCard";

export default function ProductDetail() {
  const [, params] = useRoute("/product/:id");
  const [, navigate] = useLocation();
  const productId = Number(params?.id);
  const { sessionId } = useSession();
  const queryClient = useQueryClient();

  const [selectedOption, setSelectedOption] = useState<{ price: number; weight: string } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const { data: product, isLoading } = useGetProduct(productId, { query: { enabled: !!productId } });
  
  const { data: similarProducts } = useListProducts(
    { category: product?.category },
    { query: { enabled: !!product?.category } }
  );

  const addToCartMutation = useAddToCart({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey(sessionId) });
        setShowModal(false);
        setSelectedOption(null);
        setQuantity(1);
        // Show success toast manually or just let it close
      }
    }
  });

  const handleOptionClick = (option: { price: number; weight: string }) => {
    setSelectedOption(option);
    setQuantity(1);
    setShowModal(true);
  };

  const handleConfirm = () => {
    if (!product || !selectedOption || !sessionId) return;
    addToCartMutation.mutate({
      data: {
        productId: product.id,
        sessionId,
        quantity,
        selectedPrice: selectedOption.price,
        selectedWeight: selectedOption.weight,
      }
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-20">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <div className="text-primary font-bold tracking-widest uppercase text-sm">Chargement...</div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center pb-20 p-6">
        <div className="w-24 h-24 glass-panel rounded-full flex items-center justify-center mb-6">
          <ShoppingBag className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-black mb-2 font-display">Produit introuvable</h2>
        <p className="text-muted-foreground text-center mb-8 text-sm">Ce produit n'existe plus ou a été retiré de notre catalogue.</p>
        <button onClick={() => navigate("/menu")} className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-bold">Retour au menu</button>
      </div>
    );
  }

  const priceOptions = product.priceOptions || [];
  const similar = similarProducts?.filter(p => p.id !== product.id).slice(0, 4) || [];

  return (
    <div className="min-h-screen pb-28">
      {/* Back Button */}
      <button 
        onClick={() => navigate("/menu")}
        className="fixed top-safe left-4 z-50 w-12 h-12 glass-panel rounded-full flex items-center justify-center text-foreground hover:text-primary transition-colors active:scale-90"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Hero Image */}
      <div className="relative w-full aspect-[4/5] bg-black">
        <img 
          src={product.imageUrl || "https://images.unsplash.com/photo-1603584860006-25f0a0584b42?w=800&h=1000&fit=crop"} 
          alt={product.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        
        {product.sticker && (
          <div className="absolute top-safe right-4 mt-2 flex items-center gap-1.5 bg-background/80 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-white/10">
            {product.stickerFlag && <span className="text-xs">{product.stickerFlag}</span>}
            <span className="text-xs font-black tracking-widest text-primary uppercase">{product.sticker}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-5 -mt-20 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-[2rem] p-6 shadow-2xl mb-6"
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-xs font-bold text-primary tracking-widest uppercase mb-1">{product.brand}</p>
              <h1 className="text-3xl font-black font-display leading-tight">{product.name}</h1>
            </div>
            {product.stock && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 whitespace-nowrap">
                <Package className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-bold text-muted-foreground">{product.stock}</span>
              </div>
            )}
          </div>

          <div className="prose prose-invert max-w-none">
            <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
          </div>
        </motion.div>

        {/* Options */}
        {priceOptions.length > 0 && (
          <div className="mb-10">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 pl-2">Formats disponibles</h3>
            <div className="grid grid-cols-2 gap-3">
              {priceOptions.map((opt, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => handleOptionClick(opt)}
                  className="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-all group active:scale-95"
                >
                  <span className="text-lg font-black font-display group-hover:text-primary transition-colors">{opt.weight}</span>
                  <span className="text-sm font-medium text-muted-foreground">{opt.price}€</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Similar Products */}
        {similar.length > 0 && (
          <div className="mb-10">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 pl-2">Produits Similaires</h3>
            <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 -mx-5 px-5">
              {similar.map(p => (
                <div key={p.id} className="w-[160px] flex-shrink-0">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add to Cart Modal */}
      <AnimatePresence>
        {showModal && selectedOption && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-lg bg-card border-t border-white/10 rounded-t-[2.5rem] sm:rounded-[2.5rem] sm:border p-6 pb-safe"
            >
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto -mt-2 mb-8" />
              
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Ajouter au panier</h2>
                  <h3 className="text-2xl font-black font-display text-foreground">{product.name}</h3>
                </div>
                <div className="bg-primary/10 border border-primary/20 px-4 py-2 rounded-xl text-right">
                  <p className="text-primary font-black text-xl leading-none">{selectedOption.price}€</p>
                  <p className="text-[10px] text-primary/70 font-bold uppercase mt-1 tracking-wider">{selectedOption.weight}</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-4 py-6 mb-6 glass-panel rounded-3xl">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Quantité</p>
                <div className="flex items-center justify-center gap-6">
                  <button
                    className="w-12 h-12 rounded-full glass-panel flex items-center justify-center text-foreground disabled:opacity-50 hover:border-primary/50 transition-colors active:scale-90"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <span className="text-4xl font-black w-16 text-center text-foreground font-display">{quantity}</span>
                  <button
                    className="w-12 h-12 rounded-full glass-panel flex items-center justify-center text-foreground hover:border-primary/50 transition-colors active:scale-90"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <button
                className="w-full h-16 rounded-2xl bg-primary text-primary-foreground text-lg font-black shadow-[0_0_30px_-5px_rgba(34,197,94,0.4)] flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                onClick={handleConfirm}
                disabled={addToCartMutation.isPending}
              >
                {addToCartMutation.isPending ? (
                  "Ajout en cours..."
                ) : (
                  <>
                    <CheckCircle className="w-6 h-6" />
                    Confirmer - {selectedOption.price * quantity}€
                  </>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
