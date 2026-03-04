import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, MoreVertical, ChevronDown, X, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import type { Product } from "@shared/schema";

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
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-20">
        <div className="text-muted-foreground">Produit non trouvé</div>
      </div>
    );
  }

  const priceOptions = product.priceOptions as { price: number; weight: string }[] | null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="relative">
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4">
          <button
            onClick={() => navigate("/menu")}
            className="flex items-center gap-2 text-white text-sm font-medium"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
            Retour
          </button>
          <div className="flex items-center gap-2">
            <button className="text-white" data-testid="button-expand">
              <ChevronDown className="w-6 h-6" />
            </button>
            <button className="text-white" data-testid="button-more">
              <MoreVertical className="w-6 h-6" />
            </button>
          </div>
        </div>

        {product.sticker && (
          <div className="absolute top-4 right-16 z-10 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-md">
            <span className="text-white text-xs font-medium">
              {product.sticker} {product.stickerFlag === "US" ? "🇺🇸" : product.stickerFlag === "FR" ? "🇫🇷" : ""}
            </span>
          </div>
        )}

        <div className="aspect-square w-full bg-muted">
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
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
              data-testid={`img-product-${product.id}`}
            />
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-product-name">
            {product.name}
          </h1>
          <p className="text-lg text-muted-foreground" data-testid="text-product-brand">
            {product.brand}
          </p>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-product-description">
            {product.description}
          </p>
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-foreground">AJOUTER AU PANIER</span>
            {product.stock && (
              <span className="text-sm text-muted-foreground">Stock: {product.stock}</span>
            )}
          </div>

          {priceOptions && priceOptions.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {priceOptions.map((option, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="h-12 text-sm"
                  onClick={() => handleOptionClick(option)}
                  data-testid={`button-add-option-${index}`}
                >
                  {option.price}€ {option.weight}
                </Button>
              ))}
            </div>
          ) : (
            <Button
              className="w-full h-12"
              onClick={handleSimpleAdd}
              disabled={addToCart.isPending}
              data-testid="button-add-to-cart"
            >
              {addToCart.isPending ? "Ajout..." : `Ajouter - ${(product.price / 100).toFixed(0)}€`}
            </Button>
          )}
        </div>
      </div>

      {showModal && selectedOption && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div 
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-card rounded-t-3xl w-full max-w-md p-6 pb-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Ajouter au panier</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground"
                data-testid="button-close-modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-xl font-bold text-foreground">{product.name}</h3>
              <p className="text-primary font-medium">{selectedOption.price}€ {selectedOption.weight}</p>
            </div>

            <div className="flex items-center justify-center gap-4">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                data-testid="button-decrease-qty"
              >
                <Minus className="w-5 h-5" />
              </Button>
              <span className="text-2xl font-bold w-12 text-center text-foreground">{quantity}</span>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setQuantity(quantity + 1)}
                data-testid="button-increase-qty"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>

            <Button
              className="w-full h-14 text-lg"
              onClick={handleConfirm}
              disabled={addToCart.isPending}
              data-testid="button-confirm-add"
            >
              {addToCart.isPending ? "Ajout..." : "Valider"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
