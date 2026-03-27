import { useState } from "react";
import { useLocation } from "wouter";
import { Trash2, ShoppingBag, ArrowRight, Minus, Plus, CreditCard, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/hooks/use-session";
import { useGetCart, useUpdateCartItem, useRemoveFromCart, useCheckout, getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const deliveryOptions = [
  { id: "livraison", label: "Livraison à domicile", desc: "Expédition 24/48h", emoji: "🛵" },
  { id: "relais", label: "Point Relais", desc: "Retrait en point relais", emoji: "📦" },
];

export default function Cart() {
  const [, navigate] = useLocation();
  const { sessionId, chatId } = useSession();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<'cart' | 'delivery' | 'address'>('cart');
  const [selectedDelivery, setSelectedDelivery] = useState<string>('');
  const [address, setAddress] = useState("");

  const { data: cartItems, isLoading } = useGetCart(sessionId, { query: { enabled: !!sessionId } });
  
  const updateItem = useUpdateCartItem({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCartQueryKey(sessionId) }) }
  });
  
  const removeItem = useRemoveFromCart({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCartQueryKey(sessionId) }) }
  });

  const checkoutMut = useCheckout({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey(sessionId) });
        navigate("/account");
      }
    }
  });

  const total = cartItems?.reduce((sum, item) => sum + ((item.selectedPrice || item.product.price) * item.quantity), 0) || 0;

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!cartItems?.length) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center pb-28">
        <div className="w-24 h-24 glass-panel rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_-5px_rgba(255,255,255,0.1)]">
          <ShoppingBag className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-3xl font-black font-display mb-2">Panier vide</h2>
        <p className="text-muted-foreground text-sm mb-8">Votre panier est tristement vide. Découvrez notre sélection premium !</p>
        <button onClick={() => navigate("/menu")} className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-bold shadow-[0_0_30px_-5px_rgba(34,197,94,0.4)] active:scale-95 transition-transform">
          Explorer le menu
        </button>
      </div>
    );
  }

  const handleCheckout = () => {
    checkoutMut.mutate({
      data: {
        sessionId,
        chatId: chatId || "guest",
        deliveryType: selectedDelivery,
        deliveryAddress: address
      }
    });
  };

  return (
    <div className="min-h-screen pb-32">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-2xl border-b border-white/5 pt-safe px-4 py-4 flex items-center gap-4">
        {step !== 'cart' && (
          <button onClick={() => setStep(step === 'address' ? 'delivery' : 'cart')} className="w-10 h-10 glass-panel rounded-full flex items-center justify-center active:scale-90 transition-transform">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-2xl font-black font-display">Mon Panier</h1>
      </header>

      <main className="p-4">
        <AnimatePresence mode="wait">
          {step === 'cart' && (
            <motion.div key="cart" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              {cartItems.map((item) => (
                <div key={item.id} className="glass-panel p-4 rounded-[1.5rem] flex gap-4 items-center relative overflow-hidden">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-black/50 shrink-0">
                    <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base truncate">{item.product.name}</h3>
                    <p className="text-xs font-bold text-primary mt-1">{item.selectedWeight} • {item.selectedPrice}€</p>
                    
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center bg-black/40 rounded-full p-1 border border-white/5">
                        <button onClick={() => updateItem.mutate({ id: item.id, data: { quantity: Math.max(1, item.quantity - 1), sessionId }})} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center active:scale-90">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                        <button onClick={() => updateItem.mutate({ id: item.id, data: { quantity: item.quantity + 1, sessionId }})} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center active:scale-90">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button onClick={() => removeItem.mutate({ id: item.id })} className="p-2 text-destructive/80 hover:text-destructive transition-colors ml-auto active:scale-90">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="glass-panel p-6 rounded-[1.5rem] mt-6">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Total</span>
                  <span className="text-3xl font-black font-display text-primary glow-text">{total}€</span>
                </div>
              </div>

              <button 
                onClick={() => setStep('delivery')}
                className="w-full mt-6 h-16 bg-primary text-primary-foreground rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-[0_0_30px_-5px_rgba(34,197,94,0.4)] active:scale-[0.98] transition-transform"
              >
                Passer à la livraison <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {step === 'delivery' && (
            <motion.div key="delivery" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 pl-2">Mode de livraison</h2>
              {deliveryOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedDelivery(opt.id)}
                  className={`w-full p-5 rounded-[1.5rem] border-2 text-left flex items-center gap-4 transition-all active:scale-[0.98] ${selectedDelivery === opt.id ? 'border-primary bg-primary/10 shadow-[0_0_20px_-5px_rgba(34,197,94,0.2)]' : 'border-white/5 glass-panel'}`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${selectedDelivery === opt.id ? 'bg-primary/20' : 'bg-white/5'}`}>{opt.emoji}</div>
                  <div>
                    <h3 className="font-bold text-lg">{opt.label}</h3>
                    <p className="text-sm text-muted-foreground">{opt.desc}</p>
                  </div>
                </button>
              ))}

              <button 
                disabled={!selectedDelivery}
                onClick={() => setStep('address')}
                className="w-full mt-8 h-16 bg-primary text-primary-foreground rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-[0_0_30px_-5px_rgba(34,197,94,0.4)] disabled:opacity-50 active:scale-[0.98] transition-transform"
              >
                Continuer <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {step === 'address' && (
            <motion.div key="address" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="glass-panel p-6 rounded-[1.5rem]">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Adresse de livraison</h2>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Entrez votre adresse complète..."
                  className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                />
              </div>

              <button 
                disabled={!address.trim() || checkoutMut.isPending}
                onClick={handleCheckout}
                className="w-full h-16 bg-primary text-primary-foreground rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-[0_0_30px_-5px_rgba(34,197,94,0.4)] disabled:opacity-50 active:scale-[0.98] transition-transform"
              >
                {checkoutMut.isPending ? "Traitement..." : (
                  <>Valider la commande <CreditCard className="w-5 h-5" /></>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
