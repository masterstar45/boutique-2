import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Package, Settings, MessageSquare, TrendingUp, Search, Plus, Star, Clock, CheckCircle, XCircle, Trash2, Tag, Loader2, AlertCircle, ChevronDown, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Order, Product, Review, PromoCode } from "@shared/schema";

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "A l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days}j`;
}

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2) + " EUR";
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "En attente", color: "text-amber-500 bg-amber-500/10", icon: Clock },
  sent: { label: "Envoyee", color: "text-blue-500 bg-blue-500/10", icon: Loader2 },
  processing: { label: "En cours", color: "text-blue-500 bg-blue-500/10", icon: Loader2 },
  completed: { label: "Terminee", color: "text-green-500 bg-green-500/10", icon: CheckCircle },
  cancelled: { label: "Annulee", color: "text-red-500 bg-red-500/10", icon: XCircle },
};

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [orderFilter, setOrderFilter] = useState<string | undefined>(undefined);
  const [orderSearch, setOrderSearch] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["/api/admin/orders", orderFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (orderFilter) params.set("status", orderFilter);
      params.set("limit", "50");
      const res = await fetch(`/api/admin/orders?${params}`);
      return res.json();
    },
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      return res.json();
    },
  });

  const { data: pendingReviews } = useQuery<Review[]>({
    queryKey: ["/api/admin/reviews/pending"],
    queryFn: async () => {
      const res = await fetch("/api/admin/reviews/pending");
      return res.json();
    },
  });

  const { data: promoCodes } = useQuery<PromoCode[]>({
    queryKey: ["/api/admin/promo-codes"],
    queryFn: async () => {
      const res = await fetch("/api/admin/promo-codes");
      return res.json();
    },
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderCode, status }: { orderCode: string; status: string }) => {
      await fetch(`/api/admin/orders/${orderCode}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
  });

  const approveReview = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/admin/reviews/${id}/approve`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
  });

  const deleteReview = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
  });

  const filteredOrders = (ordersData?.orders || []).filter((order: Order) => {
    if (!orderSearch) return true;
    const s = orderSearch.toLowerCase();
    return order.orderCode.toLowerCase().includes(s) ||
      order.chatId?.toLowerCase().includes(s) ||
      order.orderData.toLowerCase().includes(s);
  });

  return (
    <div className="min-h-screen pb-24 bg-background" data-testid="admin-dashboard">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-primary" data-testid="text-admin-title">Admin Panel</h1>
          <p className="text-xs text-muted-foreground">PharmacyHash Bot</p>
        </div>
        <div className="flex gap-2">
          <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center" data-testid="button-admin-settings">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {statsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20" data-testid="card-stat-users">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Users className="w-4 h-4 text-primary" />
                </div>
              </div>
              <p className="text-2xl font-bold" data-testid="text-total-users">{stats?.totalUsers || 0}</p>
              <p className="text-xs text-muted-foreground">Utilisateurs</p>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/20" data-testid="card-stat-orders">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Package className="w-4 h-4 text-amber-500" />
                </div>
                {(stats?.pendingOrders || 0) > 0 && (
                  <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {stats.pendingOrders}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-amber-500" data-testid="text-total-orders">{stats?.totalOrders || 0}</p>
              <p className="text-xs text-muted-foreground">Commandes totales</p>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-green-500/20 to-green-500/5 border-green-500/20" data-testid="card-stat-revenue">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
              </div>
              <p className="text-2xl font-bold text-green-500" data-testid="text-revenue-today">{formatPrice(stats?.revenueToday || 0)}</p>
              <p className="text-xs text-muted-foreground">Revenus aujourd'hui</p>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-purple-500/20 to-purple-500/5 border-purple-500/20" data-testid="card-stat-products">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Package className="w-4 h-4 text-purple-500" />
                </div>
                {(stats?.pendingReviews || 0) > 0 && (
                  <span className="text-xs font-bold text-purple-500 flex items-center gap-1">
                    <Star className="w-3 h-3" /> {stats.pendingReviews} avis
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-purple-500" data-testid="text-total-products">{stats?.totalProducts || 0}</p>
              <p className="text-xs text-muted-foreground">Produits</p>
            </Card>
          </div>
        )}

        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4 bg-black/40 p-1 rounded-xl">
            <TabsTrigger value="orders" className="rounded-lg text-xs" data-testid="tab-orders">Commandes</TabsTrigger>
            <TabsTrigger value="products" className="rounded-lg text-xs" data-testid="tab-products">Produits</TabsTrigger>
            <TabsTrigger value="reviews" className="rounded-lg text-xs" data-testid="tab-reviews">Avis</TabsTrigger>
            <TabsTrigger value="promos" className="rounded-lg text-xs" data-testid="tab-promos">Promos</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-3">
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              {[
                { value: undefined, label: "Tous" },
                { value: "pending", label: "En attente" },
                { value: "sent", label: "Envoyees" },
                { value: "completed", label: "Terminees" },
              ].map((f) => (
                <button
                  key={f.label}
                  onClick={() => setOrderFilter(f.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    orderFilter === f.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/5 text-muted-foreground hover:bg-white/10"
                  }`}
                  data-testid={`button-filter-${f.label.toLowerCase()}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Rechercher une commande..."
                className="w-full bg-card border border-white/5 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary/50"
                data-testid="input-order-search"
              />
            </div>

            {ordersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <Card className="p-8 text-center glass-panel">
                <Package className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">Aucune commande trouvee</p>
              </Card>
            ) : (
              filteredOrders.map((order: Order, i: number) => {
                const cfg = statusConfig[order.status] || statusConfig.pending;
                const StatusIcon = cfg.icon;
                const isExpanded = expandedOrder === order.orderCode;

                return (
                  <motion.div
                    key={order.orderCode}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-panel rounded-xl border border-white/5 overflow-hidden"
                    data-testid={`card-order-${order.orderCode}`}
                  >
                    <div className="p-3">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded" data-testid={`text-order-code-${order.orderCode}`}>
                            {order.orderCode}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${cfg.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatTimeAgo(order.createdAt)}</span>
                      </div>

                      {order.chatId && (
                        <p className="text-xs text-muted-foreground mb-2">Client: <span className="text-foreground font-mono">{order.chatId}</span></p>
                      )}

                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">{order.deliveryType}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setExpandedOrder(isExpanded ? null : order.orderCode)}
                            className="px-3 py-1.5 bg-white/5 rounded-lg text-xs font-medium hover:bg-white/10 flex items-center gap-1"
                            data-testid={`button-details-${order.orderCode}`}
                          >
                            <Eye className="w-3 h-3" />
                            <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </button>
                          {order.status === "pending" && (
                            <button
                              onClick={() => updateOrderStatus.mutate({ orderCode: order.orderCode, status: "sent" })}
                              className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold"
                              data-testid={`button-process-${order.orderCode}`}
                            >
                              Envoyer
                            </button>
                          )}
                          {(order.status === "sent" || order.status === "processing") && (
                            <button
                              onClick={() => updateOrderStatus.mutate({ orderCode: order.orderCode, status: "completed" })}
                              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold"
                              data-testid={`button-complete-${order.orderCode}`}
                            >
                              Terminer
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-white/5"
                        >
                          <pre className="p-3 text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                            {order.orderData}
                          </pre>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="products" className="space-y-3">
            {(products || []).length === 0 ? (
              <Card className="p-8 text-center glass-panel">
                <Package className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">Aucun produit</p>
              </Card>
            ) : (
              (products || []).map((product: Product) => (
                <div key={product.id} className="glass-panel p-3 rounded-xl border border-white/5 flex items-center gap-3" data-testid={`card-product-${product.id}`}>
                  <div className="w-14 h-14 rounded-lg bg-white/5 overflow-hidden flex-shrink-0">
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{product.brand} - {product.category}</p>
                    <p className="text-xs font-bold text-primary mt-0.5">{formatPrice(product.price)}</p>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Supprimer "${product.name}" ?`)) {
                        deleteProduct.mutate(product.id);
                      }
                    }}
                    className="p-2 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    data-testid={`button-delete-product-${product.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="reviews" className="space-y-3">
            {(pendingReviews || []).length === 0 ? (
              <Card className="p-8 text-center glass-panel">
                <Star className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">Aucun avis en attente</p>
              </Card>
            ) : (
              (pendingReviews || []).map((review: Review) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-panel p-3 rounded-xl border border-white/5"
                  data-testid={`card-review-${review.id}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-bold">{review.firstName || "Client"}</p>
                      {review.username && (
                        <p className="text-xs text-muted-foreground">@{review.username}</p>
                      )}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">En attente</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 leading-relaxed">"{review.text}"</p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => deleteReview.mutate(review.id)}
                      className="px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg text-xs font-medium hover:bg-red-500/20"
                      data-testid={`button-delete-review-${review.id}`}
                    >
                      Supprimer
                    </button>
                    <button
                      onClick={() => approveReview.mutate(review.id)}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold"
                      data-testid={`button-approve-review-${review.id}`}
                    >
                      Approuver
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </TabsContent>

          <TabsContent value="promos" className="space-y-3">
            {(promoCodes || []).length === 0 ? (
              <Card className="p-8 text-center glass-panel">
                <Tag className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">Aucun code promo</p>
              </Card>
            ) : (
              (promoCodes || []).map((promo: PromoCode) => (
                <div key={promo.id} className="glass-panel p-3 rounded-xl border border-white/5 flex items-center justify-between" data-testid={`card-promo-${promo.id}`}>
                  <div>
                    <p className="font-mono font-bold text-sm text-primary">{promo.code}</p>
                    <p className="text-xs text-muted-foreground">-{promo.discountPercent}% de reduction</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${promo.active ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                      {promo.active ? "Actif" : "Inactif"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
