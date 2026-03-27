import { useState } from "react";
import { useListOrders, useGetAdminStats, useListProducts, useGetPendingReviews } from "@workspace/api-client-react";
import { Package, Users, DollarSign, List, Shield, Check, X, LogOut } from "lucide-react";
import { motion } from "framer-motion";

export default function Admin() {
  const [auth, setAuth] = useState(() => localStorage.getItem("admin_auth") === "admin123");
  const [pass, setPass] = useState("");
  const [tab, setTab] = useState<'stats' | 'orders' | 'products' | 'reviews'>('stats');

  const { data: stats } = useGetAdminStats({ query: { enabled: auth && tab === 'stats' }});
  const { data: orders } = useListOrders({}, { query: { enabled: auth && tab === 'orders' }});
  const { data: products } = useListProducts({}, { query: { enabled: auth && tab === 'products' }});
  const { data: reviews } = useGetPendingReviews({ query: { enabled: auth && tab === 'reviews' }});

  if (!auth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative z-50">
        <Shield className="w-16 h-16 text-primary mb-6" />
        <h1 className="text-2xl font-black font-display mb-6">Accès Restreint</h1>
        <input 
          type="password" 
          value={pass} 
          onChange={e => setPass(e.target.value)} 
          placeholder="Mot de passe"
          className="w-full max-w-xs bg-black/40 border border-white/10 rounded-xl px-4 py-3 mb-4 text-center focus:border-primary focus:outline-none"
        />
        <button 
          onClick={() => {
            if(pass === 'admin123') {
              localStorage.setItem("admin_auth", "admin123");
              setAuth(true);
            } else alert("Erreur");
          }}
          className="w-full max-w-xs bg-primary text-primary-foreground font-bold py-3 rounded-xl"
        >
          Connexion
        </button>
      </div>
    );
  }

  const logout = () => {
    localStorage.removeItem("admin_auth");
    setAuth(false);
  };

  return (
    <div className="min-h-screen bg-background relative z-50">
      <header className="bg-card border-b border-white/10 px-4 py-4 flex items-center justify-between">
        <h1 className="text-xl font-black font-display text-primary">Admin Panel</h1>
        <button onClick={logout} className="p-2 bg-white/5 rounded-lg hover:bg-white/10"><LogOut className="w-4 h-4"/></button>
      </header>

      <div className="flex overflow-x-auto border-b border-white/5 hide-scrollbar bg-card/50">
        {[
          { id: 'stats', label: 'Dashboard' },
          { id: 'orders', label: 'Commandes' },
          { id: 'products', label: 'Produits' },
          { id: 'reviews', label: 'Avis' }
        ].map(t => (
          <button 
            key={t.id} 
            onClick={() => setTab(t.id as any)}
            className={`px-6 py-4 font-bold text-sm whitespace-nowrap transition-colors border-b-2 ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={tab}>
          
          {tab === 'stats' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-panel p-5 rounded-[1.5rem]">
                <DollarSign className="w-6 h-6 text-emerald-500 mb-2" />
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Revenus</p>
                <p className="text-2xl font-black font-display">{(stats?.totalRevenue || 0) / 100}€</p>
              </div>
              <div className="glass-panel p-5 rounded-[1.5rem]">
                <Package className="w-6 h-6 text-blue-500 mb-2" />
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Commandes</p>
                <p className="text-2xl font-black font-display">{stats?.totalOrders || 0}</p>
              </div>
              <div className="glass-panel p-5 rounded-[1.5rem]">
                <Users className="w-6 h-6 text-purple-500 mb-2" />
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Utilisateurs</p>
                <p className="text-2xl font-black font-display">{stats?.totalUsers || 0}</p>
              </div>
              <div className="glass-panel p-5 rounded-[1.5rem]">
                <List className="w-6 h-6 text-amber-500 mb-2" />
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Produits</p>
                <p className="text-2xl font-black font-display">{stats?.totalProducts || 0}</p>
              </div>
            </div>
          )}

          {tab === 'orders' && (
            <div className="space-y-4">
              {orders?.orders?.map(order => (
                <div key={order.id} className="glass-panel p-4 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="font-bold">#{order.orderCode}</p>
                    <p className="text-xs text-muted-foreground">{order.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">{order.deliveryType}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'products' && (
            <div className="space-y-4">
              {products?.map(p => (
                <div key={p.id} className="glass-panel p-4 rounded-xl flex justify-between items-center">
                  <div className="flex gap-3 items-center">
                    <img src={p.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
                    <div>
                      <p className="font-bold text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.category}</p>
                    </div>
                  </div>
                  <p className="font-bold">{p.price}€</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'reviews' && (
            <div className="space-y-4">
              {!reviews?.length ? <p className="text-center text-muted-foreground">Aucun avis en attente</p> : null}
              {reviews?.map(r => (
                <div key={r.id} className="glass-panel p-4 rounded-xl">
                  <p className="text-sm font-bold mb-1">{r.username}</p>
                  <p className="text-sm text-muted-foreground italic mb-3">"{r.text}"</p>
                  <div className="flex gap-2">
                    <button className="flex-1 bg-primary/20 text-primary py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"><Check className="w-4 h-4"/> Approuver</button>
                    <button className="flex-1 bg-destructive/20 text-destructive py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"><X className="w-4 h-4"/> Rejeter</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
