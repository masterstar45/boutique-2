import { useState, useEffect } from "react";
import { useCart, useRemoveFromCart, useClearCart, useUpdateCartQuantity } from "@/hooks/use-cart";
import { queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, ArrowRight, ArrowLeft, ShoppingBag, Truck, Users, Mail, Minus, Plus, Tag, X, Check, Loader2, Star, Gift, Clock, ShieldCheck, MapPin, ChevronRight, Package, Handshake, Zap } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
// @ts-ignore
import confetti from "canvas-confetti";

interface AppliedPromo {
  code: string;
  discountPercent: number;
}

interface LoyaltyBalance {
  points: number;
  tier: 'bronze' | 'silver' | 'gold';
  totalEarned: number;
}

interface LoyaltySettings {
  earnRate: number;
  redeemRate: number;
}

type CheckoutStep = 'cart' | 'delivery' | 'address' | 'confirm';

export default function Cart() {
  const [, navigate] = useLocation();
  const { data: items, isLoading } = useCart();
  const removeItem = useRemoveFromCart();
  const clearCart = useClearCart();
  const updateQty = useUpdateCartQuantity();
  const { toast } = useToast();

  const [step, setStep] = useState<CheckoutStep>('cart');
  const [selectedDelivery, setSelectedDelivery] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loyaltyBalance, setLoyaltyBalance] = useState<LoyaltyBalance | null>(null);
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings | null>(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [showRedeemInput, setShowRedeemInput] = useState(false);
  const [deliveryTime, setDeliveryTime] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [confirmedOrderCode, setConfirmedOrderCode] = useState("");
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');

  const deliveryTimeSlots = [
    "10:00", "11:00", "12:00", "13:00", "14:00", "15:00",
    "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"
  ];

  useEffect(() => {
    let chatId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString();
    if (!chatId) {
      try {
        const initData = window.Telegram?.WebApp?.initData;
        if (initData) {
          const params = new URLSearchParams(initData);
          const userJson = params.get('user');
          if (userJson) {
            const user = JSON.parse(userJson);
            chatId = user.id?.toString();
          }
        }
      } catch {}
    }
    fetch('/api/loyalty-settings').then(r => r.json()).then(setLoyaltySettings).catch(() => {});
    if (chatId) {
      fetch(`/api/loyalty/${chatId}`).then(r => r.json()).then(setLoyaltyBalance).catch(() => {});
    } else {
      setLoyaltyBalance({ points: 0, tier: 'bronze', totalEarned: 0 });
    }
  }, []);

  useEffect(() => {
    if (showSuccess) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [showSuccess]);

  const deliveryOptions = [
    { id: "postal", label: "Envoi Postal", icon: Package, description: "Livraison discrète sous 48h", emoji: "📦" },
    { id: "meetup", label: "Meet-up", icon: Handshake, description: "Remise en main propre", emoji: "🤝" },
    { id: "delivery", label: "Livraison", icon: Zap, description: "Livraison express en 2h", emoji: "🚀" },
  ];

  const goTo = (nextStep: CheckoutStep) => {
    const steps: CheckoutStep[] = ['cart', 'delivery', 'address', 'confirm'];
    const currentIdx = steps.indexOf(step);
    const nextIdx = steps.indexOf(nextStep);
    setSlideDirection(nextIdx > currentIdx ? 'left' : 'right');
    setStep(nextStep);
  };

  const validatePromoCode = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError(null);
    try {
      const response = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim() })
      });
      const data = await response.json();
      if (data.valid) {
        setAppliedPromo({ code: data.code, discountPercent: data.discountPercent });
        setPromoCode("");
        toast({ title: "Code appliqué", description: `Réduction de ${data.discountPercent}% active` });
      } else {
        setPromoError(data.message || "Code invalide");
      }
    } catch { setPromoError("Erreur de validation"); }
    finally { setPromoLoading(false); }
  };

  const submitOrder = async () => {
    if (!selectedDelivery || !address.trim() || !postalCode.trim() || !city.trim() || !deliveryTime) {
      toast({ title: "Information manquante", description: "Veuillez remplir tous les champs", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const sessionId = localStorage.getItem('cart_session_id');
      const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
      const chatId = tgUser?.id?.toString() || undefined;
      const username = tgUser?.username || undefined;
      const firstName = tgUser?.first_name || undefined;
      const telegramInitData = window.Telegram?.WebApp?.initData || undefined;
      console.log('[Checkout] Telegram user data:', { chatId, username, firstName, hasInitData: !!telegramInitData });
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId, deliveryType: selectedDelivery, deliveryTime,
          promoCode: appliedPromo?.code || null,
          address: address.trim(), postalCode: postalCode.trim(), city: city.trim(),
          notes: notes.trim() || undefined,
          pointsToRedeem: pointsToRedeem > 0 ? pointsToRedeem : undefined,
          chatId, username, firstName, telegramInitData
        })
      });
      if (!response.ok) throw new Error('Checkout failed');
      const data = await response.json();

      setAddress(""); setPostalCode(""); setCity(""); setDeliveryTime(""); setNotes("");
      setPointsToRedeem(0); setShowRedeemInput(false); setAppliedPromo(null);
      queryClient.invalidateQueries({ queryKey: ['/api/cart', sessionId] });
      setConfirmedOrderCode(data.orderCode);
      setShowSuccess(true);
    } catch {
      toast({ title: "Erreur", description: "Un problème est survenu. Veuillez réessayer.", variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  const subtotal = items?.reduce((sum, item) => {
    const price = item.selectedPrice ? item.selectedPrice : 0;
    return sum + price * item.quantity;
  }, 0) || 0;
  const promoDiscount = appliedPromo ? Math.round(subtotal * (appliedPromo.discountPercent / 100)) : 0;
  const loyaltyDiscount = loyaltySettings && pointsToRedeem > 0 ? Math.round(pointsToRedeem / loyaltySettings.redeemRate) : 0;
  const total = Math.max(0, subtotal - promoDiscount - loyaltyDiscount);
  const maxRedeemablePoints = loyaltyBalance?.points || 0;
  const earnablePoints = loyaltySettings ? Math.floor(total * (loyaltySettings.earnRate / 100)) : 0;
  const itemCount = items?.reduce((acc, item) => acc + item.quantity, 0) || 0;

  const formatPrice = (euros: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(euros);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const isEmpty = !items || items.length === 0;

  if (showSuccess) {
    return (
      <div className="min-h-screen relative flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="relative z-10 flex flex-col items-center text-center"
        >
          <div className="w-28 h-28 bg-primary/20 rounded-full flex items-center justify-center mb-8 relative">
            <motion.div
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 bg-primary/10 rounded-full"
            />
            <Check className="w-14 h-14 text-primary relative z-10" />
          </div>

          <h1 className="text-4xl font-black mb-3">Commande envoyée !</h1>
          <p className="text-muted-foreground mb-8 max-w-xs">
            Votre commande a été transmise. Un membre de notre équipe vous contactera bientôt.
          </p>

          <div className="glass-panel rounded-2xl p-6 mb-8 w-full max-w-xs">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Votre code de commande</p>
            <p className="text-3xl font-mono font-black text-primary tracking-wider" data-testid="text-order-code">{confirmedOrderCode}</p>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={() => navigate("/menu")}
              className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm"
              data-testid="button-back-to-menu"
            >
              Retour au menu
            </button>
            {window.Telegram?.WebApp?.close && (
              <button
                onClick={() => window.Telegram?.WebApp?.close()}
                className="w-full py-3 rounded-2xl border border-white/10 text-muted-foreground font-medium text-sm"
                data-testid="button-close-app"
              >
                Fermer
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  const slideVariants = {
    enter: (dir: string) => ({ x: dir === 'left' ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: string) => ({ x: dir === 'left' ? -300 : 300, opacity: 0 }),
  };

  const stepIndex = ['cart', 'delivery', 'address', 'confirm'].indexOf(step);

  return (
    <div className="min-h-screen relative">

      {step !== 'cart' && (
        <header className="sticky top-0 z-40 bg-background/60 backdrop-blur-2xl border-b border-white/5 pt-safe">
          <div className="px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => {
                const steps: CheckoutStep[] = ['cart', 'delivery', 'address', 'confirm'];
                goTo(steps[stepIndex - 1]);
              }}
              className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-foreground hover:bg-white/10 transition-colors"
              data-testid="button-checkout-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold">
                {step === 'delivery' ? 'Mode de livraison' : step === 'address' ? 'Adresse' : 'Confirmation'}
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                Étape {stepIndex} sur 3
              </p>
            </div>
          </div>
          <div className="px-4 pb-3 flex gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full transition-all duration-500",
                  s <= stepIndex ? "bg-primary" : "bg-white/10"
                )}
              />
            ))}
          </div>
        </header>
      )}

      {step === 'cart' && (
        <header className="sticky top-0 z-40 bg-background/60 backdrop-blur-2xl border-b border-white/5 pt-safe px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Panier</h1>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
              {itemCount} {itemCount > 1 ? 'articles' : 'article'}
            </p>
          </div>
          {!isEmpty && (
            <button
              onClick={() => clearCart.mutate()}
              className="text-xs text-destructive/80 font-bold uppercase tracking-wider hover:text-destructive transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10"
              data-testid="button-clear-cart"
            >
              <Trash2 className="w-3.5 h-3.5" /> Vider
            </button>
          )}
        </header>
      )}

      <AnimatePresence mode="wait" custom={slideDirection}>
        {step === 'cart' && (
          <motion.div
            key="cart"
            custom={slideDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="pb-32"
          >
            {isEmpty ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center z-10 relative">
                <div className="w-24 h-24 glass-panel rounded-full flex items-center justify-center mb-6 relative">
                  <ShoppingBag className="w-10 h-10 text-muted-foreground opacity-50" />
                  <div className="absolute top-0 right-0 w-3 h-3 bg-primary rounded-full animate-pulse" />
                </div>
                <h2 className="text-2xl font-bold mb-3">Votre panier est vide</h2>
                <p className="text-muted-foreground mb-8 text-sm max-w-xs">Explorez notre menu premium et ajoutez vos produits préférés.</p>
                <Link href="/menu" className="bg-primary text-primary-foreground px-8 py-4 rounded-2xl font-bold shadow-[0_0_30px_-5px_rgba(34,197,94,0.4)] hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-2">
                  Découvrir le menu <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="p-4 space-y-4 relative z-10">
                {items.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex gap-3 glass-panel p-3 rounded-[1.5rem]"
                  >
                    <div className="w-20 h-20 bg-black/40 rounded-xl overflow-hidden shrink-0 border border-white/5">
                      <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-bold text-sm leading-tight text-foreground truncate">{item.product.name}</h3>
                          <button
                            onClick={() => removeItem.mutate(item.id)}
                            disabled={removeItem.isPending}
                            className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors shrink-0"
                            data-testid={`button-remove-item-${item.id}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[10px] text-primary uppercase font-bold tracking-widest mt-0.5">{item.product.brand}</p>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div>
                          <p className="text-sm font-black">
                            {item.selectedPrice ? `${item.selectedPrice * item.quantity}€` : "0€"}
                            {item.selectedWeight && <span className="text-[10px] text-muted-foreground font-medium ml-1">{item.selectedWeight}</span>}
                          </p>
                        </div>
                        <div className="flex items-center bg-black/50 rounded-full border border-white/10 overflow-hidden">
                          <button
                            className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-white/10 transition-colors active:scale-90"
                            onClick={() => updateQty.mutate({ id: item.id, quantity: item.quantity - 1 })}
                            data-testid={`button-qty-minus-${item.id}`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                          <button
                            className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-white/10 transition-colors active:scale-90"
                            onClick={() => updateQty.mutate({ id: item.id, quantity: item.quantity + 1 })}
                            data-testid={`button-qty-plus-${item.id}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}

                <div className="glass-panel rounded-[1.5rem] p-4 space-y-4">
                  {!appliedPromo ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            type="text"
                            value={promoCode}
                            onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(null); }}
                            placeholder="Code promotionnel"
                            className="w-full pl-9 pr-3 py-3 bg-black/40 border border-white/5 rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                            data-testid="input-promo-code"
                          />
                        </div>
                        <button
                          onClick={validatePromoCode}
                          disabled={promoLoading || !promoCode.trim()}
                          className="px-4 py-3 bg-white/5 text-foreground border border-white/10 hover:bg-white/10 rounded-xl text-sm font-bold disabled:opacity-50 transition-colors"
                          data-testid="button-apply-promo"
                        >
                          {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "OK"}
                        </button>
                      </div>
                      {promoError && <p className="text-[10px] text-destructive uppercase tracking-widest font-bold ml-1">{promoError}</p>}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-primary/10 rounded-xl border border-primary/20">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-primary" />
                        <span className="text-sm font-bold">{appliedPromo.code}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-primary">-{appliedPromo.discountPercent}%</span>
                        <button onClick={() => { setAppliedPromo(null); setPromoError(null); }} className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center"><X className="w-3 h-3" /></button>
                      </div>
                    </div>
                  )}

                  {loyaltyBalance && loyaltyBalance.points > 0 && loyaltySettings && (
                    !showRedeemInput ? (
                      <button
                        onClick={() => setShowRedeemInput(true)}
                        className="w-full p-3 bg-amber-500/10 text-amber-500 rounded-xl text-sm font-bold border border-amber-500/20 flex items-center justify-center gap-2 hover:bg-amber-500/20 transition-colors"
                      >
                        <Gift className="w-4 h-4" />
                        Utiliser mes {loyaltyBalance.points} points
                      </button>
                    ) : (
                      <div className="space-y-2 p-3 bg-black/40 border border-white/5 rounded-xl">
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={pointsToRedeem || ''}
                            onChange={(e) => setPointsToRedeem(Math.min(parseInt(e.target.value) || 0, maxRedeemablePoints))}
                            max={maxRedeemablePoints}
                            placeholder={`Max: ${maxRedeemablePoints}`}
                            className="flex-1 px-3 py-2.5 bg-background border border-white/5 rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
                          />
                          <button onClick={() => { setShowRedeemInput(false); setPointsToRedeem(0); }} className="px-3 py-2.5 bg-white/5 rounded-lg font-medium border border-white/5 text-sm">Annuler</button>
                        </div>
                        {pointsToRedeem > 0 && (
                          <p className="text-xs font-bold text-amber-500 text-center">Reduction de {formatPrice(loyaltyDiscount)}</p>
                        )}
                      </div>
                    )
                  )}

                  <div className="space-y-2 pt-3 border-t border-white/5">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Sous-total ({itemCount} articles)</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    {appliedPromo && (
                      <div className="flex justify-between text-sm text-primary font-medium">
                        <span>Promo ({appliedPromo.code})</span>
                        <span>-{formatPrice(promoDiscount)}</span>
                      </div>
                    )}
                    {pointsToRedeem > 0 && (
                      <div className="flex justify-between text-sm text-amber-500 font-medium">
                        <span>Points</span>
                        <span>-{formatPrice(loyaltyDiscount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-end pt-2 border-t border-white/5">
                      <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Total</span>
                      <span className="text-2xl font-black" data-testid="text-cart-total">{formatPrice(total)}</span>
                    </div>
                    {earnablePoints > 0 && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Star className="w-3 h-3 text-amber-500" />
                        <p className="text-[10px] font-medium text-amber-500">+{earnablePoints} points avec cet achat</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {step === 'delivery' && (
          <motion.div
            key="delivery"
            custom={slideDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="p-4 pb-32 relative z-10"
          >
            <div className="space-y-3">
              {deliveryOptions.map((option, i) => {
                const Icon = option.icon;
                const isSelected = selectedDelivery === option.id;
                return (
                  <motion.button
                    key={option.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => setSelectedDelivery(option.id)}
                    className={cn(
                      "w-full p-5 rounded-2xl border-2 transition-all flex items-center gap-4 text-left group",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-[0_0_25px_-5px_rgba(34,197,94,0.3)]"
                        : "border-white/5 glass-panel hover:border-white/20"
                    )}
                    data-testid={`button-delivery-${option.id}`}
                  >
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors text-2xl",
                      isSelected ? "bg-primary/20" : "bg-white/5"
                    )}>
                      {option.emoji}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-base">{option.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                    </div>
                    <div className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                      isSelected ? "border-primary" : "border-white/10"
                    )}>
                      {isSelected && <div className="w-3 h-3 bg-primary rounded-full" />}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {step === 'address' && (
          <motion.div
            key="address"
            custom={slideDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="p-4 pb-32 relative z-10 space-y-4"
          >
            <div className="glass-panel rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-bold">Adresse de livraison</h3>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Adresse *</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 rue de la Paix"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                  data-testid="input-address"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Code postal *</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="75001"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                    data-testid="input-postal-code"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Ville *</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Paris"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                    data-testid="input-city"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Instructions (optionnel)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Code porte, etage, etc."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                  data-testid="input-notes"
                />
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="font-bold">Creneau horaire</h3>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {deliveryTimeSlots.map(time => (
                  <button
                    key={time}
                    onClick={() => setDeliveryTime(time)}
                    className={cn(
                      "py-2.5 rounded-xl text-sm font-bold transition-all",
                      deliveryTime === time
                        ? "bg-primary text-primary-foreground shadow-[0_0_15px_-3px_rgba(34,197,94,0.4)]"
                        : "bg-black/40 text-muted-foreground hover:text-foreground border border-white/5 hover:border-white/15"
                    )}
                    data-testid={`button-time-${time}`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {step === 'confirm' && (
          <motion.div
            key="confirm"
            custom={slideDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="p-4 pb-32 relative z-10 space-y-4"
          >
            <div className="glass-panel rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Articles</h3>
              </div>

              {items?.map(item => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-black/40 overflow-hidden shrink-0 border border-white/5">
                      <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{item.product.name}</p>
                      <p className="text-[10px] text-muted-foreground">x{item.quantity}</p>
                    </div>
                  </div>
                  <span className="text-sm font-black shrink-0 ml-2">
                    {item.selectedPrice ? `${item.selectedPrice * item.quantity}€` : "0€"}
                  </span>
                </div>
              ))}
            </div>

            <div className="glass-panel rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Truck className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Livraison</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg">{deliveryOptions.find(d => d.id === selectedDelivery)?.emoji}</span>
                <div>
                  <p className="font-bold text-sm">{deliveryOptions.find(d => d.id === selectedDelivery)?.label}</p>
                  <p className="text-xs text-muted-foreground">{address}, {postalCode} {city}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1 border-t border-white/5">
                <Clock className="w-4 h-4 text-primary" />
                <span>Creneau : <strong className="text-foreground">{deliveryTime}</strong></span>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Tag className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Paiement</h3>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Sous-total</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {appliedPromo && (
                <div className="flex justify-between text-sm text-primary font-medium">
                  <span>Promo ({appliedPromo.code})</span>
                  <span>-{formatPrice(promoDiscount)}</span>
                </div>
              )}
              {pointsToRedeem > 0 && (
                <div className="flex justify-between text-sm text-amber-500 font-medium">
                  <span>Points fidelite</span>
                  <span>-{formatPrice(loyaltyDiscount)}</span>
                </div>
              )}
              <div className="h-px bg-white/5" />
              <div className="flex justify-between items-end">
                <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Total</span>
                <span className="text-3xl font-black text-primary">{formatPrice(total)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {step === 'cart' && !isEmpty && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/80 backdrop-blur-2xl border-t border-white/5 pb-safe">
          <button
            onClick={() => goTo('delivery')}
            className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-bold text-lg shadow-[0_0_30px_-5px_rgba(34,197,94,0.4)] hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
            data-testid="button-proceed-checkout"
          >
            <span>Commander</span>
            <span className="text-primary-foreground/70">·</span>
            <span>{formatPrice(total)}</span>
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      )}

      {step === 'delivery' && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/80 backdrop-blur-2xl border-t border-white/5 pb-safe">
          <button
            onClick={() => goTo('address')}
            disabled={!selectedDelivery}
            className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-bold text-lg shadow-[0_0_30px_-5px_rgba(34,197,94,0.4)] disabled:opacity-40 disabled:shadow-none hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            data-testid="button-next-address"
          >
            Continuer
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {step === 'address' && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/80 backdrop-blur-2xl border-t border-white/5 pb-safe">
          <button
            onClick={() => goTo('confirm')}
            disabled={!address.trim() || !postalCode.trim() || !city.trim() || !deliveryTime}
            className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-bold text-lg shadow-[0_0_30px_-5px_rgba(34,197,94,0.4)] disabled:opacity-40 disabled:shadow-none hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            data-testid="button-next-confirm"
          >
            Verifier la commande
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {step === 'confirm' && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/80 backdrop-blur-2xl border-t border-white/5 pb-safe">
          <button
            onClick={submitOrder}
            disabled={isSubmitting}
            className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-bold text-lg shadow-[0_0_30px_-5px_rgba(34,197,94,0.4)] disabled:opacity-50 hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            data-testid="button-confirm-checkout"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Traitement...
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                Confirmer · {formatPrice(total)}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
