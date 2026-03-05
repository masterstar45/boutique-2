import { useState } from "react";
import { MessageCircle, Star, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Review } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";

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
    <div className="min-h-screen pb-28 relative">
      <header className="sticky top-0 z-40 bg-background/60 backdrop-blur-2xl border-b border-white/5 pt-safe">
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Avis</h1>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Retours Clients</p>
          </div>
          <div className="w-10 h-10 rounded-full glass-panel flex items-center justify-center overflow-hidden border border-primary/20 shadow-[0_0_15px_-5px_rgba(34,197,94,0.3)]">
            <Star className="w-5 h-5 text-primary" />
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4 relative z-10">
        <button
          onClick={() => setShowForm(true)}
          className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-bold text-base shadow-[0_0_30px_-5px_rgba(34,197,94,0.4)] hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          data-testid="button-leave-review"
        >
          <Send className="w-5 h-5" />
          Laisser un avis
        </button>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="py-16 text-center glass-panel rounded-3xl p-8">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 mx-auto">
              <Star className="w-8 h-8 text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-lg font-bold mb-2">Aucun avis</h3>
            <p className="text-sm text-muted-foreground">Soyez le premier a partager votre experience!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review, i) => (
              <motion.div 
                key={review.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-panel p-4 rounded-[1.5rem]"
                data-testid={`review-item-${review.id}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">
                      {(review.firstName || review.username || 'C')[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-sm text-foreground">
                      {review.firstName || review.username || 'Client'}
                    </span>
                    {review.username && (
                      <p className="text-[10px] text-muted-foreground font-medium">@{review.username}</p>
                    )}
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-foreground/80">
                  {review.text}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <div 
            className="fixed inset-0 z-50 flex items-end"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowForm(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowForm(false)}
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative bg-card border-t border-white/10 rounded-t-[2.5rem] w-full p-6 pb-12 space-y-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto -mt-2 mb-2" />
              
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Votre avis</h2>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mt-0.5">Partagez votre experience</p>
                </div>
                <button 
                  onClick={() => setShowForm(false)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                  data-testid="button-close-review"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
                  placeholder="Partagez votre experience..."
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm min-h-[150px] resize-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground"
                  data-testid="input-review-message"
                />
                <div className="text-right text-[10px] text-muted-foreground mt-1.5 font-medium uppercase tracking-wider">
                  {message.length}/1000
                </div>
              </div>

              <Button 
                onClick={handleSubmit}
                disabled={!message.trim() || submitReview.isPending}
                className="w-full h-14 rounded-2xl text-lg font-bold shadow-[0_0_30px_-5px_rgba(34,197,94,0.4)]"
                data-testid="button-submit-review"
              >
                {submitReview.isPending ? "Envoi..." : "Envoyer"}
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
