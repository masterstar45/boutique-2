import { useState } from "react";
import { useCart, useRemoveFromCart, useClearCart } from "@/hooks/use-cart";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, ArrowRight, ShoppingBag, X, Truck, Users, Mail } from "lucide-react";
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

export default function Cart() {
  const { data: items, isLoading } = useCart();
  const removeItem = useRemoveFromCart();
  const clearCart = useClearCart();
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<string | null>(null);
  const { toast } = useToast();

  const deliveryOptions = [
    { id: "postal", label: "Envoi Postal", icon: Mail, description: "Livraison par La Poste" },
    { id: "meetup", label: "Meet-up", icon: Users, description: "Rencontre directe" },
    { id: "delivery", label: "Livraison", icon: Truck, description: "Livraison à domicile" },
  ];

  const handleOrderClick = () => {
    setShowDeliveryModal(true);
  };

  const handleDeliverySelect = (deliveryId: string) => {
    setSelectedDelivery(deliveryId);
    const selected = deliveryOptions.find(opt => opt.id === deliveryId);
    toast({
      title: "Commande confirmée",
      description: `Livraison par ${selected?.label}`,
    });
    setShowDeliveryModal(false);
  };

  const subtotal = items?.reduce((sum, item) => sum + item.product.price * item.quantity, 0) || 0;
  const deliveryFee = 500; // 5.00 EUR fixed for now
  const total = subtotal + (items?.length ? deliveryFee : 0);

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
            className="h-8 object-contain"
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
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-sm line-clamp-1">{item.product.name}</h3>
                        <p className="text-xs text-muted-foreground">{item.product.brand}</p>
                      </div>
                      <button 
                        onClick={() => removeItem.mutate(item.id)}
                        disabled={removeItem.isPending}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs bg-white/5 px-2 py-1 rounded-md text-muted-foreground">Qty: {item.quantity}</span>
                      <span className="font-bold text-primary">{formatPrice(item.product.price * item.quantity)}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="bg-card rounded-2xl p-5 border border-white/5 space-y-3">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Sous-total</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Livraison</span>
              <span>{formatPrice(deliveryFee)}</span>
            </div>
            <div className="h-px bg-white/5 my-2" />
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
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
                  onClick={() => handleDeliverySelect(option.id)}
                  className={cn(
                    "w-full p-4 rounded-2xl border-2 transition-all flex items-start gap-3 text-left",
                    selectedDelivery === option.id
                      ? "border-primary bg-primary/10"
                      : "border-white/10 hover:border-primary/50"
                  )}
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
