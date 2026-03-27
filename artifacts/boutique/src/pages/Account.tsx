import { useState } from "react";
import { Link } from "wouter";
import { useSession } from "@/hooks/use-session";
import { useGetMyOrders, useGetLoyaltyBalance } from "@workspace/api-client-react";
import { User, Package, Star, KeyRound, Save, LogOut, Shield, Settings } from "lucide-react";
import { format } from "date-fns";
import { TopBar } from "@/components/TopBar";

export default function Account() {
  const { chatId, username, saveChatId, clearChatId } = useSession();
  const [inputChatId, setInputChatId] = useState(chatId);
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem("admin_auth") === "admin123");
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPass, setAdminPass] = useState("");
  const [adminError, setAdminError] = useState(false);

  const handleAdminLogin = () => {
    if (adminPass === "admin123") {
      localStorage.setItem("admin_auth", "admin123");
      setIsAdmin(true);
      setShowAdminModal(false);
      setAdminPass("");
    } else {
      setAdminError(true);
      setTimeout(() => setAdminError(false), 1500);
    }
  };

  const { data: orders } = useGetMyOrders(chatId, { query: { enabled: !!chatId } });
  const { data: loyalty } = useGetLoyaltyBalance(chatId, { query: { enabled: !!chatId } });

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
      <div className="px-4 pt-3 flex justify-end">
        <button onClick={clearChatId} className="flex items-center gap-1.5 text-xs text-destructive/70 hover:text-destructive transition-colors glass-panel px-3 py-1.5 rounded-full border-destructive/20">
          <LogOut className="w-3 h-3" /> Déconnecter
        </button>
      </div>

      <main className="p-4 space-y-6">
        {/* Profile Card */}
        <div className="glass-panel p-6 rounded-[2rem] flex items-center gap-5 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30 text-2xl">
            {username ? "👤" : <User className="w-8 h-8 text-primary" />}
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

        {/* Loyalty Points */}
        <div className="glass-panel p-6 rounded-[2rem] relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-amber-500/80 uppercase tracking-widest mb-1">Points Fidélité</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black font-display text-amber-500">{loyalty?.points || 0}</span>
                <span className="text-sm font-bold text-muted-foreground">pts</span>
              </div>
            </div>
            <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center shadow-[0_0_20px_-5px_rgba(245,158,11,0.4)]">
              <Star className="w-7 h-7 text-amber-500 fill-amber-500/20" />
            </div>
          </div>
        </div>

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
        {/* Accès admin discret pour non-admins */}
        {!isAdmin && (
          <div className="flex justify-center pt-4 pb-2">
            <button
              onClick={() => setShowAdminModal(true)}
              className="flex items-center gap-1.5 text-xs text-white/20 hover:text-white/50 transition-colors"
            >
              <Shield className="w-3 h-3" /> Admin
            </button>
          </div>
        )}
      </main>

      {/* Modal admin login */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-6" onClick={() => setShowAdminModal(false)}>
          <div className="w-full max-w-sm glass-panel rounded-[2rem] p-6 border border-purple-500/20" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #a855f7, #06b6d4)" }}>
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-black text-lg">Accès Admin</h3>
                <p className="text-xs text-muted-foreground">Entrez votre mot de passe</p>
              </div>
            </div>
            <input
              type="password"
              value={adminPass}
              onChange={e => setAdminPass(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdminLogin()}
              placeholder="Mot de passe"
              autoFocus
              className={`w-full bg-black/40 border rounded-2xl px-5 py-4 text-center focus:outline-none transition-all text-lg font-bold mb-4 ${adminError ? "border-red-500 animate-pulse" : "border-white/10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"}`}
            />
            {adminError && <p className="text-xs text-red-400 text-center mb-4">Mot de passe incorrect</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowAdminModal(false); setAdminPass(""); }}
                className="flex-1 py-3 glass-panel rounded-2xl text-sm font-bold hover:border-white/20 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleAdminLogin}
                disabled={!adminPass}
                className="flex-1 py-3 rounded-2xl text-sm font-black text-white disabled:opacity-50 transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, #a855f7, #06b6d4)" }}
              >
                Connexion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
