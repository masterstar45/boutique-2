import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Gift, Star, History, MessageCircle, ChevronRight, Award, Loader2, RefreshCw, Package, Heart, Clock, CheckCircle, Truck } from "lucide-react";
import logoImage from "@assets/pharmacy-hash-logo.png";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const tierColor = loyaltyBalance?.tier === 'gold' ? 'text-yellow-500' : loyaltyBalance?.tier === 'silver' ? 'text-gray-400' : 'text-amber-700';

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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 py-2 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold font-display">Mon Compte</h1>
        <div className="flex items-center gap-2">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="button-refresh-account"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <img 
            src={logoImage} 
            alt="PharmacyHash" 
            className="h-10 object-contain drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]"
          />
        </div>
      </header>

      <div className="p-4 space-y-6">
        {!isTelegramConnected && (
          <Card className="p-4 bg-amber-500/10 border-amber-500/30">
            <div className="flex items-center gap-3 mb-3">
              <MessageCircle className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-500">Mode démonstration</p>
                <p className="text-xs text-muted-foreground">
                  Connectez-vous via Telegram pour voir vos vraies données
                </p>
              </div>
            </div>
            <Button
              onClick={() => window.open('https://t.me/Zjzhhdhdjdbot', '_blank')}
              className="w-full"
              data-testid="button-connect-telegram"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Se connecter via Telegram
            </Button>
          </Card>
        )}
        
        {!chatId ? (
          <Card className="p-6 text-center">
            <Gift className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">Connectez-vous via Telegram</h2>
            <p className="text-sm text-muted-foreground">
              Ouvrez cette application via notre bot Telegram pour accéder à votre compte.
            </p>
          </Card>
        ) : loyaltyBalance ? (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-6 bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                      <Award className={`w-7 h-7 ${tierColor}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{tierEmoji}</span>
                        <span className={`font-bold text-lg ${tierColor}`}>Niveau {tierLabel}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Programme de fidélité</p>
                    </div>
                  </div>
                </div>

                <div className="bg-card/50 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Vos points</span>
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-primary fill-primary" />
                      <span className="text-2xl font-bold text-primary" data-testid="text-points-balance">
                        {loyaltyBalance?.points || 0}
                      </span>
                      <span className="text-muted-foreground">pts</span>
                    </div>
                  </div>
                </div>

                {nextTier && pointsToNextTier !== null && (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      Plus que <span className="text-primary font-semibold">{pointsToNextTier} pts</span> pour atteindre le niveau {nextTier}
                    </p>
                    <div className="mt-2 h-2 bg-muted/30 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ 
                          width: `${Math.min(100, ((loyaltyBalance?.totalEarned || 0) / (nextTierThreshold || 1)) * 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                )}

                {loyaltySettings && (
                  <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-xl font-bold text-foreground">{loyaltySettings.earnRate / 100}</p>
                      <p className="text-xs text-muted-foreground">pt / € dépensé</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-foreground">{loyaltySettings.redeemRate}</p>
                      <p className="text-xs text-muted-foreground">pts = 1€</p>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Tabs defaultValue="orders" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="orders" className="flex items-center gap-1">
                    <Package className="w-4 h-4" />
                    <span className="hidden sm:inline">Commandes</span>
                  </TabsTrigger>
                  <TabsTrigger value="favorites" className="flex items-center gap-1">
                    <Heart className="w-4 h-4" />
                    <span className="hidden sm:inline">Favoris</span>
                  </TabsTrigger>
                  <TabsTrigger value="points" className="flex items-center gap-1">
                    <History className="w-4 h-4" />
                    <span className="hidden sm:inline">Points</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="orders">
                  <Card className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <Package className="w-5 h-5 text-primary" />
                      <h2 className="font-semibold">Mes Commandes</h2>
                    </div>

                    {orders.length === 0 ? (
                      <p className="text-center text-muted-foreground text-sm py-6">
                        Aucune commande pour le moment
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {orders.map((order) => (
                          <div 
                            key={order.id}
                            className="p-3 bg-muted/20 rounded-lg"
                            data-testid={`order-${order.orderCode}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono text-sm font-bold text-primary">{order.orderCode}</span>
                              <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                                order.status === 'pending' ? 'bg-amber-500/20 text-amber-500' :
                                order.status === 'sent' ? 'bg-green-500/20 text-green-500' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {order.status === 'pending' ? <Clock className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                                {order.status === 'pending' ? 'En attente' : order.status === 'sent' ? 'Envoyée' : order.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Truck className="w-3 h-3" />
                              <span>{order.deliveryType === 'postal' ? 'Envoi Postal' : order.deliveryType === 'meetup' ? 'Meet-up' : 'Livraison'}</span>
                              {order.createdAt && (
                                <>
                                  <span>·</span>
                                  <span>{new Date(order.createdAt).toLocaleDateString('fr-FR')}</span>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </TabsContent>

                <TabsContent value="favorites">
                  <Card className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <Heart className="w-5 h-5 text-primary" />
                      <h2 className="font-semibold">Mes Favoris</h2>
                    </div>

                    {favorites.length === 0 ? (
                      <p className="text-center text-muted-foreground text-sm py-6">
                        Aucun favori pour le moment
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {favorites.map((fav) => (
                          <div 
                            key={fav.id}
                            className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg"
                            data-testid={`favorite-${fav.productId}`}
                          >
                            <div className="w-12 h-12 bg-muted rounded-lg overflow-hidden shrink-0">
                              <img src={fav.product.imageUrl} alt={fav.product.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{fav.product.name}</p>
                              <p className="text-xs text-muted-foreground">{fav.product.brand}</p>
                            </div>
                            <span className="font-bold text-primary shrink-0">
                              {(fav.product.price / 100).toFixed(2)}€
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </TabsContent>

                <TabsContent value="points">
                  <Card className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <History className="w-5 h-5 text-primary" />
                      <h2 className="font-semibold">Historique des points</h2>
                    </div>

                    {transactions.length === 0 ? (
                      <p className="text-center text-muted-foreground text-sm py-6">
                        Aucun historique pour le moment
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {transactions.map((tx) => (
                          <div 
                            key={tx.id}
                            className="flex items-center justify-between p-3 bg-muted/20 rounded-lg"
                          >
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {tx.reason === 'purchase' ? 'Achat' : 
                                 tx.reason === 'redemption' ? 'Utilisation' : 
                                 tx.reason === 'order' ? 'Commande' :
                                 tx.reason === 'admin' ? 'Ajustement admin' : tx.reason}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {tx.orderCode && `${tx.orderCode} · `}
                                {new Date(tx.createdAt).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                            <span className={`font-bold ${tx.delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {tx.delta > 0 ? '+' : ''}{tx.delta} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Button
                onClick={handleContactAdmin}
                variant="outline"
                className="w-full h-14 justify-between text-left border-primary/30"
                data-testid="button-contact-admin"
              >
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">Contacter un admin</p>
                    <p className="text-xs text-muted-foreground">Support et assistance</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </Button>
            </motion.div>
          </>
        ) : null}
      </div>
    </div>
  );
}
