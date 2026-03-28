import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useSession } from "@/hooks/use-session";
import { useGetMyOrders } from "@workspace/api-client-react";
import { User, Package, KeyRound, Save, Shield, Settings } from "lucide-react";
import { format } from "date-fns";
import { TopBar } from "@/components/TopBar";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export default function Account() {
  const { chatId, username, saveChatId } = useSession();
  const [inputChatId, setInputChatId] = useState(chatId);
  const [isAdmin, setIsAdmin] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    if (!chatId) { setIsAdmin(false); return; }
    fetch(`${API}/is-admin/${chatId}`)
      .then(r => r.json())
      .then(d => setIsAdmin(d.isAdmin === true))
      .catch(() => setIsAdmin(false));
  }, [chatId]);

  // Charge la photo de profil Telegram via le proxy API
  useEffect(() => {
    if (!chatId) return;
    setAvatarUrl(null);
    setAvatarError(false);
    // On effectue juste un HEAD pour tester la disponibilité avant de setter l'URL
    fetch(`${API}/user-photo/${chatId}`, { method: "HEAD" })
      .then(r => { if (r.ok) setAvatarUrl(`${API}/user-photo/${chatId}`); })
      .catch(() => {});
  }, [chatId]);

  const { data: orders } = useGetMyOrders(chatId, { query: { enabled: !!chatId } });

  const handleSave = () => {
    if (inputChatId.trim()) saveChatId(inputChatId.trim());
  };

  if (!chatId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 pb-28">
        <div className="w-24 h-24 glass-panel rounded-full flex items-center justify-center mb-8 shadow-lg border border-primary/30">
          <KeyRound className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-black font-display mb-2 text-center">Connexion</h1>
        <p className="text-muted-foreground text-center mb-8 text-sm max-w-xs">
          Entrez votre ID Telegram pour retrouver votre historique de commandes et vos points de fidélité.
        </p>
        
        <div className="w-full max-w-sm space-y-4">
          <input
            type="text"
            value={inputChatId}
            onChange={(e) => setInputChatId(e.target.value)}
            placeholder="Votre Telegram Chat ID"
            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-center focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-lg font-bold"
          />
          <button 
            onClick={handleSave}
            disabled={!inputChatId.trim()}
            className="w-full bg-primary text-primary-foreground font-black text-lg py-4 rounded-2xl disabled:opacity-50 active:scale-95 transition-transform flex items-center justify-center gap-2 shadow-[0_0_20px_-5px_rgba(34,197,94,0.4)]"
          >
            <Save className="w-5 h-5" /> Connecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopBar title="Mon Compte" backHref="/menu" />
      <main className="p-4 space-y-6">
        {/* Profile Card */}
        <div className="glass-panel p-6 rounded-[2rem] flex items-center gap-5 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          {/* Avatar — photo Telegram ou fallback */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden border border-primary/30 bg-primary/10 flex items-center justify-center text-2xl"
              style={{ boxShadow: "0 0 20px -4px rgba(147,51,234,0.25)" }}>
              {avatarUrl && !avatarError ? (
                <img
                  src={avatarUrl}
                  alt="Photo de profil"
                  className="w-full h-full object-cover"
                  onError={() => setAvatarError(true)}
                />
              ) : username ? (
                <span className="font-display font-black text-2xl text-primary">
                  {username[0]?.toUpperCase()}
                </span>
              ) : (
                <User className="w-8 h-8 text-primary" />
              )}
            </div>
            {/* Indicateur Telegram live */}
            {avatarUrl && !avatarError && (
              <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-[#2aabee] border-2 border-[#080603] flex items-center justify-center"
                style={{ width: 18, height: 18 }}>
                <svg viewBox="0 0 24 24" fill="white" style={{ width: 10, height: 10 }}>
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
                </svg>
              </div>
            )}
          </div>

          <div className="min-w-0">
            {username && (
              <p className="font-display font-black text-xl text-primary truncate">@{username}</p>
            )}
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
              {username ? "Telegram ID" : "Identifiant"}
            </p>
            <p className="font-mono text-sm text-white/70 truncate">{chatId}</p>
          </div>
        </div>

        {/* Bouton Admin — visible uniquement si authentifié */}
        {isAdmin && (
          <Link href="/admin">
            <div className="relative overflow-hidden rounded-[2rem] p-[1px] cursor-pointer group">
              <div className="absolute inset-0 rounded-[2rem]" style={{ background: "linear-gradient(135deg, #a855f7, #06b6d4, #ec4899)" }} />
              <div className="relative glass-panel rounded-[calc(2rem-1px)] p-5 flex items-center justify-between bg-black/70">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #a855f7, #06b6d4)" }}>
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-black text-base text-white">Panel Admin</p>
                    <p className="text-xs text-purple-400 font-medium">Gérer la boutique</p>
                  </div>
                </div>
                <Settings className="w-5 h-5 text-muted-foreground group-hover:text-white group-hover:rotate-45 transition-all duration-300" />
              </div>
            </div>
          </Link>
        )}

        {/* Orders History */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 pl-2 flex items-center gap-2">
            <Package className="w-4 h-4" /> Historique Commandes
          </h2>
          
          <div className="space-y-3">
            {!orders?.length ? (
              <div className="glass-panel p-8 rounded-[1.5rem] text-center">
                <p className="text-muted-foreground text-sm">Aucune commande pour le moment.</p>
              </div>
            ) : (
              orders.map(order => (
                <div key={order.id} className="glass-panel p-5 rounded-[1.5rem] flex items-center justify-between hover:border-white/20 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-black font-display text-lg">#{order.orderCode}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        order.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                        order.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-white/10 text-white/70'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {order.createdAt ? format(new Date(order.createdAt), "dd MMM yyyy • HH:mm") : 'Date inconnue'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-muted-foreground">{order.deliveryType}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
