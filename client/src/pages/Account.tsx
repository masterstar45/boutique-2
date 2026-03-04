import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Gift, Star, History, MessageCircle, ChevronRight, Award, Loader2, RefreshCw, Package, Heart, Clock, CheckCircle, Truck } from "lucide-react";
import logoImage from "@assets/pharmacy-hash-logo.png";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LoyaltyBalance {
  points: number;
  tier: 'bronze' | 'silver' | 'gold';
  totalEarned: number;
}

interface LoyaltySettings {
  earnRate: number;
  redeemRate: number;
  silverThreshold: number;
  goldThreshold: number;
}

interface LoyaltyTransaction {
  id: number;
  delta: number;
  reason: string;
  orderCode: string | null;
  description: string | null;
  createdAt: string;
}

interface Order {
  id: number;
  orderCode: string;
  orderData: string;
  deliveryType: string;
  status: string;
  createdAt: string | null;
}

interface FavoriteWithProduct {
  id: number;
  chatId: string;
  productId: number;
  product: {
    id: number;
    name: string;
    brand: string;
    price: number;
    imageUrl: string;
  };
}

export default function Account() {
  const [loyaltyBalance, setLoyaltyBalance] = useState<LoyaltyBalance | null>(null);
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [favorites, setFavorites] = useState<FavoriteWithProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);

  const isTelegramConnected = !!window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  const userChatId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString();

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    try {
      const settingsRes = await fetch('/api/loyalty-settings');
      const settings = await settingsRes.json();
      setLoyaltySettings(settings);

      if (userChatId) {
        const [balance, history, userOrders, userFavorites] = await Promise.all([
          fetch(`/api/loyalty/${userChatId}`).then(res => res.json()),
          fetch(`/api/loyalty/${userChatId}/history`).then(res => res.json()),
          fetch(`/api/orders/${userChatId}`).then(res => res.json()),
          fetch(`/api/favorites/${userChatId}`).then(res => res.json())
        ]);
        setLoyaltyBalance(balance);
        setTransactions(history || []);
        setOrders(userOrders || []);
        setFavorites(userFavorites || []);
      } else {
        setLoyaltyBalance({ points: 0, tier: 'bronze', totalEarned: 0 });
        setTransactions([]);
        setOrders([]);
        setFavorites([]);
      }
    } catch (err) {
      console.error(err);
      setLoyaltyBalance({ points: 0, tier: 'bronze', totalEarned: 0 });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userChatId]);

  useEffect(() => {
    setChatId(userChatId || 'demo');
    fetchData();
  }, [fetchData, userChatId]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && userChatId) {
        fetchData(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchData, userChatId]);

  const handleRefresh = () => {
    fetchData(true);
  };

  const handleContactAdmin = () => {
    const botUsername = "Zjzhhdhdjdbot";
    const telegramUrl = `https://t.me/${botUsername}`;
    
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(telegramUrl);
    } else {
      window.open(telegramUrl, '_blank');
    }
  };

  const tierEmoji = loyaltyBalance?.tier === 'gold' ? '🥇' : loyaltyBalance?.tier === 'silver' ? '🥈' : '🥉';
  const tierLabel = loyaltyBalance?.tier === 'gold' ? 'Or' : loyaltyBalance?.tier === 'silver' ? 'Argent' : 'Bronze';
  const tierColor = loyaltyBalance?.tier === 'gold' ? 'text-amber-400' : loyaltyBalance?.tier === 'silver' ? 'text-gray-300' : 'text-amber-700';

  const nextTier = loyaltyBalance?.tier === 'bronze' ? 'Argent' : loyaltyBalance?.tier === 'silver' ? 'Or' : null;
  const nextTierThreshold = loyaltyBalance?.tier === 'bronze' 
    ? loyaltySettings?.silverThreshold 
    : loyaltyBalance?.tier === 'silver' 
      ? loyaltySettings?.goldThreshold 
      : null;
  const pointsToNextTier = nextTierThreshold && loyaltyBalance 
    ? Math.max(0, nextTierThreshold - loyaltyBalance.totalEarned)
    : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
        <p className="text-muted-foreground font-medium">Chargement du compte...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 bg-background relative">
      <div className="animated-bg" />
      
      <header className="sticky top-0 z-40 bg-background/60 backdrop-blur-2xl border-b border-white/5 pt-safe px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mon Compte</h1>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Espace personnel</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`w-10 h-10 rounded-full glass-panel flex items-center justify-center text-foreground hover:text-primary transition-colors ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
            data-testid="button-refresh-account"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="p-4 space-y-6 relative z-10">
        {!isTelegramConnected && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-[1.5rem] p-5 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
            <div className="flex items-start gap-4 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                <MessageCircle className="w-6 h-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-amber-500 mb-1">Mode Démo</h3>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  Ouvrez l'application via notre bot Telegram pour synchroniser votre compte et vos points de fidélité.
                </p>
                <button
                  onClick={() => window.open('https://t.me/Zjzhhdhdjdbot', '_blank')}
                  className="w-full py-2.5 bg-amber-500/20 text-amber-500 rounded-lg font-medium text-sm border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
                  data-testid="button-connect-telegram"
                >
                  Ouvrir dans Telegram
                </button>
              </div>
            </div>
          </motion.div>
        )}
        
        {loyaltyBalance && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative"
          >
            <div className="glass-panel rounded-[2rem] p-6 overflow-hidden border-primary/20 shadow-[0_10px_40px_-10px_rgba(34,197,94,0.2)]">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10" />
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl -ml-10 -mb-10" />
              
              <div className="relative z-10 flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-3xl filter drop-shadow-md">{tierEmoji}</span>
                    <h2 className={`text-xl font-bold ${tierColor} tracking-tight`}>Niveau {tierLabel}</h2>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Club Fidélité</p>
                </div>
                <div className="text-right">
                  <div className="flex items-end gap-1 justify-end">
                    <span className="text-4xl font-black text-primary leading-none" data-testid="text-points-balance">
                      {loyaltyBalance?.points || 0}
                    </span>
                    <span className="text-sm font-bold text-primary/70 mb-1">pts</span>
                  </div>
                </div>
              </div>

              {nextTier && pointsToNextTier !== null && (
                <div className="mb-6 bg-black/20 rounded-xl p-4 border border-white/5">
                  <div className="flex justify-between items-end mb-2">
                    <p className="text-xs text-muted-foreground">
                      <strong className="text-foreground">{pointsToNextTier} pts</strong> restants pour le niveau {nextTier}
                    </p>
                    <span className="text-[10px] font-bold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-md">
                      {Math.round(((loyaltyBalance?.totalEarned || 0) / (nextTierThreshold || 1)) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 bg-background rounded-full overflow-hidden border border-white/5">
                    <div 
                      className="h-full bg-gradient-to-r from-primary/50 to-primary rounded-full transition-all duration-1000 ease-out relative"
                      style={{ 
                        width: `${Math.min(100, ((loyaltyBalance?.totalEarned || 0) / (nextTierThreshold || 1)) * 100)}%` 
                      }}
                    >
                      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSI+PC9yZWN0Pgo8cGF0aCBkPSJNMCAwTDggOFpNOCAwTDAgOFoiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIj48L3BhdGg+Cjwvc3ZnPg==')] opacity-30" />
                    </div>
                  </div>
                </div>
              )}

              {loyaltySettings && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-1">
                      <Star className="w-4 h-4 text-primary" />
                      <span className="text-xs text-muted-foreground font-medium">Gain</span>
                    </div>
                    <p className="text-sm font-bold"><span className="text-lg">{loyaltySettings.earnRate / 100}</span> pts / €</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-1">
                      <Gift className="w-4 h-4 text-amber-500" />
                      <span className="text-xs text-muted-foreground font-medium">Valeur</span>
                    </div>
                    <p className="text-sm font-bold"><span className="text-lg">{loyaltySettings.redeemRate}</span> pts = 1€</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 p-1 bg-black/40 backdrop-blur-md rounded-2xl border border-white/5 h-14">
              <TabsTrigger value="orders" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-medium transition-all">
                <Package className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Commandes</span>
              </TabsTrigger>
              <TabsTrigger value="favorites" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-medium transition-all">
                <Heart className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Favoris</span>
              </TabsTrigger>
              <TabsTrigger value="points" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-medium transition-all">
                <History className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Historique</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="mt-0 outline-none">
              <div className="glass-panel rounded-[1.5rem] p-5">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  Dernières Commandes
                </h3>

                {orders.length === 0 ? (
                  <div className="py-8 text-center flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-3">
                      <Package className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">Aucune commande pour le moment</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((order) => (
                      <div 
                        key={order.id}
                        className="p-4 bg-black/30 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-mono text-sm font-bold tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                            #{order.orderCode}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                            order.status === 'pending' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/20' :
                            order.status === 'sent' ? 'bg-green-500/20 text-green-500 border border-green-500/20' :
                            'bg-white/10 text-muted-foreground border border-white/10'
                          }`}>
                            {order.status === 'pending' ? <Clock className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                            {order.status === 'pending' ? 'En attente' : order.status === 'sent' ? 'Envoyée' : order.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
                          <div className="flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5" />
                            <span>{order.deliveryType === 'postal' ? 'Postal' : order.deliveryType === 'meetup' ? 'Meet-up' : 'Livraison'}</span>
                          </div>
                          {order.createdAt && (
                            <div className="flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-white/20" />
                              <span>{new Date(order.createdAt).toLocaleDateString('fr-FR')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="favorites" className="mt-0 outline-none">
              <div className="glass-panel rounded-[1.5rem] p-5">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-primary" />
                  Produits Favoris
                </h3>

                {favorites.length === 0 ? (
                  <div className="py-8 text-center flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-3">
                      <Heart className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">Aucun favori pour le moment</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {favorites.map((fav) => (
                      <div 
                        key={fav.id}
                        className="flex items-center gap-4 p-3 bg-black/30 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                      >
                        <div className="w-14 h-14 bg-background rounded-lg overflow-hidden shrink-0 border border-white/5">
                          <img src={fav.product.imageUrl} alt={fav.product.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{fav.product.name}</p>
                          <p className="text-xs font-medium text-primary uppercase tracking-wider mt-0.5">{fav.product.brand}</p>
                        </div>
                        <span className="font-black text-foreground shrink-0 bg-white/5 px-3 py-1.5 rounded-lg text-sm">
                          {(fav.product.price / 100).toFixed(2)}€
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="points" className="mt-0 outline-none">
              <div className="glass-panel rounded-[1.5rem] p-5">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  Historique
                </h3>

                {transactions.length === 0 ? (
                  <div className="py-8 text-center flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-3">
                      <History className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">Aucun historique de points</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((tx) => (
                      <div 
                        key={tx.id}
                        className="flex items-center justify-between p-4 bg-black/30 rounded-xl border border-white/5"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-bold mb-1">
                            {tx.reason === 'purchase' ? 'Achat validé' : 
                             tx.reason === 'redemption' ? 'Utilisation de points' : 
                             tx.reason === 'order' ? 'Nouvelle commande' :
                             tx.reason === 'admin' ? 'Ajustement manuel' : tx.reason}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
                            {tx.orderCode && (
                              <>
                                <span className="text-primary/70">#{tx.orderCode}</span>
                                <span className="w-1 h-1 rounded-full bg-white/20" />
                              </>
                            )}
                            <span>{new Date(tx.createdAt).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </div>
                        <div className={`flex items-center justify-center px-3 py-1.5 rounded-lg border font-bold text-sm ${
                          tx.delta > 0 
                            ? 'bg-primary/10 text-primary border-primary/20' 
                            : 'bg-destructive/10 text-destructive border-destructive/20'
                        }`}>
                          {tx.delta > 0 ? '+' : ''}{tx.delta} pts
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <a
            href="https://t.me/Pharmacyhash"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-16 glass-panel rounded-2xl flex items-center justify-between px-5 group hover:border-primary/50 transition-all shadow-sm"
            data-testid="button-contact-admin"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <MessageCircle className="w-5 h-5 text-primary group-hover:text-current" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">Contacter le support</p>
                <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Une question ? Un problème ?</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </a>
        </motion.div>
      </div>
    </div>
  );
}