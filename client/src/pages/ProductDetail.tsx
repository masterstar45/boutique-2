import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, MoreVertical, ChevronDown, X, Minus, Plus, ShoppingBag, ShieldCheck, Leaf, Star, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import type { Product } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";

function getSessionId(): string {
  let sessionId = localStorage.getItem("cart_session_id");
  if (!sessionId) {
    sessionId = "session_" + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("cart_session_id", sessionId);
  }
  return sessionId;
}

export default function ProductDetail() {
  const [, params] = useRoute("/product/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const productId = params?.id;

  const [selectedOption, setSelectedOption] = useState<{ price: number; weight: string } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ["/api/products", productId],
    enabled: !!productId,
  });

  const addToCart = useMutation({
    mutationFn: async (data: { productId: number; quantity: number; selectedPrice?: number; selectedWeight?: string }) => {
      return apiRequest("POST", "/api/cart", {
        sessionId: getSessionId(),
        productId: data.productId,
        quantity: data.quantity,
        selectedPrice: data.selectedPrice,
        selectedWeight: data.selectedWeight,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.cart.list.path, getSessionId()] });
      setShowModal(false);
      setSelectedOption(null);
      setQuantity(1);
      toast({
        title: "Ajouté au panier",
        description: "Le produit a été ajouté à votre panier",
      });
    },
  });

  const handleOptionClick = (option: { price: number; weight: string }) => {
    setSelectedOption(option);
    setQuantity(1);
    setShowModal(true);
  };

  const handleConfirm = () => {
    if (!product || !selectedOption) return;
    addToCart.mutate({
      productId: product.id,
      quantity,
      selectedPrice: selectedOption.price,
      selectedWeight: selectedOption.weight,
    });
  };

  const handleSimpleAdd = () => {
    if (!product) return;
    addToCart.mutate({
      productId: product.id,
      quantity: 1,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-20">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <div className="text-muted-foreground font-medium">Chargement du produit...</div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center pb-20 p-6">
        <div className="w-20 h-20 bg-muted/20 rounded-full flex items-center justify-center mb-4">
          <ShoppingBag className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold mb-2">Produit introuvable</h2>
        <p className="text-muted-foreground text-center mb-8 text-sm">Ce produit n'existe plus ou a été retiré de notre catalogue.</p>
        <Button onClick={() => navigate("/menu")} className="rounded-xl px-8">Retour au menu</Button>
      </div>
    );
  }

  const priceOptions = product.priceOptions as { price: number; weight: string }[] | null;

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="relative h-[55vh] w-full rounded-b-[2.5rem] overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 pt-safe">
          <button
            onClick={() => navigate("/menu")}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black/40 backdrop-blur-md text-white shadow-lg border border-white/10 hover:bg-black/60 transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <button className="flex items-center justify-center w-10 h-10 rounded-full bg-black/40 backdrop-blur-md text-white shadow-lg border border-white/10 hover:bg-black/60 transition-colors" data-testid="button-more">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Subtle radial gradient behind image */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-background/5 mix-blend-overlay z-10" />

        {product.videoUrl ? (
          <video
            src={product.videoUrl}
            className="w-full h-full object-cover"
            controls
            autoPlay
            muted
            loop
            playsInline
            data-testid={`video-product-${product.id}`}
          />
        ) : (
          <motion.img
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            data-testid={`img-product-${product.id}`}
          />
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent z-10" />
        
        {product.sticker && (
          <div className="absolute bottom-6 left-6 z-20 flex items-center gap-2 bg-primary/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.4)] border border-primary/20">
            {product.stickerFlag && <span className="text-lg">{product.stickerFlag}</span>}
            <span className="text-xs font-black tracking-widest text-white uppercase">{product.sticker}</span>
          </div>
        )}
      </div>

      <div className="p-6 relative z-20 -mt-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-primary font-bold text-xs uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Leaf className="w-3.5 h-3.5" />
                {product.brand}
              </p>
              <h1 className="text-3xl font-black text-foreground tracking-tight leading-none mb-1" data-testid="text-product-name">
                {product.name}
              </h1>
            </div>
            
            <div className="flex items-center bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400 mr-1" />
              <span className="font-bold">4.9</span>
            </div>
          </div>
          
          <div className="flex gap-4 mt-6">
            <div className="flex-1 glass-panel rounded-2xl p-3 flex flex-col items-center justify-center text-center">
              <ShieldCheck className="w-6 h-6 text-primary mb-1" />
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Qualité testée</span>
            </div>
            <div className="flex-1 glass-panel rounded-2xl p-3 flex flex-col items-center justify-center text-center">
              <Sparkles className="w-6 h-6 text-primary mb-1" />
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Premium</span>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Description</h3>
            <p className="text-[15px] text-foreground/80 leading-relaxed font-body" data-testid="text-product-description">
              {product.description}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-background/80 backdrop-blur-2xl border-t border-white/5 pb-safe">
        <div className="flex items-center justify-between mb-4 px-2">
          <span className="text-sm font-bold text-foreground">SÉLECTIONNEZ UNE OPTION</span>
          {product.stock && (
            <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              En stock: {product.stock}
            </span>
          )}
        </div>

        {priceOptions && priceOptions.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {priceOptions.map((option, index) => (
              <button
                key={index}
                className="relative overflow-hidden group rounded-xl border border-white/10 bg-card hover:border-primary transition-all duration-300 active:scale-95 flex flex-col items-center justify-center py-3"
                onClick={() => handleOptionClick(option)}
                data-testid={`button-add-option-${index}`}
              >
                <span className="text-sm font-bold text-foreground mb-0.5">{option.weight}</span>
                <span className="text-xs font-medium text-primary">{option.price}€</span>
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        ) : (
          <Button
            className="w-full h-14 rounded-2xl text-lg font-bold shadow-[0_0_30px_-5px_rgba(34,197,94,0.4)]"
            onClick={handleSimpleAdd}
            disabled={addToCart.isPending}
            data-testid="button-add-to-cart"
          >
            {addToCart.isPending ? "Ajout..." : `Ajouter au panier - ${(product.price / 100).toFixed(0)}€`}
          </Button>
        )}
      </div>

      {/* Quantity Modal */}
      <AnimatePresence>
        {showModal && selectedOption && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowModal(false)}
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative bg-card border-t border-white/10 rounded-t-[2.5rem] w-full p-6 pb-12 space-y-8 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
            >
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto -mt-2 mb-6" />
              
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-1">Ajouter au panier</h2>
                  <h3 className="text-2xl font-bold text-foreground">{product.name}</h3>
                </div>
                <div className="bg-primary/10 px-4 py-2 rounded-xl text-right">
                  <p className="text-primary font-black text-xl leading-none">{selectedOption.price}€</p>
                  <p className="text-xs text-primary/70 font-medium uppercase mt-1">{selectedOption.weight}</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-6 py-4">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Quantité</p>
                <div className="flex items-center justify-center gap-6 bg-background rounded-full p-2 border border-white/5">
                  <button
                    className="w-12 h-12 rounded-full bg-card flex items-center justify-center text-foreground disabled:opacity-50 border border-white/5 hover:border-primary/50 transition-colors"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    data-testid="button-decrease-qty"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <span className="text-3xl font-black w-12 text-center text-foreground font-display">{quantity}</span>
                  <button
                    className="w-12 h-12 rounded-full bg-card flex items-center justify-center text-foreground border border-white/5 hover:border-primary/50 transition-colors"
                    onClick={() => setQuantity(quantity + 1)}
                    data-testid="button-increase-qty"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <Button
                className="w-full h-14 rounded-2xl text-lg font-bold shadow-[0_0_30px_-5px_rgba(34,197,94,0.4)]"
                onClick={handleConfirm}
                disabled={addToCart.isPending}
                data-testid="button-confirm-add"
              >
                {addToCart.isPending ? "Ajout en cours..." : `Confirmer l'ajout - ${selectedOption.price * quantity}€`}
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}