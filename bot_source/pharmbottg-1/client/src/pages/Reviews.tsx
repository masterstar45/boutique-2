import { useState } from "react";
import { MessageCircle, Star, X } from "lucide-react";
import logoImage from "@assets/pharmacy-hash-logo.png";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Review } from "@shared/schema";

export default function Reviews() {
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  
  const { data: reviews = [], isLoading } = useQuery<Review[]>({
    queryKey: ['/api/reviews']
  });

  const submitReview = useMutation({
    mutationFn: async (text: string) => {
      return apiRequest('POST', '/api/reviews', { text });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reviews'] });
      setMessage("");
      setShowForm(false);
    }
  });

  const handleSubmit = () => {
    if (message.trim()) {
      submitReview.mutate(message);
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 py-2 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Avis</h1>
        <img 
          src={logoImage} 
          alt="PharmacyHash" 
          className="h-10 object-contain drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]"
        />
      </header>

      <div className="p-4 space-y-4">
        <Button 
          onClick={() => setShowForm(true)}
          size="lg"
          className="w-full gap-2"
          data-testid="button-leave-review"
        >
          <MessageCircle className="w-5 h-5" />
          Laisser un avis
        </Button>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">
            Chargement des avis...
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Star className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Aucun avis pour le moment</p>
            <p className="text-sm">Soyez le premier à partager votre expérience!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div 
                key={review.id} 
                className="bg-card p-4 rounded-xl border border-white/5"
                data-testid={`review-item-${review.id}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-muted-foreground">
                    {review.firstName || review.username || 'Client'}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">
                  {review.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 flex items-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowForm(false);
          }}
        >
          <div 
            className="bg-card w-full rounded-t-2xl p-4 pb-24 space-y-4 animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Votre avis</h2>
              <button 
                onClick={() => setShowForm(false)}
                className="p-2"
                data-testid="button-close-review"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Votre message *</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
                placeholder="Partagez votre expérience..."
                className="w-full mt-2 bg-muted/50 border border-white/10 rounded-xl p-4 text-sm min-h-[150px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                data-testid="input-review-message"
              />
              <div className="text-right text-xs text-muted-foreground mt-1">
                {message.length}/1000
              </div>
            </div>

            <Button 
              onClick={handleSubmit}
              disabled={!message.trim() || submitReview.isPending}
              className="w-full"
              size="lg"
              data-testid="button-submit-review"
            >
              {submitReview.isPending ? "Envoi..." : "Envoyer"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
