import { Star, MessageCircle } from "lucide-react";
import logoImage from "@assets/pharmacy-hash-logo.png";

export default function Reviews() {
  const reviews = [
    { id: 1, user: "Thomas D.", rating: 5, text: "Excellent quality as always. Fast delivery!", date: "2 days ago" },
    { id: 2, user: "Sarah L.", rating: 4, text: "Great product, but packaging could be better.", date: "1 week ago" },
    { id: 3, user: "Mike R.", rating: 5, text: "Best in Paris. Hands down.", date: "2 weeks ago" },
  ];

  return (
    <div className="min-h-screen pb-24 bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 py-2 flex items-center justify-between">
        <h1 className="text-xl font-bold">Avis Clients</h1>
        <img 
          src={logoImage} 
          alt="PharmacyHash" 
          className="h-8 object-contain"
        />
      </header>

      <div className="p-4 space-y-4">
        <div className="bg-gradient-to-br from-primary/20 to-purple-500/10 p-6 rounded-2xl border border-primary/20 text-center mb-6">
          <div className="text-4xl font-bold mb-1">4.8</div>
          <div className="flex justify-center gap-1 text-yellow-400 mb-2">
            {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 fill-current" />)}
          </div>
          <p className="text-sm text-muted-foreground">Based on 124 reviews</p>
        </div>

        {reviews.map((review) => (
          <div key={review.id} className="bg-card p-4 rounded-2xl border border-white/5">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                  {review.user.charAt(0)}
                </div>
                <div>
                  <div className="font-medium text-sm">{review.user}</div>
                  <div className="flex text-yellow-400">
                    {[...Array(review.rating)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-current" />
                    ))}
                  </div>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{review.date}</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{review.text}</p>
          </div>
        ))}

        <button className="w-full py-3 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
          <MessageCircle className="w-4 h-4" />
          Écrire un avis
        </button>
      </div>
    </div>
  );
}
