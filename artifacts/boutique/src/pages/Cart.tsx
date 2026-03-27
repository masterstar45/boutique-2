import { useState } from "react";
import { useLocation } from "wouter";
import { Trash2, ShoppingBag, ArrowRight, Minus, Plus, ChevronLeft, Send, MapPin, Phone, Clock, ExternalLink } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/hooks/use-session";
import { useGetCart, useUpdateCartItem, useRemoveFromCart, useCheckout, getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const DELIVERY_MODES = [
  { id: "livraison", label: "Livraison à domicile", emoji: "🛵" },
  { id: "relais", label: "Point Relais", emoji: "📦" },
];

const TIME_SLOTS = [
  { id: "matin", label: "Matin", hours: "9h – 12h", emoji: "🌅" },
  { id: "aprem", label: "Après-midi", hours: "14h – 18h", emoji: "☀️" },
  { id: "soir", label: "Soirée", hours: "18h – 21h", emoji: "🌆" },
];

export default function Cart() {
  const [, navigate] = useLocation();
  const { sessionId, chatId } = useSession();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"cart" | "delivery" | "details">("cart");
  const [deliveryMode, setDeliveryMode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [timeSlot, setTimeSlot] = useState("");

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
      }
    }
  });

  const total = cartItems?.reduce((sum, item) => sum + ((item.selectedPrice || item.product.price) * item.quantity), 0) || 0;

  const buildTelegramMessage = () => {
    const lines: string[] = [];
    lines.push("🔌 Nouvelle commande SOS LE PLUG");
    lines.push("");
    lines.push("📦 Articles :");
    cartItems?.forEach(item => {
      const price = item.selectedPrice || item.product.price;
      lines.push(`• ${item.product.name}${item.selectedWeight ? ` (${item.selectedWeight})` : ""} × ${item.quantity} = ${price * item.quantity}€`);
    });
    lines.push("");
    lines.push(`💰 Total : ${total}€`);
    lines.push("");
    lines.push(`🚚 Mode : ${deliveryMode === "livraison" ? "Livraison à domicile" : "Point Relais"}`);
    if (deliveryMode === "livraison" && address.trim()) {
      lines.push(`📍 Adresse : ${address.trim()}`);
    }
    lines.push(`📞 Téléphone : ${phone.trim()}`);
    const slot = TIME_SLOTS.find(s => s.id === timeSlot);
    if (slot) lines.push(`⏰ Créneau : ${slot.emoji} ${slot.label} (${slot.hours})`);
    if (chatId) lines.push(`\n👤 ID Telegram : ${chatId}`);
    return lines.join("\n");
  };

  const handleSendOrder = () => {
    checkoutMut.mutate({
      data: {
        sessionId,
        chatId: chatId || "guest",
        deliveryType: deliveryMode,
        deliveryAddress: deliveryMode === "livraison" ? address : `Relais - ${phone}`
      }
    });
    const message = buildTelegramMessage();
    const url = `https://t.me/SOSLePlug75?text=${encodeURIComponent(message)}`;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(url);
    } else {
      window.open(url, "_blank");
    }
    navigate("/account");
  };

  const detailsValid =
    (deliveryMode === "livraison" ? address.trim() !== "" : true) &&
    phone.trim() !== "" &&
    timeSlot !== "";

  const stepTitle: Record<string, string> = {
    cart: "Mon Panier",
    delivery: "Livraison",
    details: "Vos infos",
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!cartItems?.length && step === "cart") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 glass-panel rounded-full flex items-center justify-center mb-6">
          <ShoppingBag className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-3xl font-black font-display mb-2">Panier vide</h2>
        <p className="text-muted-foreground text-sm mb-8">Votre panier est vide. Découvrez notre sélection premium !</p>
        <button onClick={() => navigate("/menu")} className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-bold active:scale-95 transition-transform">
          Explorer le menu
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopBar title={stepTitle[step]} backHref={step === "cart" ? "/menu" : undefined} />
      {step !== "cart" && (
        <div className="px-4 pt-2">
          <button
            onClick={() => setStep(step === "details" ? "delivery" : "cart")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Retour
          </button>
        </div>
      )}

      <main className="p-4">
        <AnimatePresence mode="wait">

          {/* ── STEP 1 : panier ── */}
          {step === "cart" && (
            <motion.div key="cart" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              {cartItems?.map(item => (
                <div key={item.id} className="glass-panel p-4 rounded-[1.5rem] flex gap-4 items-center">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-black/50 shrink-0">
                    <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base truncate">{item.product.name}</h3>
                    <p className="text-xs font-bold text-primary mt-1">{item.selectedWeight} • {item.selectedPrice}€</p>
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center bg-black/40 rounded-full p-1 border border-white/5">
                        <button onClick={() => updateItem.mutate({ id: item.id, data: { quantity: Math.max(1, item.quantity - 1), sessionId } })} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center active:scale-90">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                        <button onClick={() => updateItem.mutate({ id: item.id, data: { quantity: item.quantity + 1, sessionId } })} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center active:scale-90">
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
                onClick={() => setStep("delivery")}
                className="w-full mt-6 h-16 bg-primary text-primary-foreground rounded-2xl font-black text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                Passer à la livraison <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {/* ── STEP 2 : mode de livraison ── */}
          {step === "delivery" && (
            <motion.div key="delivery" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 pl-2">Mode de livraison</h2>
              {DELIVERY_MODES.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setDeliveryMode(opt.id)}
                  className={`w-full p-5 rounded-[1.5rem] border-2 text-left flex items-center gap-4 transition-all active:scale-[0.98] ${deliveryMode === opt.id ? "border-primary bg-primary/10 shadow-[0_0_20px_-5px_rgba(147,51,234,0.2)]" : "border-white/5 glass-panel"}`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${deliveryMode === opt.id ? "bg-primary/20" : "bg-white/5"}`}>{opt.emoji}</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{opt.label}</h3>
                    {opt.id === "relais" && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> Redirige vers notre Telegram
                      </p>
                    )}
                  </div>
                </button>
              ))}

              <button
                disabled={!deliveryMode}
                onClick={() => {
                  if (deliveryMode === "relais") {
                    const tg = (window as any).Telegram?.WebApp;
                    const url = "https://t.me/SOSLePlug75";
                    if (tg?.openLink) {
                      tg.openLink(url);
                    } else {
                      window.open(url, "_blank");
                    }
                  } else {
                    setStep("details");
                  }
                }}
                className="w-full mt-8 h-16 bg-primary text-primary-foreground rounded-2xl font-black text-lg flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
              >
                {deliveryMode === "relais" ? (
                  <><ExternalLink className="w-5 h-5" /> Contacter sur Telegram</>
                ) : (
                  <>Continuer <ArrowRight className="w-5 h-5" /></>
                )}
              </button>

              {deliveryMode === "relais" && (
                <p className="text-center text-xs text-muted-foreground pb-2">
                  Vous serez redirigé vers <span className="text-primary font-bold">@SOSLePlug75</span> pour choisir votre point relais 📦
                </p>
              )}
            </motion.div>
          )}

          {/* ── STEP 3 : infos client ── */}
          {step === "details" && (
            <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">

              {/* Adresse – seulement pour livraison à domicile */}
              {deliveryMode === "livraison" && (
                <div className="glass-panel p-5 rounded-[1.5rem]">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-primary" />
                    <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Adresse de livraison</label>
                  </div>
                  <textarea
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Numéro, rue, code postal, ville..."
                    rows={3}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-primary transition-all resize-none"
                  />
                </div>
              )}

              {/* Téléphone */}
              <div className="glass-panel p-5 rounded-[1.5rem]">
                <div className="flex items-center gap-2 mb-3">
                  <Phone className="w-4 h-4 text-primary" />
                  <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Numéro de téléphone</label>
                </div>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="06 12 34 56 78"
                  type="tel"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all"
                />
              </div>

              {/* Créneau horaire */}
              <div className="glass-panel p-5 rounded-[1.5rem]">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-primary" />
                  <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Créneau de livraison</label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {TIME_SLOTS.map(slot => (
                    <button
                      key={slot.id}
                      onClick={() => setTimeSlot(slot.id)}
                      className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all active:scale-95 ${timeSlot === slot.id ? "border-primary bg-primary/15" : "border-white/10 bg-black/30"}`}
                    >
                      <span className="text-xl">{slot.emoji}</span>
                      <span className="text-[11px] font-bold">{slot.label}</span>
                      <span className="text-[9px] text-muted-foreground">{slot.hours}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Récap commande */}
              <div className="glass-panel p-4 rounded-[1.5rem] text-xs text-muted-foreground">
                <p className="font-bold text-white/70 mb-2 uppercase tracking-wider text-[10px]">Récapitulatif</p>
                {cartItems?.map(item => (
                  <div key={item.id} className="flex justify-between py-1 border-b border-white/5 last:border-0">
                    <span>{item.product.name} {item.selectedWeight && `(${item.selectedWeight})`} ×{item.quantity}</span>
                    <span className="text-primary font-bold">{(item.selectedPrice || item.product.price) * item.quantity}€</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 font-black text-white">
                  <span>Total</span><span className="text-primary">{total}€</span>
                </div>
              </div>

              <button
                disabled={!detailsValid || checkoutMut.isPending}
                onClick={handleSendOrder}
                className="w-full h-16 rounded-2xl font-black text-lg flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform text-white"
                style={{ background: "linear-gradient(135deg, hsl(270,90%,55%), hsl(200,90%,55%))" }}
              >
                {checkoutMut.isPending ? "Envoi…" : (
                  <><Send className="w-5 h-5" /> Envoyer la commande</>
                )}
              </button>
              <p className="text-center text-xs text-muted-foreground pb-4">
                Vous serez redirigé vers Telegram pour finaliser avec l'équipe 🔌
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
