import { useState } from "react";
import { useListReviews, useCreateReview, getListReviewsQueryKey } from "@workspace/api-client-react";
import { TopBar } from "@/components/TopBar";
import { MessageSquare, Star, Send } from "lucide-react";
import { motion } from "framer-motion";
import { useSession } from "@/hooks/use-session";
import { useQueryClient } from "@tanstack/react-query";

export default function Reviews() {
  const { chatId } = useSession();
  const queryClient = useQueryClient();
  const { data: reviews, isLoading } = useListReviews();
  const [text, setText] = useState("");

  const createReview = useCreateReview({
    mutation: {
      onSuccess: () => {
        setText("");
        queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey() });
        alert("Avis soumis pour validation !");
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !chatId) return;
    createReview.mutate({
      data: {
        chatId,
        text,
        username: "Utilisateur",
      }
    });
  };

  return (
    <div className="min-h-screen relative">
      <TopBar title="Avis Clients" subtitle="Ce qu'ils disent de nous" backHref="/menu" />

      <main className="p-4 space-y-6">
        {chatId ? (
          <form onSubmit={handleSubmit} className="glass-panel p-5 rounded-[2rem] shadow-lg border-primary/20 relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 relative z-10">Laisser un avis</h3>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Partagez votre expérience avec 🔌 SOS LE PLUG 🔌..."
              className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none h-28 mb-4 relative z-10"
            />
            <button 
              type="submit"
              disabled={!text.trim() || createReview.isPending}
              className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all relative z-10"
            >
              {createReview.isPending ? "Envoi..." : <><Send className="w-4 h-4" /> Envoyer</>}
            </button>
          </form>
        ) : (
          <div className="glass-panel p-5 rounded-[1.5rem] text-center border-amber-500/20 bg-amber-500/5">
            <p className="text-sm text-amber-500/80 font-medium">Connectez-vous dans l'onglet Compte pour laisser un avis.</p>
          </div>
        )}

        <div className="space-y-4">
          {isLoading ? (
            [...Array(4)].map((_, i) => <div key={i} className="h-32 glass-panel rounded-[1.5rem] animate-pulse" />)
          ) : reviews?.length === 0 ? (
            <div className="text-center p-8 glass-panel rounded-[2rem]">
              <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground font-medium">Aucun avis pour le moment.</p>
            </div>
          ) : (
            reviews?.map((review, i) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-panel p-5 rounded-[1.5rem]"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                    {review.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-bold text-sm leading-none">{review.username || 'Utilisateur Anonyme'}</p>
                    <div className="flex gap-0.5 mt-1">
                      {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 text-primary fill-primary" />)}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed italic">"{review.text}"</p>
              </motion.div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
