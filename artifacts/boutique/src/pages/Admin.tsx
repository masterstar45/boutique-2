import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListOrders, useGetAdminStats, useListProducts, useGetPendingReviews,
  useUpdateOrderStatus, useDeleteOrder, useDeleteProduct, useCreateProduct,
  useUpdateProduct, useApproveReview, useDeleteReview,
  useListPromoCodes, useCreatePromoCode, useDeletePromoCode,
  getListOrdersQueryKey, getListProductsQueryKey, getGetPendingReviewsQueryKey,
  getGetAdminStatsQueryKey, getListPromoCodesQueryKey,
} from "@workspace/api-client-react";
import {
  Package, Users, DollarSign, ShoppingBag, Shield, LogOut,
  Check, X, Plus, Trash2, Edit3, Tag, Star, ChevronRight,
  Clock, Truck, CheckCircle, AlertCircle, Eye, RefreshCw, BarChart3
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "orders", label: "Commandes", icon: ShoppingBag },
  { id: "products", label: "Produits", icon: Package },
  { id: "reviews", label: "Avis", icon: Star },
  { id: "promos", label: "Promos", icon: Tag },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending:   { label: "En attente",  color: "text-amber-400 bg-amber-400/10 border-amber-400/20",   icon: Clock },
  confirmed: { label: "Confirmée",   color: "text-blue-400 bg-blue-400/10 border-blue-400/20",     icon: CheckCircle },
  shipped:   { label: "Expédiée",    color: "text-purple-400 bg-purple-400/10 border-purple-400/20", icon: Truck },
  delivered: { label: "Livrée",      color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: CheckCircle },
  cancelled: { label: "Annulée",     color: "text-red-400 bg-red-400/10 border-red-400/20",         icon: X },
};

const STATUS_NEXT: Record<string, string> = {
  pending: "confirmed", confirmed: "shipped", shipped: "delivered",
};

const CATEGORIES = ["Fleurs", "Résines", "Vapes", "Huiles", "Comestibles", "Accessoires"];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "text-muted-foreground bg-white/5 border-white/10", icon: AlertCircle };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${cfg.color}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

export default function Admin() {
  const [auth, setAuth] = useState(() => localStorage.getItem("admin_auth") === "admin123");
  const [pass, setPass] = useState("");
  const [tab, setTab] = useState("dashboard");
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const qc = useQueryClient();

  const { data: stats, refetch: refetchStats } = useGetAdminStats({ query: { enabled: auth } as any });
  const { data: ordersData, refetch: refetchOrders } = useListOrders({}, { query: { enabled: auth && tab === "orders" } as any });
  const { data: products, refetch: refetchProducts } = useListProducts({}, { query: { enabled: auth && tab === "products" } as any });
  const { data: reviews, refetch: refetchReviews } = useGetPendingReviews({ query: { enabled: auth && tab === "reviews" } as any });
  const { data: promos, refetch: refetchPromos } = useListPromoCodes({ query: { enabled: auth && tab === "promos" } as any });

  const { mutate: updateStatus } = useUpdateOrderStatus({ mutation: { onSuccess: () => { refetchOrders(); refetchStats(); } } });
  const { mutate: deleteOrder } = useDeleteOrder({ mutation: { onSuccess: () => { refetchOrders(); refetchStats(); } } });
  const { mutate: deleteProduct } = useDeleteProduct({ mutation: { onSuccess: () => { refetchProducts(); refetchStats(); } } });
  const { mutate: createProduct } = useCreateProduct({ mutation: { onSuccess: () => { refetchProducts(); refetchStats(); setShowProductForm(false); setEditProduct(null); } } });
  const { mutate: updateProduct } = useUpdateProduct({ mutation: { onSuccess: () => { refetchProducts(); setShowProductForm(false); setEditProduct(null); } } });
  const { mutate: approveReview } = useApproveReview({ mutation: { onSuccess: () => refetchReviews() } });
  const { mutate: deleteReview } = useDeleteReview({ mutation: { onSuccess: () => refetchReviews() } });
  const { mutate: createPromo } = useCreatePromoCode({ mutation: { onSuccess: () => refetchPromos() } });
  const { mutate: deletePromo } = useDeletePromoCode({ mutation: { onSuccess: () => refetchPromos() } });

  // Auth screen
  if (!auth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="absolute inset-0">
          <img src={`${import.meta.env.BASE_URL}bg.png`} className="w-full h-full object-cover" alt="" />
          <div className="absolute inset-0 bg-black/80" />
        </div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full max-w-xs glass-panel p-8 rounded-[2rem] flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black font-display">Admin Panel</h1>
            <p className="text-xs text-muted-foreground mt-1">🔌 SOS LE PLUG 🔌</p>
          </div>
          <input
            type="password" value={pass} onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === "Enter" && pass === "admin123" && (localStorage.setItem("admin_auth", "admin123"), setAuth(true))}
            placeholder="Mot de passe admin"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-center focus:border-primary focus:outline-none"
          />
          <button
            onClick={() => { if (pass === "admin123") { localStorage.setItem("admin_auth", "admin123"); setAuth(true); } else alert("Mot de passe incorrect"); }}
            className="w-full font-bold py-3 rounded-xl text-white"
            style={{ background: "linear-gradient(135deg, hsl(270,90%,55%), hsl(200,90%,55%))" }}
          >
            Connexion
          </button>
        </motion.div>
      </div>
    );
  }

  const logout = () => { localStorage.removeItem("admin_auth"); setAuth(false); };

  return (
    <div className="min-h-screen bg-[#0d0a1a]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0d0a1a]/95 backdrop-blur border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <span className="font-black text-base gradient-plug">Admin Panel</span>
        </div>
        <button onClick={logout} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 transition-all">
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-white/5 bg-black/20 hide-scrollbar">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold whitespace-nowrap transition-all border-b-2 ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="w-3.5 h-3.5" />{t.label}
            </button>
          );
        })}
      </div>

      <main className="p-4">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>

            {/* ── DASHBOARD ── */}
            {tab === "dashboard" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: DollarSign, label: "Revenus", value: `${((stats?.totalRevenue || 0) / 100).toFixed(0)}€`, color: "text-emerald-400", bg: "bg-emerald-400/10" },
                    { icon: ShoppingBag, label: "Commandes", value: stats?.totalOrders ?? 0, color: "text-blue-400", bg: "bg-blue-400/10" },
                    { icon: Users, label: "Clients", value: stats?.totalUsers ?? 0, color: "text-purple-400", bg: "bg-purple-400/10" },
                    { icon: Package, label: "Produits", value: stats?.totalProducts ?? 0, color: "text-amber-400", bg: "bg-amber-400/10" },
                  ].map((card, i) => (
                    <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }} className="glass-panel p-4 rounded-[1.5rem]">
                      <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
                        <card.icon className={`w-5 h-5 ${card.color}`} />
                      </div>
                      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">{card.label}</p>
                      <p className={`text-2xl font-black font-display ${card.color}`}>{card.value}</p>
                    </motion.div>
                  ))}
                </div>

                {(stats?.pendingOrders ?? 0) > 0 && (
                  <div className="glass-panel p-4 rounded-[1.5rem] border border-amber-400/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-400/10 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{stats?.pendingOrders} commande{(stats?.pendingOrders ?? 0) > 1 ? "s" : ""} en attente</p>
                        <p className="text-xs text-muted-foreground">À traiter</p>
                      </div>
                    </div>
                    <button onClick={() => setTab("orders")} className="flex items-center gap-1 text-xs font-bold text-amber-400">
                      Voir <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button onClick={() => { refetchStats(); }} className="w-full py-3 rounded-xl bg-white/5 border border-white/5 text-sm font-bold flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground active:scale-95 transition-all">
                  <RefreshCw className="w-4 h-4" /> Actualiser
                </button>
              </div>
            )}

            {/* ── COMMANDES ── */}
            {tab === "orders" && (
              <div className="space-y-3">
                {!ordersData?.orders?.length && (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Aucune commande</p>
                  </div>
                )}
                {ordersData?.orders?.map(order => {
                  const parsed = (() => { try { return JSON.parse(order.orderData); } catch { return {}; } })();
                  const total = parsed.items?.reduce((s: number, i: any) => s + (i.selectedPrice || i.product?.price || 0) * i.quantity, 0) ?? 0;
                  return (
                    <div key={order.id} className="glass-panel rounded-[1.5rem] overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-black text-sm">#{order.orderCode}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{order.chatId ? `@${order.chatId}` : "Anonyme"} · {order.deliveryType === "delivery" ? "Livraison" : "Click & Collect"}</p>
                          </div>
                          <StatusBadge status={order.status} />
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-primary">{(total / 100).toFixed(2)}€</p>
                          <p className="text-xs text-muted-foreground">{parsed.items?.length ?? 0} article{(parsed.items?.length ?? 0) > 1 ? "s" : ""}</p>
                        </div>
                      </div>

                      <div className="border-t border-white/5 px-4 py-2.5 flex gap-2">
                        <button
                          onClick={() => setOrderDetail(orderDetail?.id === order.id ? null : { ...order, parsed })}
                          className="flex-1 py-1.5 rounded-lg bg-white/5 text-xs font-bold flex items-center justify-center gap-1 hover:bg-white/10 active:scale-95 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" /> Détails
                        </button>
                        {STATUS_NEXT[order.status] && (
                          <button
                            onClick={() => updateStatus({ orderCode: order.orderCode, data: { status: STATUS_NEXT[order.status] } })}
                            className="flex-1 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-bold flex items-center justify-center gap-1 hover:bg-primary/30 active:scale-95 transition-all"
                          >
                            <Check className="w-3.5 h-3.5" /> {STATUS_CONFIG[STATUS_NEXT[order.status]]?.label}
                          </button>
                        )}
                        <button
                          onClick={() => { if (confirm("Supprimer cette commande ?")) deleteOrder({ orderCode: order.orderCode }); }}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <AnimatePresence>
                        {orderDetail?.id === order.id && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/5 overflow-hidden">
                            <div className="p-4 space-y-2">
                              {orderDetail.parsed.items?.map((item: any, i: number) => (
                                <div key={i} className="flex items-center gap-3">
                                  <img src={item.product?.imageUrl || ""} alt="" className="w-10 h-10 rounded-lg object-cover bg-white/5" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate">{item.product?.name}</p>
                                    <p className="text-xs text-muted-foreground">{item.quantity}× · {((item.selectedPrice || item.product?.price || 0) / 100).toFixed(2)}€</p>
                                  </div>
                                </div>
                              ))}
                              {orderDetail.parsed.deliveryAddress && (
                                <p className="text-xs text-muted-foreground pt-1 border-t border-white/5">
                                  📍 {orderDetail.parsed.deliveryAddress}
                                </p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── PRODUITS ── */}
            {tab === "products" && (
              <div className="space-y-3">
                <button
                  onClick={() => { setEditProduct(null); setShowProductForm(true); }}
                  className="w-full py-3.5 rounded-[1.5rem] font-bold text-sm flex items-center justify-center gap-2 text-white active:scale-95 transition-all"
                  style={{ background: "linear-gradient(135deg, hsl(270,90%,55%), hsl(200,90%,55%))" }}
                >
                  <Plus className="w-4 h-4" /> Ajouter un produit
                </button>

                {products?.map(p => (
                  <div key={p.id} className="glass-panel p-3 rounded-[1.5rem] flex items-center gap-3">
                    <img src={p.imageUrl} alt="" className="w-14 h-14 rounded-xl object-cover bg-white/5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.category} · {p.brand}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-primary">{(p.price / 100).toFixed(2)}€</span>
                        {p.stock && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-md font-bold ${["0", "épuisé", "epuise", "rupture", "unavailable"].includes(String(p.stock).toLowerCase()) ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                            {["0", "épuisé", "epuise", "rupture", "unavailable"].includes(String(p.stock).toLowerCase()) ? "Épuisé" : p.stock}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => { setEditProduct(p); setShowProductForm(true); }}
                        className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { if (confirm(`Supprimer "${p.name}" ?`)) deleteProduct({ id: p.id }); }}
                        className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── AVIS ── */}
            {tab === "reviews" && (
              <div className="space-y-3">
                {!reviews?.length && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Aucun avis en attente</p>
                  </div>
                )}
                {reviews?.map(r => (
                  <div key={r.id} className="glass-panel p-4 rounded-[1.5rem]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm">👤</div>
                      <div>
                        <p className="text-sm font-bold">@{r.username || r.firstName || "Anonyme"}</p>
                        <p className="text-xs text-muted-foreground">En attente de validation</p>
                      </div>
                    </div>
                    <p className="text-sm text-foreground/80 italic mb-4 bg-white/5 rounded-xl p-3 border border-white/5">"{r.text}"</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => approveReview({ id: r.id })}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-500/30 active:scale-95 transition-all"
                      >
                        <Check className="w-4 h-4" /> Approuver
                      </button>
                      <button
                        onClick={() => deleteReview({ id: r.id })}
                        className="flex-1 py-2.5 rounded-xl bg-red-500/10 text-red-400 text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-red-500/20 active:scale-95 transition-all"
                      >
                        <X className="w-4 h-4" /> Rejeter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── PROMOS ── */}
            {tab === "promos" && <PromoTab promos={promos ?? []} onDelete={id => deletePromo({ id })} onCreate={data => createPromo({ data })} />}

          </motion.div>
        </AnimatePresence>
      </main>

      {/* Product form modal */}
      <AnimatePresence>
        {showProductForm && (
          <ProductFormModal
            product={editProduct}
            onClose={() => { setShowProductForm(false); setEditProduct(null); }}
            onCreate={data => createProduct({ data })}
            onUpdate={(id, data) => updateProduct({ id, data })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Promo Tab ────────────────────────────────────────────────────────────────

function PromoTab({ promos, onDelete, onCreate }: { promos: any[]; onDelete: (id: number) => void; onCreate: (data: any) => void }) {
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("");

  const handleCreate = () => {
    if (!code.trim() || !discount) return;
    onCreate({ code: code.toUpperCase(), discountPercent: Number(discount), active: true });
    setCode(""); setDiscount("");
  };

  return (
    <div className="space-y-4">
      <div className="glass-panel p-4 rounded-[1.5rem] space-y-3">
        <h3 className="font-bold text-sm flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Nouveau code promo</h3>
        <div className="flex gap-2">
          <input
            value={code} onChange={e => setCode(e.target.value)}
            placeholder="CODE"
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm uppercase font-bold focus:border-primary focus:outline-none"
          />
          <input
            value={discount} onChange={e => setDiscount(e.target.value)}
            placeholder="-%" type="number" min="1" max="100"
            className="w-20 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-bold text-center focus:border-primary focus:outline-none"
          />
        </div>
        <button onClick={handleCreate} disabled={!code || !discount} className="w-full py-2.5 rounded-xl font-bold text-sm text-white active:scale-95 transition-all disabled:opacity-40" style={{ background: "linear-gradient(135deg, hsl(270,90%,55%), hsl(200,90%,55%))" }}>
          Créer le code
        </button>
      </div>

      {promos.map(p => (
        <div key={p.id} className="glass-panel p-4 rounded-[1.5rem] flex items-center justify-between">
          <div>
            <p className="font-black text-base tracking-wider">{p.code}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Réduction : <span className="text-primary font-bold">{p.discountPercent}%</span></p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${p.active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
              {p.active ? "Actif" : "Inactif"}
            </span>
            <button onClick={() => onDelete(p.id)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Product Form Modal ────────────────────────────────────────────────────────

function ProductFormModal({ product, onClose, onCreate, onUpdate }: {
  product: any; onClose: () => void;
  onCreate: (data: any) => void; onUpdate: (id: number, data: any) => void;
}) {
  const [form, setForm] = useState({
    name: product?.name ?? "",
    brand: product?.brand ?? "",
    description: product?.description ?? "",
    price: product ? String(product.price) : "",
    imageUrl: product?.imageUrl ?? "",
    category: product?.category ?? CATEGORIES[0],
    stock: product?.stock ?? "disponible",
    sticker: product?.sticker ?? "",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.name || !form.imageUrl) return alert("Nom et image requis");
    const data = { ...form, price: Number(form.price) || 0, tags: [], priceOptions: [] };
    if (product) onUpdate(product.id, data);
    else onCreate(data);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end">
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 300 }} className="w-full max-h-[90vh] overflow-y-auto bg-[#0d0a1a] border-t border-white/10 rounded-t-[2rem] p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-black text-lg">{product ? "Modifier le produit" : "Nouveau produit"}</h2>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/5"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          {[
            { key: "name", label: "Nom *", placeholder: "ex: OG Kush" },
            { key: "brand", label: "Marque", placeholder: "ex: CannaFarm" },
            { key: "imageUrl", label: "URL Image *", placeholder: "https://..." },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">{f.label}</label>
              <input
                value={form[f.key as keyof typeof form]} onChange={e => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          ))}

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Description</label>
            <textarea
              value={form.description} onChange={e => set("description", e.target.value)}
              rows={3} placeholder="Description du produit..."
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-primary focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Prix (centimes)</label>
              <input
                value={form.price} onChange={e => set("price", e.target.value)}
                type="number" placeholder="1000 = 10€"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Stock</label>
              <input
                value={form.stock} onChange={e => set("stock", e.target.value)}
                placeholder="disponible / épuisé"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Catégorie</label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => set("category", c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${form.category === c ? "border-primary text-primary bg-primary/10" : "border-white/10 text-muted-foreground"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Badge (optionnel)</label>
            <input
              value={form.sticker} onChange={e => set("sticker", e.target.value)}
              placeholder="ex: 🔥 Nouveau, ⭐ Top vente"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          className="w-full mt-5 py-3.5 rounded-[1.5rem] font-bold text-white active:scale-95 transition-all"
          style={{ background: "linear-gradient(135deg, hsl(270,90%,55%), hsl(200,90%,55%))" }}
        >
          {product ? "Enregistrer les modifications" : "Ajouter le produit"}
        </button>
      </motion.div>
    </motion.div>
  );
}
