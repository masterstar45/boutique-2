import { useState, useEffect } from "react";
import { useCart, useRemoveFromCart, useClearCart } from "@/hooks/use-cart";
import { queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, ArrowRight, ShoppingBag, Truck, Users, Mail, Minus, Plus, Tag, X, Check, Loader2, MapPin, Star, Gift, Clock } from "lucide-react";
import { Link, useLocation } from "wouter";
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
import { Button } from "@/components/ui/button";

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
    { id: "postal", label: "Envoi Postal", icon: Mail, description: "Livraison par La Poste" },
    { id: "meetup", label: "Meet-up", icon: Users, description: "Rencontre directe" },
    { id: "delivery", label: "Livraison", icon: Truck, description: "Livraison à domicile" },
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
          title: "Code promo appliqué",
          description: `Réduction de ${data.discountPercent}% appliquée`,
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
        title: "Champs requis",
        description: "Veuillez remplir tous les champs",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const sessionId = localStorage.getItem('cart_session_id');
      
      const chatId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString();
      console.log('Telegram WebApp:', window.Telegram?.WebApp);
      console.log('initDataUnsafe:', window.Telegram?.WebApp?.initDataUnsafe);
      console.log('user:', window.Telegram?.WebApp?.initDataUnsafe?.user);
      console.log('chatId being sent:', chatId);
      
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
      
      // Refetch cart to show it's empty
      queryClient.invalidateQueries({ queryKey: ['/api/cart', sessionId] });
      
      // Show success modal
      setConfirmedOrderCode(data.orderCode);
      setShowSuccessModal(true);
      
      // Close Mini App after 3 seconds so user sees the confirmation
      setTimeout(() => {
        if (window.Telegram?.WebApp?.close) {
          window.Telegram?.WebApp?.close();
        }
      }, 3000);
      
    } catch (err) {
      console.error('Checkout error:', err);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue. Veuillez réessayer.",
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

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const isEmpty = !items || items.length === 0;

  return (
    <div className="min-h-screen pb-24 bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 py-2 flex items-center justify-between">
        <h1 className="text-xl font-bold">Panier</h1>
        <div className="flex items-center gap-3">
          <img 
            src={logoImage} 
            alt="PharmacyHash" 
            className="h-10 object-contain drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]"
          />
          {!isEmpty && (
            <button 
              onClick={() => clearCart.mutate()}
              className="text-xs text-destructive hover:opacity-80 transition-opacity flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Vider
            </button>
          )}
        </div>
      </header>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
          <div className="w-20 h-20 bg-card rounded-full flex items-center justify-center mb-6">
            <ShoppingBag className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold mb-2">Votre panier est vide</h2>
          <p className="text-muted-foreground mb-8 text-sm">Découvrez nos produits et ajoutez-les à votre panier.</p>
          <Link href="/menu" className="bg-primary text-white px-8 py-3 rounded-xl font-medium shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors">
            Voir le menu
          </Link>
        </div>
      ) : (
        <div className="p-4 space-y-6">
          {loyaltyBalance && (
            <Link href="/account">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-primary/20 to-amber-500/20 p-3 rounded-xl border border-primary/30 flex items-center justify-between hover:bg-primary/10 transition-colors cursor-pointer"
                data-testid="link-loyalty-balance"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Star className="w-5 h-5 text-primary fill-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Vos points fidélité</p>
                    <p className="text-xs text-muted-foreground">{tierEmoji} Niveau {tierLabel}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-primary" data-testid="text-cart-points">{loyaltyBalance.points}</p>
                  <p className="text-xs text-muted-foreground">points</p>
                </div>
              </motion.div>
            </Link>
          )}
          
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  className="flex gap-4 bg-card p-3 rounded-2xl border border-white/5"
                >
                  <div className="w-20 h-20 bg-muted/20 rounded-xl overflow-hidden shrink-0">
                    <img 
                      src={item.product.imageUrl} 
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 flex flex-col justify-between py-1">
                    <div>
                      <h3 className="font-semibold text-sm line-clamp-1">{item.product.name}</h3>
                      <p className="text-xs text-muted-foreground">{item.product.brand}</p>
                      {item.selectedPrice && item.selectedWeight ? (
                        <p className="text-sm text-muted-foreground mt-1">{item.selectedPrice}€ · {item.selectedWeight}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-1">{formatPrice(item.product.price)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-muted/30 rounded-lg">
                      <button className="w-10 h-10 flex items-center justify-center text-muted-foreground">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <button className="w-10 h-10 flex items-center justify-center text-muted-foreground">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <button 
                      onClick={() => removeItem.mutate(item.id)}
                      disabled={removeItem.isPending}
                      className="w-10 h-10 flex items-center justify-center bg-destructive/10 rounded-lg text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="bg-card rounded-2xl p-5 border border-white/5 space-y-4">
            {!appliedPromo ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => {
                        setPromoCode(e.target.value.toUpperCase());
                        setPromoError(null);
                      }}
                      placeholder="Code promo"
                      className="w-full pl-10 pr-4 py-2.5 bg-muted/30 rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      data-testid="input-promo-code"
                    />
                  </div>
                  <button
                    onClick={validatePromoCode}
                    disabled={promoLoading || !promoCode.trim()}
                    className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                    data-testid="button-apply-promo"
                  >
                    {promoLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Appliquer
                  </button>
                </div>
                {promoError && (
                  <p className="text-xs text-destructive" data-testid="text-promo-error">{promoError}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-primary/10 rounded-xl border border-primary/20">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{appliedPromo.code}</span>
                  <span className="text-xs text-primary">-{appliedPromo.discountPercent}%</span>
                </div>
                <button
                  onClick={removePromo}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                  data-testid="button-remove-promo"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium">Points fidélité</span>
                  {loyaltyBalance && (
                    <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full">
                      {tierEmoji} {tierLabel}
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold text-amber-500">
                  {loyaltyBalance ? `${loyaltyBalance.points} pts` : '0 pts'}
                </span>
              </div>
              
              {loyaltyBalance && loyaltyBalance.points > 0 && loyaltySettings ? (
                !showRedeemInput ? (
                  <button
                    onClick={() => setShowRedeemInput(true)}
                    className="w-full p-3 bg-amber-500/10 text-amber-500 rounded-xl text-sm font-medium border border-amber-500/20 flex items-center justify-center gap-2"
                    data-testid="button-use-points"
                  >
                    <Gift className="w-4 h-4" />
                    Utiliser mes points ({Math.floor(loyaltyBalance.points / loyaltySettings.redeemRate)} EUR max)
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={pointsToRedeem || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setPointsToRedeem(Math.min(val, maxRedeemablePoints));
                        }}
                        max={maxRedeemablePoints}
                        placeholder={`Max: ${maxRedeemablePoints}`}
                        className="flex-1 px-4 py-2.5 bg-muted/30 rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        data-testid="input-redeem-points"
                      />
                      <button
                        onClick={() => {
                          setShowRedeemInput(false);
                          setPointsToRedeem(0);
                        }}
                        className="px-3 py-2.5 bg-muted/30 rounded-xl"
                        data-testid="button-cancel-redeem"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {pointsToRedeem > 0 && (
                      <p className="text-xs text-amber-500">
                        = {formatPrice(loyaltyDiscount)} de réduction
                      </p>
                    )}
                  </div>
                )
              ) : (
                <p className="text-xs text-muted-foreground">
                  {!loyaltyBalance ? "Ouvrez via Telegram pour voir vos points" : "Gagnez des points sur chaque commande!"}
                </p>
              )}
            </div>
            
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Sous-total</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {appliedPromo && (
                <div className="flex justify-between text-sm text-primary">
                  <span>Réduction code ({appliedPromo.discountPercent}%)</span>
                  <span>-{formatPrice(promoDiscount)}</span>
                </div>
              )}
              {pointsToRedeem > 0 && (
                <div className="flex justify-between text-sm text-amber-500">
                  <span>Points ({pointsToRedeem} pts)</span>
                  <span>-{formatPrice(loyaltyDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2">
                <span>Total</span>
                <span data-testid="text-cart-total">{formatPrice(total)}</span>
              </div>
              {earnablePoints > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-500" />
                  Vous gagnerez {earnablePoints} points avec cette commande
                </p>
              )}
            </div>
          </div>

          <button 
            onClick={handleOrderClick}
            className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            <span>Commander</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      <Dialog open={showDeliveryModal} onOpenChange={setShowDeliveryModal}>
        <DialogContent className="bg-card border-white/10 max-w-sm">
          {checkoutStep === 'delivery' ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">Type de Livraison</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Choisissez votre méthode de livraison préférée
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-3 mt-6">
                {deliveryOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleDeliveryChoice(option.id)}
                      className={cn(
                        "w-full p-4 rounded-2xl border-2 transition-all flex items-start gap-3 text-left",
                        selectedDelivery === option.id
                          ? "border-primary bg-primary/10"
                          : "border-white/10 hover:border-primary/50"
                      )}
                      data-testid={`button-delivery-${option.id}`}
                    >
                      <Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-semibold">{option.label}</p>
                        <p className="text-sm text-muted-foreground">{option.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">Adresse de livraison</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Entrez votre adresse pour la livraison
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 mt-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Adresse</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Numéro et rue"
                      className="w-full pl-10 pr-4 py-3 bg-muted/30 rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      data-testid="input-address"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Code postal</label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="75001"
                      className="w-full px-4 py-3 bg-muted/30 rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      data-testid="input-postal-code"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Ville</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Paris"
                      className="w-full px-4 py-3 bg-muted/30 rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      data-testid="input-city"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Horaire de livraison
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {deliveryTimeSlots.map((time) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setDeliveryTime(time)}
                        className={cn(
                          "py-2 px-3 rounded-xl text-sm font-medium transition-all",
                          deliveryTime === time
                            ? "bg-primary text-white"
                            : "bg-muted/30 hover:bg-muted/50"
                        )}
                        data-testid={`button-time-${time}`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCheckoutStep('delivery')}
                    className="flex-1"
                    data-testid="button-back-delivery"
                  >
                    Retour
                  </Button>
                  <Button
                    onClick={submitOrder}
                    disabled={isSubmitting || !address.trim() || !postalCode.trim() || !city.trim() || !deliveryTime}
                    className="flex-1"
                    data-testid="button-confirm-order"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Confirmer
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Success Confirmation Modal */}
      <Dialog open={showSuccessModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md bg-background border-primary/20 [&>button]:hidden">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6"
            >
              <Check className="w-10 h-10 text-green-500" />
            </motion.div>
            
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold text-foreground mb-2"
            >
              Commande Confirmée!
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-muted-foreground mb-4"
            >
              Code: <span className="font-mono font-bold text-primary">{confirmedOrderCode}</span>
            </motion.p>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-sm text-muted-foreground"
            >
              Vous allez recevoir un message de confirmation...
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-6"
            >
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
