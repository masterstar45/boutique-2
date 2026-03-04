import { useState, useEffect } from "react";
import { useCart, useRemoveFromCart, useClearCart } from "@/hooks/use-cart";
import { queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, ArrowRight, ShoppingBag, Truck, Users, Mail, Minus, Plus, Tag, X, Check, Loader2, Star, Gift, Clock, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import logoImage from "@assets/pharmacy-hash-logo.png";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

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

export default function Cart() {
  const { data: items, isLoading } = useCart();
  const removeItem = useRemoveFromCart();
  const clearCart = useClearCart();
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<string | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'delivery' | 'address'>('delivery');
  const { toast } = useToast();
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loyaltyBalance, setLoyaltyBalance] = useState<LoyaltyBalance | null>(null);
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings | null>(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [showRedeemInput, setShowRedeemInput] = useState(false);
  const [deliveryTime, setDeliveryTime] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [confirmedOrderCode, setConfirmedOrderCode] = useState("");

  const deliveryTimeSlots = [
    "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", 
    "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"
  ];

  useEffect(() => {
    const chatId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString();
    
    // Always fetch settings
    fetch('/api/loyalty-settings')
      .then(res => res.json())
      .then(data => setLoyaltySettings(data))
      .catch(() => {});

    if (chatId) {
      fetch(`/api/loyalty/${chatId}`)
        .then(res => res.json())
        .then(data => setLoyaltyBalance(data))
        .catch(() => {});
    } else {
      // Demo mode - show 0 points
      setLoyaltyBalance({ points: 0, tier: 'bronze', totalEarned: 0 });
    }
  }, []);

  const deliveryOptions = [
    { id: "postal", label: "Envoi Postal", icon: Mail, description: "Livraison discrète 48h" },
    { id: "meetup", label: "Meet-up", icon: Users, description: "Remise en main propre" },
    { id: "delivery", label: "Livraison", icon: Truck, description: "Livraison express 2h" },
  ];

  const handleOrderClick = () => {
    setCheckoutStep('delivery');
    setSelectedDelivery(null);
    setShowDeliveryModal(true);
  };

  const handleDeliveryChoice = (deliveryId: string) => {
    setSelectedDelivery(deliveryId);
    setCheckoutStep('address');
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
        toast({
          title: "Code appliqué",
          description: `Réduction de ${data.discountPercent}% active`,
        });
      } else {
        setPromoError(data.message || "Code invalide");
      }
    } catch (err) {
      setPromoError("Erreur de validation");
    } finally {
      setPromoLoading(false);
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoError(null);
  };

  const submitOrder = async () => {
    if (!selectedDelivery || !address.trim() || !postalCode.trim() || !city.trim() || !deliveryTime) {
      toast({
        title: "Information manquante",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const sessionId = localStorage.getItem('cart_session_id');
      const chatId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString();
      
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId, 
          deliveryType: selectedDelivery,
          deliveryTime: deliveryTime,
          promoCode: appliedPromo?.code || null,
          address: address.trim(),
          postalCode: postalCode.trim(),
          city: city.trim(),
          pointsToRedeem: pointsToRedeem > 0 ? pointsToRedeem : undefined,
          chatId: chatId || undefined
        })
      });
      
      if (!response.ok) {
        throw new Error('Checkout failed');
      }
      
      const data = await response.json();
      
      setShowDeliveryModal(false);
      setAddress("");
      setPostalCode("");
      setCity("");
      setDeliveryTime("");
      setPointsToRedeem(0);
      setShowRedeemInput(false);
      setAppliedPromo(null);
      
      queryClient.invalidateQueries({ queryKey: ['/api/cart', sessionId] });
      
      setConfirmedOrderCode(data.orderCode);
      setShowSuccessModal(true);
      
      setTimeout(() => {
        if (window.Telegram?.WebApp?.close) {
          window.Telegram?.WebApp?.close();
        }
      }, 4000);
      
    } catch (err) {
      console.error('Checkout error:', err);
      toast({
        title: "Erreur",
        description: "Un problème est survenu. Veuillez réessayer.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const subtotal = items?.reduce((sum, item) => {
    const price = item.selectedPrice ? item.selectedPrice * 100 : item.product.price;
    return sum + price * item.quantity;
  }, 0) || 0;
  
  const promoDiscount = appliedPromo ? Math.round(subtotal * (appliedPromo.discountPercent / 100)) : 0;
  const loyaltyDiscount = loyaltySettings && pointsToRedeem > 0 
    ? Math.round((pointsToRedeem / loyaltySettings.redeemRate) * 100) 
    : 0;
  const totalDiscount = promoDiscount + loyaltyDiscount;
  const total = Math.max(0, subtotal - totalDiscount);
  
  const maxRedeemablePoints = loyaltyBalance?.points || 0;
  const earnablePoints = loyaltySettings 
    ? Math.floor((total / 100) * (loyaltySettings.earnRate / 100))
    : 0;

  const tierEmoji = loyaltyBalance?.tier === 'gold' ? '🥇' : loyaltyBalance?.tier === 'silver' ? '🥈' : '🥉';
  const tierLabel = loyaltyBalance?.tier === 'gold' ? 'Or' : loyaltyBalance?.tier === 'silver' ? 'Argent' : 'Bronze';

  const formatPrice = (cents: number) => 
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const isEmpty = !items || items.length === 0;

  return (
    <div className="min-h-screen pb-32 bg-background relative">
      <div className="animated-bg" />
      
      <header className="sticky top-0 z-40 bg-background/60 backdrop-blur-2xl border-b border-white/5 pt-safe px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Panier</h1>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Vérification de commande</p>
        </div>
        <div className="flex items-center gap-3">
          {!isEmpty && (
            <button 
              onClick={() => clearCart.mutate()}
              className="text-xs text-destructive/80 font-bold uppercase tracking-wider hover:text-destructive transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5" /> Vider
            </button>
          )}
        </div>
      </header>

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
        <div className="p-4 space-y-5 relative z-10">
          {loyaltyBalance && (
            <Link href="/account">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel border-amber-500/30 p-4 rounded-2xl flex items-center justify-between cursor-pointer relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-110" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground mb-0.5">Club Fidélité</p>
                    <div className="flex items-center gap-1.5 text-xs text-amber-500/80 font-medium">
                      <span>{tierEmoji}</span>
                      <span className="uppercase tracking-wider">Niveau {tierLabel}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right relative z-10">
                  <p className="text-2xl font-black text-amber-500 leading-none" data-testid="text-cart-points">{loyaltyBalance.points}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500/60 mt-1">points</p>
                </div>
              </motion.div>
            </Link>
          )}
          
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider ml-1">Produits</h3>
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
                  className="flex gap-4 glass-panel p-3.5 rounded-[1.5rem]"
                >
                  <div className="w-20 h-20 bg-black/40 rounded-xl overflow-hidden shrink-0 border border-white/5 relative">
                    <img 
                      src={item.product.imageUrl} 
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 flex flex-col justify-between py-0.5">
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-sm leading-tight text-foreground">{item.product.name}</h3>
                        <button 
                          onClick={() => removeItem.mutate(item.id)}
                          disabled={removeItem.isPending}
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors -mt-1 -mr-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-[10px] text-primary uppercase font-bold tracking-widest mt-1 mb-2">{item.product.brand}</p>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        {item.selectedPrice && item.selectedWeight ? (
                          <p className="text-sm font-black">{item.selectedPrice}€ <span className="text-xs text-muted-foreground font-medium ml-1">· {item.selectedWeight}</span></p>
                        ) : (
                          <p className="text-sm font-black">{formatPrice(item.product.price)}</p>
                        )}
                      </div>
                      
                      <div className="flex items-center bg-black/40 rounded-lg border border-white/5 overflow-hidden">
                        <button 
                          className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:bg-white/10 transition-colors"
                          onClick={() => {/* Update qty not implemented in hook yet */}}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                        <button 
                          className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:bg-white/10 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="glass-panel rounded-[1.5rem] p-5 space-y-5">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Récapitulatif</h3>
            
            {!appliedPromo ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => {
                        setPromoCode(e.target.value.toUpperCase());
                        setPromoError(null);
                      }}
                      placeholder="Code promotionnel"
                      className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/5 rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                      data-testid="input-promo-code"
                    />
                  </div>
                  <button
                    onClick={validatePromoCode}
                    disabled={promoLoading || !promoCode.trim()}
                    className="px-5 py-3 bg-white/5 text-foreground border border-white/10 hover:bg-white/10 rounded-xl text-sm font-bold disabled:opacity-50 transition-colors"
                    data-testid="button-apply-promo"
                  >
                    {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Appliquer"}
                  </button>
                </div>
                {promoError && (
                  <p className="text-[10px] text-destructive uppercase tracking-widest font-bold ml-1" data-testid="text-promo-error">{promoError}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3.5 bg-primary/10 rounded-xl border border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Tag className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <span className="text-sm font-bold">{appliedPromo.code}</span>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-primary mt-0.5">Code validé</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-primary">-{appliedPromo.discountPercent}%</span>
                  <button
                    onClick={removePromo}
                    className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium">Programme de fidélité</span>
                </div>
                <span className="text-sm font-bold text-amber-500">
                  {loyaltyBalance ? `${loyaltyBalance.points} pts` : 'Non connecté'}
                </span>
              </div>
              
              {loyaltyBalance && loyaltyBalance.points > 0 && loyaltySettings && (
                !showRedeemInput ? (
                  <button
                    onClick={() => setShowRedeemInput(true)}
                    className="w-full p-3.5 bg-amber-500/10 text-amber-500 rounded-xl text-sm font-bold border border-amber-500/20 flex items-center justify-center gap-2 hover:bg-amber-500/20 transition-colors"
                  >
                    <Gift className="w-4 h-4" />
                    Utiliser mes points (Max {Math.floor(loyaltyBalance.points / loyaltySettings.redeemRate)}€)
                  </button>
                ) : (
                  <div className="space-y-2 p-3.5 bg-black/40 border border-white/5 rounded-xl">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={pointsToRedeem || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setPointsToRedeem(Math.min(val, maxRedeemablePoints));
                        }}
                        max={maxRedeemablePoints}
                        placeholder={`Saisir pts (Max: ${maxRedeemablePoints})`}
                        className="flex-1 px-4 py-3 bg-background border border-white/5 rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
                      />
                      <button
                        onClick={() => {
                          setShowRedeemInput(false);
                          setPointsToRedeem(0);
                        }}
                        className="px-4 py-3 bg-white/5 rounded-lg font-medium border border-white/5"
                      >
                        Annuler
                      </button>
                    </div>
                    {pointsToRedeem > 0 && (
                      <p className="text-xs font-bold text-amber-500 text-center uppercase tracking-wider mt-2">
                        Réduction de {formatPrice(loyaltyDiscount)}
                      </p>
                    )}
                  </div>
                )
              )}
            </div>
            
            <div className="space-y-3 pt-5 border-t border-white/5">
              <div className="flex justify-between text-sm text-muted-foreground font-medium">
                <span>Sous-total</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {appliedPromo && (
                <div className="flex justify-between text-sm font-medium text-primary">
                  <span>Code promo</span>
                  <span>-{formatPrice(promoDiscount)}</span>
                </div>
              )}
              {pointsToRedeem > 0 && (
                <div className="flex justify-between text-sm font-medium text-amber-500">
                  <span>Points fidélité</span>
                  <span>-{formatPrice(loyaltyDiscount)}</span>
                </div>
              )}
              
              <div className="h-px w-full bg-white/5 my-2" />
              
              <div className="flex justify-between items-end pb-1">
                <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Total</span>
                <span className="text-3xl font-black text-foreground leading-none" data-testid="text-cart-total">{formatPrice(total)}</span>
              </div>
              
              {earnablePoints > 0 && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg mt-2">
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  <p className="text-xs font-medium text-amber-500">
                    +{earnablePoints} points gagnés avec cet achat
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fixed checkout bar */}
      {!isEmpty && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/80 backdrop-blur-2xl border-t border-white/5 pb-safe">
          <button 
            onClick={handleOrderClick}
            className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-bold text-lg shadow-[0_0_30px_-5px_rgba(34,197,94,0.4)] hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
          >
            <span>Procéder au paiement</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      )}

      <Dialog open={showDeliveryModal} onOpenChange={setShowDeliveryModal}>
        <DialogContent className="bg-card border-white/10 sm:max-w-md rounded-[2rem] p-0 overflow-hidden shadow-2xl">
          <div className="p-6 pb-8">
          {checkoutStep === 'delivery' ? (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Livraison</h2>
                <p className="text-sm text-muted-foreground">Comment souhaitez-vous recevoir votre commande ?</p>
              </div>
              
              <div className="space-y-3">
                {deliveryOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleDeliveryChoice(option.id)}
                      className={cn(
                        "w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 text-left group",
                        selectedDelivery === option.id
                          ? "border-primary bg-primary/10 shadow-[0_0_20px_-5px_rgba(34,197,94,0.2)]"
                          : "border-white/5 bg-black/40 hover:border-white/20"
                      )}
                      data-testid={`button-delivery-${option.id}`}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                        selectedDelivery === option.id ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground group-hover:text-foreground"
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-[15px]">{option.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                      </div>
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                        selectedDelivery === option.id ? "border-primary" : "border-white/10"
                      )}>
                        {selectedDelivery === option.id && <div className="w-3 h-3 bg-primary rounded-full" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <button 
                  onClick={() => setCheckoutStep('delivery')}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-xl font-bold">Informations</h2>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mt-1">Étape finale</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Adresse complète</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 rue de la Paix"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Code postal</label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="75001"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Ville</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Paris"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Heure de livraison</label>
                  <select
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-primary transition-colors appearance-none"
                  >
                    <option value="" disabled>Sélectionnez une heure</option>
                    {deliveryTimeSlots.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <div className="flex justify-between items-end mb-4">
                    <span className="text-sm font-medium text-muted-foreground">Total à régler</span>
                    <span className="text-2xl font-black text-primary">{formatPrice(total)}</span>
                  </div>
                  
                  <button
                    onClick={submitOrder}
                    disabled={isSubmitting || !address || !postalCode || !city || !deliveryTime}
                    className="w-full h-14 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_-5px_rgba(34,197,94,0.4)]"
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
                        Confirmer la commande
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="bg-card border-white/10 sm:max-w-md rounded-[2.5rem] p-8 text-center shadow-2xl">
          <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
            <Check className="w-12 h-12 text-primary relative z-10" />
          </div>
          <h2 className="text-3xl font-black mb-2">C'est validé !</h2>
          <p className="text-muted-foreground mb-6">Votre commande a été transmise avec succès à notre équipe.</p>
          
          <div className="bg-black/40 border border-white/5 rounded-xl p-4 mb-8">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Code de commande</p>
            <p className="text-2xl font-mono font-bold text-primary tracking-wider">{confirmedOrderCode}</p>
          </div>
          
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            L'application va se fermer...
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}