import { useState, useRef, useEffect } from "react";
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
  Package, Users, DollarSign, ShoppingBag, Shield,
  Check, X, Plus, Trash2, Edit3, Tag, Star, ChevronRight,
  Clock, Truck, CheckCircle, AlertCircle, Eye, RefreshCw, BarChart3,
  Upload, Video, Image as ImageIcon, UserCog, UserCheck,
  MessageSquare, Send, Search, Lock, Unlock, FileText,
  Bell, BellRing, Megaphone, Calendar, Radio, RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const TABS = [
  { id: "dashboard", label: "Stats",    icon: BarChart3 },
  { id: "orders",    label: "Commandes",icon: ShoppingBag },
  { id: "products",  label: "Produits", icon: Package },
  { id: "reviews",   label: "Avis",     icon: Star },
  { id: "users",     label: "Clients",  icon: UserCheck },
  { id: "promos",    label: "Promos",   icon: Tag },
  { id: "notifs",    label: "Notifs",   icon: Bell },
  { id: "bot",       label: "Bot",      icon: Users },
  { id: "livreurs",  label: "Livreurs", icon: Truck },
  { id: "admins",    label: "Admins",   icon: UserCog },
];

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

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
  const [tab, setTab] = useState("dashboard");
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [resetRevenueConfirm, setResetRevenueConfirm] = useState(false);
  const [resetRevenueLoading, setResetRevenueLoading] = useState(false);
  const qc = useQueryClient();

  // ── Enriched orders (with user info) ──
  const [enrichedOrders, setEnrichedOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const fetchEnrichedOrders = async () => {
    setOrdersLoading(true);
    try {
      const r = await fetch(`${API}/admin/orders/enriched`);
      const data = await r.json();
      setEnrichedOrders(data.orders || []);
      const nm: Record<string, string> = {};
      data.orders?.forEach((o: any) => { if (o.notes) nm[o.orderCode] = o.notes; });
      setOrderNotes(nm);
    } finally { setOrdersLoading(false); }
  };
  useEffect(() => { if (tab === "orders") fetchEnrichedOrders(); }, [tab]);

  // ── Livreurs (pour l'onglet commandes) ──
  const [livreursList, setLivreursList] = useState<any[]>([]);
  const [selectedLivreur, setSelectedLivreur] = useState<Record<string, string>>({});
  const [transmitting, setTransmitting] = useState<string | null>(null);
  const [transmitOk, setTransmitOk] = useState<string | null>(null);

  useEffect(() => {
    if (tab === "orders" || tab === "livreurs") {
      fetch(`${API}/admin/livreurs`).then(r => r.json()).then(setLivreursList).catch(() => {});
    }
  }, [tab]);

  const handleTransmit = async (orderCode: string) => {
    const livreurId = selectedLivreur[orderCode];
    if (!livreurId) return;
    setTransmitting(orderCode);
    try {
      const r = await fetch(`${API}/admin/orders/${orderCode}/transmit-livreur`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ livreurId: Number(livreurId) }),
      });
      if (r.ok) { setTransmitOk(orderCode); setTimeout(() => setTransmitOk(null), 3000); }
      else { const d = await r.json(); alert(d.error || "Erreur"); }
    } finally { setTransmitting(null); }
  };

  // ── Order contact & notes ──
  const [contactOrder, setContactOrder] = useState<string | null>(null);
  const [contactMsg, setContactMsg] = useState("");
  const [sendingContact, setSendingContact] = useState(false);
  const [contactOk, setContactOk] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<string | null>(null);

  const sendOrderContact = async (chatId: string) => {
    if (!contactMsg.trim()) return;
    setSendingContact(true);
    try {
      const r = await fetch(`${API}/admin/send-telegram`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, text: contactMsg }),
      });
      if (r.ok) {
        setContactOk(chatId); setContactMsg(""); setContactOrder(null);
        setTimeout(() => setContactOk(null), 3000);
      }
    } finally { setSendingContact(false); }
  };

  const saveOrderNotes = async (orderCode: string) => {
    setSavingNotes(orderCode);
    try {
      await fetch(`${API}/admin/orders/${orderCode}/notes`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: orderNotes[orderCode] || null }),
      });
    } finally { setSavingNotes(null); }
  };

  const MSG_TEMPLATES = [
    "✅ Votre commande a été confirmée !",
    "🚀 Votre commande est en route !",
    "📦 Votre commande est disponible.",
    "⚠️ Problème avec votre commande. Contactez-nous.",
  ];

  const handleResetDailyRevenue = async () => {
    setResetRevenueLoading(true);
    try {
      await fetch(`${API}/admin/reset-daily-revenue`, { method: "POST" });
      await refetchStats();
      setResetRevenueConfirm(false);
    } finally { setResetRevenueLoading(false); }
  };

  const { data: stats, refetch: refetchStats } = useGetAdminStats({} as any);
  const { data: ordersData, refetch: refetchOrders } = useListOrders({}, { query: { enabled: tab === "orders" } as any });
  const { data: products, refetch: refetchProducts } = useListProducts({}, { query: { enabled: tab === "products" } as any });
  const { data: reviews, refetch: refetchReviews } = useGetPendingReviews({ query: { enabled: tab === "reviews" } as any });
  const { data: promos, refetch: refetchPromos } = useListPromoCodes({ query: { enabled: tab === "promos" } as any });

  const { mutate: updateStatus } = useUpdateOrderStatus({ mutation: { onSuccess: () => { refetchOrders(); refetchStats(); fetchEnrichedOrders(); } } });
  const { mutate: deleteOrder } = useDeleteOrder({ mutation: { onSuccess: () => { refetchOrders(); refetchStats(); fetchEnrichedOrders(); } } });
  const { mutate: deleteProduct } = useDeleteProduct({ mutation: { onSuccess: () => { refetchProducts(); refetchStats(); } } });
  const { mutate: createProduct } = useCreateProduct({ mutation: { onSuccess: () => { refetchProducts(); refetchStats(); setShowProductForm(false); setEditProduct(null); } } });
  const { mutate: updateProduct } = useUpdateProduct({ mutation: { onSuccess: () => { refetchProducts(); setShowProductForm(false); setEditProduct(null); } } });
  const { mutate: approveReview } = useApproveReview({ mutation: { onSuccess: () => refetchReviews() } });
  const { mutate: deleteReview } = useDeleteReview({ mutation: { onSuccess: () => refetchReviews() } });
  const { mutate: createPromo } = useCreatePromoCode({ mutation: { onSuccess: () => refetchPromos() } });
  const { mutate: deletePromo } = useDeletePromoCode({ mutation: { onSuccess: () => refetchPromos() } });

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
        <a href="/" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-white">
          <ShoppingBag className="w-4 h-4" /> Boutique
        </a>
      </header>

      {/* Tabs — grille compacte 4+3 */}
      <div className="px-3 py-2 border-b border-white/5 bg-black/20">
        {[TABS.slice(0, 4), TABS.slice(4)].map((row, ri) => (
          <div key={ri} className={`grid grid-cols-4 gap-1.5 ${ri === 0 ? "mb-1.5" : ""}`}>
            {row.map(t => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id} onClick={() => setTab(t.id)}
                  className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl text-[10px] font-bold transition-all active:scale-95 ${active ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground bg-white/5 border border-transparent hover:text-foreground"}`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <main className="p-4">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>

            {/* ── DASHBOARD ── */}
            {tab === "dashboard" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {/* Carte Revenus — cliquable pour remettre à zéro */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0 }}
                    onClick={() => setResetRevenueConfirm(true)}
                    className="glass-panel p-4 rounded-[1.5rem] cursor-pointer active:scale-95 transition-transform relative overflow-hidden"
                    style={{ borderColor: "rgba(201,160,76,0.15)" }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-400/10 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-emerald-400" />
                      </div>
                      <RotateCcw className="w-3.5 h-3.5 text-white/20 mt-1" />
                    </div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Revenus</p>
                    <p className="text-2xl font-black font-display text-emerald-400">{((stats?.totalRevenue || 0) / 100).toFixed(0)}€</p>
                  </motion.div>

                  {/* Autres cartes stats */}
                  {[
                    { icon: ShoppingBag, label: "Commandes", value: stats?.totalOrders ?? 0, color: "text-blue-400", bg: "bg-blue-400/10" },
                    { icon: Users, label: "Clients", value: stats?.totalUsers ?? 0, color: "text-purple-400", bg: "bg-purple-400/10" },
                    { icon: Package, label: "Produits", value: stats?.totalProducts ?? 0, color: "text-amber-400", bg: "bg-amber-400/10" },
                  ].map((card, i) => (
                    <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: (i + 1) * 0.06 }} className="glass-panel p-4 rounded-[1.5rem]">
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
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{enrichedOrders.length} commande{enrichedOrders.length !== 1 ? "s" : ""}</p>
                  <button onClick={fetchEnrichedOrders} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 transition-all">
                    <RefreshCw className={`w-3.5 h-3.5 ${ordersLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
                {!enrichedOrders.length && !ordersLoading && (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Aucune commande</p>
                  </div>
                )}
                {enrichedOrders.map(order => {
                  const parsed = (() => { try { return JSON.parse(order.orderData); } catch { return {}; } })();
                  const total = parsed.items?.reduce((s: number, i: any) => s + (i.selectedPrice || i.product?.price || 0) * i.quantity, 0) ?? 0;
                  const u = order.user;
                  const displayName = u?.firstName || u?.username
                    ? `${u.firstName || ""}${u.username ? ` @${u.username}` : ""}`.trim()
                    : order.chatId ? `#${order.chatId}` : "Anonyme";
                  const isDetailOpen = orderDetail?.id === order.id;
                  const isContactOpen = contactOrder === order.orderCode;
                  return (
                    <div key={order.id} className="glass-panel rounded-[1.5rem] overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-1.5">
                          <div>
                            <p className="font-black text-sm">#{order.orderCode}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {displayName} · {order.deliveryType === "delivery" ? "🚚 Livraison" : "🏪 C&C"}
                            </p>
                            {order.createdAt && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{new Date(order.createdAt).toLocaleDateString("fr-FR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}</p>}
                          </div>
                          <StatusBadge status={order.status} />
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-primary">{(total / 100).toFixed(2)}€</p>
                          <p className="text-xs text-muted-foreground">{parsed.items?.length ?? 0} article{(parsed.items?.length ?? 0) > 1 ? "s" : ""}</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="border-t border-white/5 px-3 py-2 flex gap-1.5">
                        <button onClick={() => setOrderDetail(isDetailOpen ? null : { ...order, parsed })}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all ${isDetailOpen ? "bg-primary/20 text-primary" : "bg-white/5 hover:bg-white/10"}`}>
                          <Eye className="w-3.5 h-3.5" /> Détails
                        </button>
                        {order.chatId && (
                          <button onClick={() => { setContactOrder(isContactOpen ? null : order.orderCode); setContactMsg(""); }}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all ${isContactOpen ? "bg-blue-500/20 text-blue-400" : "bg-white/5 hover:bg-white/10"}`}>
                            {contactOk === order.chatId
                              ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Envoyé</>
                              : <><MessageSquare className="w-3.5 h-3.5" /> Contact</>}
                          </button>
                        )}
                        {STATUS_NEXT[order.status] && (
                          <button onClick={() => updateStatus({ orderCode: order.orderCode, data: { status: STATUS_NEXT[order.status] } })}
                            className="flex-1 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-bold flex items-center justify-center gap-1 hover:bg-primary/30 active:scale-95 transition-all">
                            <Check className="w-3.5 h-3.5" /> {STATUS_CONFIG[STATUS_NEXT[order.status]]?.label}
                          </button>
                        )}
                        <button onClick={() => { if (confirm("Supprimer ?")) deleteOrder({ orderCode: order.orderCode }); }}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Contact panel */}
                      <AnimatePresence>
                        {isContactOpen && order.chatId && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-white/5">
                            <div className="p-3 space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Message rapide</p>
                              <div className="grid grid-cols-2 gap-1.5">
                                {MSG_TEMPLATES.map((tpl, i) => (
                                  <button key={i} onClick={() => setContactMsg(tpl)}
                                    className="text-[10px] px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 transition-all border border-white/10 text-left leading-tight">
                                    {tpl}
                                  </button>
                                ))}
                              </div>
                              <textarea value={contactMsg} onChange={e => setContactMsg(e.target.value)} rows={2}
                                placeholder="Message personnalisé…"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary transition-all resize-none" />
                              <button onClick={() => sendOrderContact(order.chatId!)} disabled={!contactMsg.trim() || sendingContact}
                                className="w-full py-2.5 rounded-xl font-bold text-white text-xs disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                                style={{ background: "linear-gradient(135deg, hsl(210,90%,55%), hsl(240,90%,55%))" }}>
                                <Send className="w-3.5 h-3.5" /> {sendingContact ? "Envoi…" : "Envoyer via Telegram"}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Detail panel */}
                      <AnimatePresence>
                        {isDetailOpen && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/5 overflow-hidden">
                            <div className="p-4 space-y-3">
                              {u && (
                                <div className="pb-2 border-b border-white/5 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                                      {(u.firstName || u.username || "?")[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold truncate">
                                        {u.firstName}
                                        {u.username && (
                                          <a
                                            href={`https://t.me/${u.username}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="ml-1 text-blue-400 hover:text-blue-300 transition-colors"
                                          >
                                            @{u.username}
                                          </a>
                                        )}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground font-mono">ID : {u.chatId}</p>
                                    </div>
                                    {u.isUnlocked ? <Unlock className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                                  </div>
                                  {/* Bouton contact Telegram direct */}
                                  {u.username && (
                                    <a
                                      href={`https://t.me/${u.username}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-[11px] font-bold transition-all active:scale-95"
                                      style={{
                                        background: "rgba(35,158,217,0.15)",
                                        border: "1px solid rgba(35,158,217,0.3)",
                                        color: "#4db8e8",
                                      }}
                                    >
                                      ✈️ Ouvrir le chat @{u.username}
                                    </a>
                                  )}
                                  {/* Fallback si pas d'username : affiche juste l'ID */}
                                  {!u.username && order.chatId && (
                                    <p className="text-[10px] text-amber-400/80 text-center">
                                      Pas de @username — utilise le bouton Contact ↑
                                    </p>
                                  )}
                                </div>
                              )}
                              {parsed.items?.map((item: any, i: number) => (
                                <div key={i} className="flex items-center gap-3">
                                  <img src={item.product?.imageUrl || ""} alt="" className="w-10 h-10 rounded-lg object-cover bg-white/5 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate">{item.product?.name}</p>
                                    <p className="text-xs text-muted-foreground">{item.quantity}× · {((item.selectedPrice || item.product?.price || 0) / 100).toFixed(2)}€{item.selectedWeight ? ` · ${item.selectedWeight}` : ""}</p>
                                  </div>
                                </div>
                              ))}
                              {parsed.deliveryAddress && <p className="text-xs text-muted-foreground pt-1 border-t border-white/5">📍 {parsed.deliveryAddress}</p>}
                              {parsed.promoCode && <p className="text-xs text-emerald-400 font-bold">🏷️ Promo : {parsed.promoCode}</p>}
                              <div className="pt-1 border-t border-white/5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1">
                                  <FileText className="w-3 h-3" /> Notes admin
                                </p>
                                <textarea value={orderNotes[order.orderCode] || ""} onChange={e => setOrderNotes(n => ({ ...n, [order.orderCode]: e.target.value }))}
                                  rows={2} placeholder="Note interne…"
                                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary transition-all resize-none" />
                                <button onClick={() => saveOrderNotes(order.orderCode)} disabled={savingNotes === order.orderCode}
                                  className="mt-1.5 w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold active:scale-95 transition-all disabled:opacity-50">
                                  {savingNotes === order.orderCode ? "Sauvegarde…" : "💾 Sauvegarder la note"}
                                </button>
                              </div>

                              {/* ── Transmission livreur ── */}
                              {order.deliveryType === "delivery" && (
                                <div className="pt-1 border-t border-white/5">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1">
                                    <Truck className="w-3 h-3" /> Transmettre au livreur
                                  </p>
                                  {livreursList.filter(l => l.isActive).length === 0 ? (
                                    <p className="text-[10px] text-amber-400/80 text-center py-2">
                                      Aucun livreur actif — configure-les dans l'onglet "Livreurs"
                                    </p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      <select
                                        value={selectedLivreur[order.orderCode] || ""}
                                        onChange={e => setSelectedLivreur(s => ({ ...s, [order.orderCode]: e.target.value }))}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary transition-all appearance-none"
                                      >
                                        <option value="">— Choisir un livreur —</option>
                                        {livreursList.filter(l => l.isActive).map(l => (
                                          <option key={l.id} value={String(l.id)}>
                                            🛵 {l.name}{l.username ? ` (@${l.username})` : ""}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        onClick={() => handleTransmit(order.orderCode)}
                                        disabled={!selectedLivreur[order.orderCode] || transmitting === order.orderCode}
                                        className="w-full py-2 rounded-xl text-xs font-bold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                        style={{ background: transmitOk === order.orderCode ? "rgba(16,185,129,0.2)" : "linear-gradient(135deg, rgba(201,160,76,0.25), rgba(240,208,112,0.15))", border: `1px solid ${transmitOk === order.orderCode ? "rgba(16,185,129,0.4)" : "rgba(201,160,76,0.3)"}`, color: transmitOk === order.orderCode ? "#10b981" : "#f0d070" }}
                                      >
                                        {transmitOk === order.orderCode
                                          ? <><Check className="w-3.5 h-3.5" /> Transmis avec succès !</>
                                          : transmitting === order.orderCode
                                          ? "Envoi en cours…"
                                          : <><Send className="w-3.5 h-3.5" /> Transmettre via Telegram</>}
                                      </button>
                                    </div>
                                  )}
                                </div>
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

            {/* ── CLIENTS ── */}
            {tab === "users" && <UsersTab />}

            {/* ── NOTIFS ── */}
            {tab === "notifs" && <NotifsTab />}

            {/* ── BOT /start ── */}
            {tab === "bot" && <BotStartTab />}

            {/* ── LIVREURS ── */}
            {tab === "livreurs" && <LivreursTab livreursList={livreursList} onRefresh={() => fetch(`${API}/admin/livreurs`).then(r => r.json()).then(setLivreursList).catch(() => {})} />}

            {/* ── ADMINS ── */}
            {tab === "admins" && <AdminsTab />}

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

      {/* Modal confirmation reset revenu journalier */}
      <AnimatePresence>
        {resetRevenueConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
            onClick={() => setResetRevenueConfirm(false)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-[430px] rounded-t-[2rem] p-6 pb-10 space-y-4"
              style={{ background: "#12100a", border: "1px solid rgba(201,160,76,0.15)", borderBottom: "none" }}
            >
              <div className="w-12 h-1 rounded-full bg-white/20 mx-auto mb-2" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <RotateCcw className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="font-bold text-sm">Remettre les revenus à zéro</p>
                  <p className="text-xs text-muted-foreground">Le revenu d'aujourd'hui passera à 0€.</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground bg-white/5 rounded-xl px-4 py-3">
                Cette action remet uniquement le compteur journalier à zéro. Les commandes existantes ne sont pas modifiées.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setResetRevenueConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold active:scale-95 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleResetDailyRevenue}
                  disabled={resetRevenueLoading}
                  className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95 transition-all flex items-center justify-center gap-2"
                  style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
                >
                  {resetRevenueLoading
                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                    : <><RotateCcw className="w-4 h-4" /> Remettre à zéro</>
                  }
                </button>
              </div>
            </motion.div>
          </motion.div>
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
    imageUrl: product?.imageUrl ?? "",
    videoUrl: "",
    category: product?.category ?? CATEGORIES[0],
    stock: product?.stock ?? "disponible",
    sticker: product?.sticker ?? "",
  });
  const [priceOptions, setPriceOptions] = useState<{ weight: string; price: string }[]>(
    () => (product?.priceOptions ?? []).map((o: any) => ({ weight: String(o.weight), price: String(o.price) }))
  );
  const [imageLoading, setImageLoading] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const addOption = () => setPriceOptions(opts => [...opts, { weight: "", price: "" }]);
  const removeOption = (i: number) => setPriceOptions(opts => opts.filter((_, idx) => idx !== i));
  const setOption = (i: number, key: "weight" | "price", val: string) =>
    setPriceOptions(opts => opts.map((o, idx) => idx === i ? { ...o, [key]: val } : o));

  // Si édition et hasVideo, récupérer l'URL de la vidéo existante
  useEffect(() => {
    if (!product?.id) return;
    if (!product.hasVideo) return;
    // Si videoUrl est déjà une URL serveur, l'utiliser directement
    if (product.videoUrl && !product.videoUrl.startsWith("data:")) {
      setForm(f => ({ ...f, videoUrl: product.videoUrl! }));
      return;
    }
    // Sinon charger depuis l'endpoint vidéo
    fetch(`${API}/products/${product.id}/video`)
      .then(r => r.json())
      .then(d => { if (d.videoUrl) setForm(f => ({ ...f, videoUrl: d.videoUrl })); })
      .catch(() => {});
  }, [product?.id, product?.hasVideo]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageLoading(true);
    const reader = new FileReader();
    reader.onload = ev => { set("imageUrl", ev.target?.result as string); setImageLoading(false); };
    reader.readAsDataURL(file);
  };

  const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { alert("Vidéo trop lourde (max 50 Mo)"); return; }
    setVideoLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API}/upload`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload échoué");
      const { url } = await res.json();
      // url est du type /api/uploads/filename.mp4 — on le préfixe avec BASE_URL
      const fullUrl = url.startsWith("http") ? url : `${import.meta.env.BASE_URL.replace(/\/$/, "")}${url}`;
      set("videoUrl", fullUrl);
    } catch (err) {
      alert("Erreur lors de l'import de la vidéo. Réessaie.");
      console.error(err);
    } finally {
      setVideoLoading(false);
      if (videoRef.current) videoRef.current.value = "";
    }
  };

  const handleSubmit = () => {
    if (!form.name || !form.imageUrl) return alert("Nom et image requis");
    if (priceOptions.length === 0) return alert("Ajoute au moins une option de prix");
    const parsedOptions = priceOptions.map(o => ({ weight: o.weight.trim(), price: Number(o.price) || 0 }));
    const minPrice = Math.min(...parsedOptions.map(o => o.price));
    const data = { ...form, price: Math.round(minPrice * 100), tags: [], priceOptions: parsedOptions };
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
          {/* Nom & Marque */}
          {[
            { key: "name", label: "Nom *", placeholder: "ex: OG Kush" },
            { key: "brand", label: "Marque", placeholder: "ex: CannaFarm" },
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

          {/* Image */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Image *</label>
            <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
            {form.imageUrl ? (
              <div className="relative rounded-xl overflow-hidden">
                <img src={form.imageUrl} alt="" className="w-full h-36 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-2 right-2 flex gap-1.5">
                  <button onClick={() => imageRef.current?.click()} className="bg-primary/90 backdrop-blur-sm rounded-lg px-2.5 py-1 text-xs font-bold flex items-center gap-1">
                    <Upload className="w-3 h-3" /> Changer
                  </button>
                  <button onClick={() => { set("imageUrl", ""); if (imageRef.current) imageRef.current.value = ""; }} className="bg-red-500/80 backdrop-blur-sm rounded-lg p-1">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => imageRef.current?.click()} disabled={imageLoading}
                className="w-full h-28 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-95">
                {imageLoading ? <span className="text-xs animate-pulse">Chargement…</span> : (
                  <><ImageIcon className="w-6 h-6 opacity-60" /><span className="text-xs">Importer une image</span></>
                )}
              </button>
            )}
          </div>

          {/* Vidéo */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Vidéo (optionnel)</label>
            <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/mov" className="hidden" onChange={handleVideoFile} />
            {form.videoUrl ? (
              <div className="relative rounded-xl overflow-hidden bg-black">
                <video src={form.videoUrl} className="w-full h-32 object-cover" muted playsInline />
                <div className="absolute bottom-2 right-2 flex gap-1.5">
                  <button onClick={() => videoRef.current?.click()} className="bg-primary/90 backdrop-blur-sm rounded-lg px-2.5 py-1 text-xs font-bold flex items-center gap-1">
                    <Upload className="w-3 h-3" /> Changer
                  </button>
                  <button onClick={() => { set("videoUrl", ""); if (videoRef.current) videoRef.current.value = ""; }} className="bg-red-500/80 backdrop-blur-sm rounded-lg p-1">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => videoRef.current?.click()} disabled={videoLoading}
                className="w-full h-20 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-95">
                {videoLoading ? (
                  <><span className="text-xs animate-pulse">Upload en cours…</span><span className="text-[10px] text-muted-foreground">Ne ferme pas cette fenêtre</span></>
                ) : (
                  <><Video className="w-5 h-5 opacity-60" /><span className="text-xs">Importer une vidéo (max 50 Mo)</span><span className="text-[10px] text-muted-foreground">MP4, WebM, MOV</span></>
                )}
              </button>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Description</label>
            <textarea
              value={form.description} onChange={e => set("description", e.target.value)}
              rows={3} placeholder="Description du produit..."
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-primary focus:outline-none resize-none"
            />
          </div>

          {/* Options de prix */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Options de prix *</label>
              <button onClick={addOption}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/20 text-primary text-xs font-bold hover:bg-primary/30 transition-all active:scale-95">
                <Plus className="w-3 h-3" /> Ajouter
              </button>
            </div>
            {priceOptions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3 border border-dashed border-white/10 rounded-xl">
                Aucune option — clique sur Ajouter
              </p>
            )}
            <div className="space-y-2">
              {priceOptions.map((opt, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={opt.weight} onChange={e => setOption(i, "weight", e.target.value)}
                    placeholder="ex: 1g, 3g, 5g"
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                  <div className="flex items-center bg-black/40 border border-white/10 rounded-xl overflow-hidden focus-within:border-primary">
                    <input
                      value={opt.price} onChange={e => setOption(i, "price", e.target.value)}
                      type="number" placeholder="10"
                      className="w-16 bg-transparent px-3 py-2 text-sm focus:outline-none"
                    />
                    <span className="pr-3 text-sm text-muted-foreground font-bold">€</span>
                  </div>
                  <button onClick={() => removeOption(i)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Stock */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Stock</label>
            <input
              value={form.stock} onChange={e => set("stock", e.target.value)}
              placeholder="disponible / épuisé"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
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
          disabled={imageLoading || videoLoading}
          className="w-full mt-5 py-3.5 rounded-[1.5rem] font-bold text-white active:scale-95 transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, hsl(270,90%,55%), hsl(200,90%,55%))" }}
        >
          {imageLoading || videoLoading ? "Traitement…" : product ? "Enregistrer les modifications" : "Ajouter le produit"}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Bot Start Tab ────────────────────────────────────────────────────────────

const BOT_URL = `https://boutique-2-production.up.railway.app`;

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={e => { e.preventDefault(); e.stopPropagation(); onChange(!value); }}
      className={`w-10 h-6 rounded-full transition-all shrink-0 relative ${value ? "bg-primary" : "bg-white/15"}`}
    >
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${value ? "left-5" : "left-1"}`} />
    </button>
  );
}

function BotStartTab() {
  const [buttons, setButtons] = useState<any[]>([]);
  const [startMessage, setStartMessage] = useState("");
  const [currentMediaType, setCurrentMediaType] = useState(""); // "photo" | "video" | ""
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState(BOT_URL);
  const [emoji, setEmoji] = useState("🛒");
  const [fullWidth, setFullWidth] = useState(true);
  const [loading, setLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [editId, setEditId] = useState<number | null>(null);

  const fetchAll = () => {
    fetch(`${API}/admin/client-buttons`).then(r => r.json()).then(setButtons).catch(() => {});
    fetch(`${API}/admin/bot-settings`).then(r => r.json()).then((s: any) => {
      setStartMessage(s.start_message || "");
      setCurrentMediaType(s.start_photo_url ? (s.start_media_type || "photo") : "");
    }).catch(() => {});
  };

  useEffect(() => { fetchAll(); }, []);

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const handleUploadMedia = async () => {
    if (!mediaFile) return;
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", mediaFile);
      const res = await fetch(`${API}/admin/upload-start-media`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.ok) {
        setMediaFile(null);
        setMediaPreview("");
        fetchAll();
        alert(`✅ ${data.type === "video" ? "Vidéo" : "Photo"} configurée avec succès !`);
      } else {
        alert("❌ Erreur : " + (data.error || "Upload échoué"));
      }
    } catch {
      alert("❌ Erreur réseau lors de l'upload");
    } finally { setUploadLoading(false); }
  };

  const handleRemoveMedia = async () => {
    if (!confirm("Supprimer la photo/vidéo du /start ?")) return;
    await fetch(`${API}/admin/start-media`, { method: "DELETE" });
    setCurrentMediaType("");
    fetchAll();
  };

  const handleSaveMessage = async () => {
    setMsgLoading(true);
    try {
      await fetch(`${API}/admin/bot-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "start_message", value: startMessage.trim() }),
      });
      alert("Message sauvegardé ✅");
    } finally { setMsgLoading(false); }
  };

  const handleAdd = async () => {
    if (!label.trim() || !url.trim()) return;
    setLoading(true);
    setAddError("");
    try {
      const method = editId !== null ? "PATCH" : "POST";
      const endpoint = editId !== null
        ? `${API}/admin/client-buttons/${editId}`
        : `${API}/admin/client-buttons`;
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), url: url.trim(), emoji: emoji.trim() || null, fullWidth }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAddError(err.error || `Erreur ${res.status}`);
        return;
      }
      setEditId(null);
      setLabel(""); setUrl(BOT_URL); setEmoji("🛒"); setFullWidth(true);
      fetchAll();
    } catch {
      setAddError("Erreur réseau");
    } finally { setLoading(false); }
  };

  const handleToggleActive = async (btn: any) => {
    await fetch(`${API}/admin/client-buttons/${btn.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !btn.active }),
    });
    fetchAll();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce bouton ?")) return;
    await fetch(`${API}/admin/client-buttons/${id}`, { method: "DELETE" });
    fetchAll();
  };

  const startEdit = (btn: any) => {
    setEditId(btn.id); setLabel(btn.label); setUrl(btn.url);
    setEmoji(btn.emoji || ""); setFullWidth(btn.fullWidth !== false);
    setAddError("");
  };

  const cancelEdit = () => {
    setEditId(null); setLabel(""); setUrl(BOT_URL); setEmoji("🛒"); setFullWidth(true); setAddError("");
  };

  return (
    <div className="space-y-4 pb-8">

      {/* ── Média /start ── */}
      <div className="glass-panel p-5 rounded-[1.5rem]">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <span>🖼️</span> Photo / Vidéo d'accueil
        </h2>

        {/* Statut actuel */}
        {currentMediaType && !mediaFile && (
          <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 mb-3">
            <div className="flex items-center gap-2">
              <span>{currentMediaType === "video" ? "🎥" : "📸"}</span>
              <p className="text-sm font-bold text-green-400">
                {currentMediaType === "video" ? "Vidéo configurée" : "Photo configurée"}
              </p>
            </div>
            <button type="button" onClick={handleRemoveMedia} className="text-xs text-red-400 hover:text-red-300 active:scale-90 transition-all">
              Supprimer
            </button>
          </div>
        )}

        {/* Sélecteur de fichier */}
        <label className="block cursor-pointer">
          <div className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${mediaFile ? "border-primary/50 bg-primary/5" : "border-white/10 hover:border-white/30"}`}>
            {mediaPreview ? (
              mediaFile?.type.startsWith("video/")
                ? <video src={mediaPreview} className="max-h-40 mx-auto rounded-lg" controls />
                : <img src={mediaPreview} className="max-h-40 mx-auto rounded-lg object-contain" alt="preview" />
            ) : (
              <>
                <p className="text-2xl mb-1">📁</p>
                <p className="text-sm font-bold">{currentMediaType ? "Changer le média" : "Ajouter une photo ou vidéo"}</p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG, MP4 — max 50 Mo</p>
              </>
            )}
          </div>
          <input type="file" accept="image/*,video/*" onChange={handleMediaSelect} className="hidden" />
        </label>

        {mediaFile && (
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={() => { setMediaFile(null); setMediaPreview(""); }}
              className="flex-1 py-3 rounded-xl bg-white/5 font-bold text-sm active:scale-95 transition-all">
              Annuler
            </button>
            <button type="button" onClick={handleUploadMedia} disabled={uploadLoading}
              className="flex-1 py-3 rounded-xl font-bold text-white text-sm disabled:opacity-50 active:scale-95 transition-all"
              style={{ background: "linear-gradient(135deg, hsl(270,90%,55%), hsl(200,90%,55%))" }}>
              {uploadLoading ? "Upload…" : "⬆️ Envoyer"}
            </button>
          </div>
        )}
      </div>

      {/* ── Message /start ── */}
      <div className="glass-panel p-5 rounded-[1.5rem]">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <span>💬</span> Message d'accueil
        </h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Texte affiché sous la photo <span className="text-primary/70">({"{username}"} = prénom, {"{id}"} = ID Telegram)</span>
            </label>
            <textarea
              value={startMessage}
              onChange={e => setStartMessage(e.target.value)}
              rows={5}
              placeholder={`🎉 Salut {username} !\n\nBienvenue sur 🔌 SOS LE PLUG\n\n🌐 Passez commande en quelques clics !`}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all resize-none"
            />
          </div>
          <button type="button"
            onClick={handleSaveMessage}
            disabled={msgLoading}
            className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-50 active:scale-95 transition-all"
            style={{ background: "linear-gradient(135deg, hsl(270,90%,55%), hsl(200,90%,55%))" }}
          >
            {msgLoading ? "Sauvegarde…" : "💾 Enregistrer le message"}
          </button>
        </div>
      </div>

      {/* ── Formulaire bouton ── */}
      <div className="glass-panel p-5 rounded-[1.5rem]">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
          {editId ? "✏️ Modifier le bouton" : "➕ Ajouter un bouton"}
        </h2>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="🛒"
              className="w-14 bg-black/40 border border-white/10 rounded-xl px-2 py-3 text-center text-lg focus:outline-none focus:border-primary transition-all" />
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Texte du bouton"
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all" />
          </div>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="URL"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all font-mono" />

          {/* Largeur */}
          <div className="flex items-center justify-between bg-black/20 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-bold">Pleine largeur</p>
              <p className="text-xs text-muted-foreground">Désactivé → 2 boutons côte à côte</p>
            </div>
            <Toggle value={fullWidth} onChange={setFullWidth} />
          </div>

          {/* Aperçu */}
          <div className="bg-black/30 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Aperçu disposition</p>
            {fullWidth
              ? <div className="bg-[#54a0d5]/20 border border-[#54a0d5]/30 rounded-lg py-2 text-center text-xs font-bold text-[#54a0d5]">{emoji} {label || "Mon bouton"}</div>
              : <div className="grid grid-cols-2 gap-1.5">
                  <div className="bg-[#54a0d5]/20 border border-[#54a0d5]/30 rounded-lg py-2 text-center text-xs font-bold text-[#54a0d5]">{emoji} {label || "Bouton"}</div>
                  <div className="bg-white/5 border border-white/10 rounded-lg py-2 text-center text-xs text-muted-foreground">autre bouton</div>
                </div>
            }
          </div>

          {addError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 text-xs text-red-400">
              ❌ {addError}
            </div>
          )}

          <div className="flex gap-2">
            {editId && (
              <button type="button" onClick={cancelEdit}
                className="flex-1 py-3 rounded-xl bg-white/5 font-bold text-sm active:scale-95 transition-all">
                Annuler
              </button>
            )}
            <button
              type="button"
              onClick={handleAdd}
              disabled={!label.trim() || !url.trim() || loading}
              className="flex-1 py-3 rounded-xl font-bold text-white text-sm disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, hsl(270,90%,55%), hsl(200,90%,55%))" }}
            >
              {loading ? "Sauvegarde…" : editId ? "Enregistrer" : <><Plus className="w-4 h-4" /> Ajouter</>}
            </button>
          </div>
        </div>
      </div>

      {/* ── Liste boutons ── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 pl-1">
          Boutons ({buttons.filter(b => b.active).length} actifs / {buttons.length} total)
        </h2>
        {buttons.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Aucun bouton configuré</p>
            <p className="text-xs mt-1">Bouton par défaut : "Accéder à la Boutique"</p>
          </div>
        )}
        {buttons.map(btn => (
          <div key={btn.id} className={`glass-panel px-4 py-3 rounded-[1.5rem] mb-2 ${!btn.active ? "opacity-40" : ""}`}>
            <div className="flex items-center gap-3">
              <span className="text-xl w-8 text-center shrink-0">{btn.emoji || "🔘"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm">{btn.label}</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${btn.fullWidth !== false ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"}`}>
                    {btn.fullWidth !== false ? "↔ Large" : "½ Demi"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate">{btn.url}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Toggle value={btn.active} onChange={() => handleToggleActive(btn)} />
                <button type="button" onClick={() => startEdit(btn)} className="p-2 text-muted-foreground hover:text-white active:scale-90">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => handleDelete(btn.id)} className="p-2 text-destructive/70 hover:text-destructive active:scale-90">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Notifs Tab ───────────────────────────────────────────────────────────────

function NotifsTab() {
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsOk, setStatsOk] = useState(false);
  const [statsDate, setStatsDate] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string; error?: string } | null>(null);

  const [broadcastText, setBroadcastText] = useState("");
  const [onlyUnlocked, setOnlyUnlocked] = useState(true);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  const BROADCAST_TEMPLATES = [
    "🔥 Nouveaux produits dispo ! Venez jeter un œil 👀",
    "🎁 Offre spéciale ce week-end, profitez-en !",
    "⚡ Stock limité sur certains articles, dépêchez-vous !",
    "📢 La boutique est ouverte ! Bonne commande à tous 🛒",
    "🌿 Nouvelle gamme arrivée, découvrez-la maintenant !",
  ];

  const sendTestNotification = async () => {
    setTestLoading(true); setTestResult(null);
    try {
      const r = await fetch(`${API}/admin/test-notification`, { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = await r.json();
      setTestResult(data);
      setTimeout(() => setTestResult(null), 6000);
    } catch (e: any) {
      setTestResult({ ok: false, error: e.message });
    } finally { setTestLoading(false); }
  };

  const sendStatsReport = async () => {
    setStatsLoading(true); setStatsOk(false);
    try {
      const body = statsDate ? JSON.stringify({ date: statsDate }) : "{}";
      await fetch(`${API}/admin/notify-stats`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body,
      });
      setStatsOk(true);
      setTimeout(() => setStatsOk(false), 4000);
    } finally { setStatsLoading(false); }
  };

  const sendBroadcast = async () => {
    if (!broadcastText.trim()) return;
    setBroadcasting(true); setBroadcastResult(null);
    try {
      const r = await fetch(`${API}/admin/broadcast`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: broadcastText, onlyUnlocked }),
      });
      const data = await r.json();
      setBroadcastResult(data);
      setBroadcastText("");
    } finally { setBroadcasting(false); }
  };

  return (
    <div className="space-y-5">

      {/* ── Automatique ── */}
      <div className="glass-panel rounded-[1.5rem] p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Radio className="w-4 h-4 text-primary" />
          <p className="font-black text-sm">Notifications automatiques</p>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
            <BellRing className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-emerald-400">🛒 Nouvelle commande</p>
              <p className="text-muted-foreground mt-0.5">Envoyé immédiatement à chaque nouvelle commande avec le détail complet.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2.5">
            <BellRing className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-blue-400">📋 Changement de statut</p>
              <p className="text-muted-foreground mt-0.5">Notification à chaque mise à jour de statut d'une commande.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2.5">
            <Calendar className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-purple-400">📊 Rapport quotidien</p>
              <p className="text-muted-foreground mt-0.5">Envoyé chaque jour à <b>20h00</b> avec commandes, CA et nouveaux clients.</p>
            </div>
          </div>
        </div>

        {/* ── Bouton test ── */}
        <button
          onClick={sendTestNotification}
          disabled={testLoading}
          className="w-full py-2.5 rounded-xl text-xs font-bold border border-amber-500/40 bg-amber-500/10 text-amber-400 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {testLoading
            ? <><div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /> Test en cours…</>
            : <><Bell className="w-3.5 h-3.5" /> Tester les notifications Telegram</>}
        </button>
        {testResult && (
          <div className={`rounded-xl px-3 py-2.5 text-xs font-medium flex items-center gap-2 ${testResult.ok ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400" : "bg-red-500/15 border border-red-500/30 text-red-400"}`}>
            {testResult.ok ? "✅ " + testResult.message : "❌ " + testResult.error}
          </div>
        )}
      </div>

      {/* ── Rapport manuel ── */}
      <div className="glass-panel rounded-[1.5rem] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <p className="font-black text-sm">Rapport stats manuel</p>
        </div>
        <p className="text-xs text-muted-foreground">Envoie immédiatement le rapport stats à votre Telegram admin.</p>
        <div className="flex gap-2 items-center">
          <input type="date" value={statsDate} onChange={e => setStatsDate(e.target.value)}
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary transition-all"
            placeholder="Date (facultatif)" />
          <button onClick={() => setStatsDate("")} className="text-xs text-muted-foreground hover:text-foreground px-2">Auj.</button>
        </div>
        <button onClick={sendStatsReport} disabled={statsLoading}
          className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, hsl(270,80%,55%), hsl(300,80%,55%))" }}>
          {statsLoading
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Envoi…</>
            : statsOk
              ? <><Check className="w-4 h-4 text-emerald-300" /> Rapport envoyé !</>
              : <><Send className="w-4 h-4" /> Envoyer le rapport</>}
        </button>
      </div>

      {/* ── Broadcast ── */}
      <div className="glass-panel rounded-[1.5rem] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" />
          <p className="font-black text-sm">Message broadcast</p>
        </div>

        {broadcastResult && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5 text-xs">
            <p className="font-bold text-emerald-400 mb-0.5">✅ Broadcast terminé</p>
            <p className="text-muted-foreground">✉️ Envoyé : <b className="text-foreground">{broadcastResult.sent}</b> · ❌ Échec : <b className="text-foreground">{broadcastResult.failed}</b> / {broadcastResult.total} clients</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-1.5">
          {BROADCAST_TEMPLATES.map((tpl, i) => (
            <button key={i} onClick={() => setBroadcastText(tpl)}
              className="text-xs px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[.99] transition-all border border-white/10 text-left">
              {tpl}
            </button>
          ))}
        </div>

        <textarea value={broadcastText} onChange={e => setBroadcastText(e.target.value)} rows={3}
          placeholder="Message personnalisé (HTML autorisé : <b>, <i>, <a>)…"
          className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary transition-all resize-none" />

        <label className="flex items-center gap-2 cursor-pointer">
          <div onClick={() => setOnlyUnlocked(v => !v)}
            className={`w-10 h-5 rounded-full transition-all relative ${onlyUnlocked ? "bg-primary" : "bg-white/10"}`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${onlyUnlocked ? "left-5" : "left-0.5"}`} />
          </div>
          <span className="text-xs">{onlyUnlocked ? "🔓 Clients débloqués uniquement" : "👥 Tous les clients"}</span>
        </label>

        <button onClick={sendBroadcast} disabled={!broadcastText.trim() || broadcasting}
          className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, hsl(210,90%,55%), hsl(240,90%,55%))" }}>
          {broadcasting
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Envoi en cours…</>
            : <><Megaphone className="w-4 h-4" /> Envoyer à tous</>}
        </button>
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactMsg, setContactMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState<string | null>(null);
  const [ordersFor, setOrdersFor] = useState<string | null>(null);
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const fetchUsers = async (q = search) => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/bot-users?search=${encodeURIComponent(q)}&limit=50`);
      const data = await r.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } finally { setLoading(false); }
  };

  const fetchUserOrders = async (chatId: string) => {
    if (ordersFor === chatId) { setOrdersFor(null); return; }
    setOrdersFor(chatId);
    setOrdersLoading(true);
    try {
      const r = await fetch(`${API}/admin/user-orders/${chatId}`);
      setUserOrders(await r.json());
    } finally { setOrdersLoading(false); }
  };

  const sendMsg = async () => {
    if (!contactId || !contactMsg.trim()) return;
    setSending(true);
    try {
      const r = await fetch(`${API}/admin/send-telegram`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: contactId, text: contactMsg }),
      });
      if (r.ok) { setSentOk(contactId); setContactMsg(""); setContactId(null); setTimeout(() => setSentOk(null), 3000); }
    } finally { setSending(false); }
  };

  useEffect(() => { fetchUsers(""); }, []);

  const MSG_TEMPLATES = [
    "👋 Bonjour ! Une question ?",
    "✅ Votre commande est prête !",
    "🎁 Offre spéciale pour vous !",
    "📢 Nouveau produit disponible !",
  ];

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && fetchUsers(search)}
          placeholder="Rechercher par nom, @username, ID…"
          className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-primary transition-all"
        />
        <button onClick={() => fetchUsers(search)} className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-primary font-bold">
          OK
        </button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{total} client{total !== 1 ? "s" : ""} au total</p>
        <button onClick={() => fetchUsers(search)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {!users.length && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucun client trouvé</p>
        </div>
      )}

      {users.map(u => {
        const initials = (u.firstName || u.username || u.chatId)[0].toUpperCase();
        const isContactOpen = contactId === u.chatId;
        const isOrdersOpen = ordersFor === u.chatId;
        return (
          <div key={u.id} className="glass-panel rounded-[1.5rem] overflow-hidden">
            <div className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-black text-primary shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{u.firstName || "—"} {u.username ? <span className="text-muted-foreground font-normal">@{u.username}</span> : ""}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{u.chatId}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {sentOk === u.chatId
                  ? <span className="text-[10px] text-emerald-400 font-bold">✓ Envoyé</span>
                  : <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${u.isUnlocked ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                      {u.isUnlocked ? "🔓" : "🔒"}
                    </span>
                }
              </div>
            </div>

            {/* User actions */}
            <div className="border-t border-white/5 px-3 py-2 flex gap-1.5">
              <button onClick={() => { setContactId(isContactOpen ? null : u.chatId); setContactMsg(""); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all ${isContactOpen ? "bg-blue-500/20 text-blue-400" : "bg-white/5 hover:bg-white/10"}`}>
                <MessageSquare className="w-3.5 h-3.5" /> Message
              </button>
              <button onClick={() => fetchUserOrders(u.chatId)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all ${isOrdersOpen ? "bg-primary/20 text-primary" : "bg-white/5 hover:bg-white/10"}`}>
                <ShoppingBag className="w-3.5 h-3.5" /> Commandes
              </button>
            </div>

            {/* Contact panel */}
            <AnimatePresence>
              {isContactOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-white/5">
                  <div className="p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-1.5">
                      {MSG_TEMPLATES.map((tpl, i) => (
                        <button key={i} onClick={() => setContactMsg(tpl)}
                          className="text-[10px] px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 transition-all border border-white/10 text-left leading-tight">
                          {tpl}
                        </button>
                      ))}
                    </div>
                    <textarea value={contactMsg} onChange={e => setContactMsg(e.target.value)} rows={2}
                      placeholder="Message personnalisé…"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary transition-all resize-none" />
                    <button onClick={sendMsg} disabled={!contactMsg.trim() || sending}
                      className="w-full py-2.5 rounded-xl font-bold text-white text-xs disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                      style={{ background: "linear-gradient(135deg, hsl(210,90%,55%), hsl(240,90%,55%))" }}>
                      <Send className="w-3.5 h-3.5" /> {sending ? "Envoi…" : "Envoyer via Telegram"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Orders panel */}
            <AnimatePresence>
              {isOrdersOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-white/5">
                  <div className="p-3 space-y-2">
                    {ordersLoading && <p className="text-xs text-center text-muted-foreground py-2">Chargement…</p>}
                    {!ordersLoading && !userOrders.length && <p className="text-xs text-center text-muted-foreground py-2">Aucune commande</p>}
                    {userOrders.map(o => {
                      const parsed = (() => { try { return JSON.parse(o.orderData); } catch { return {}; } })();
                      const total = parsed.items?.reduce((s: number, i: any) => s + (i.selectedPrice || i.product?.price || 0) * i.quantity, 0) ?? 0;
                      return (
                        <div key={o.id} className="flex items-center justify-between bg-black/20 rounded-xl px-3 py-2">
                          <div>
                            <p className="text-xs font-bold">#{o.orderCode}</p>
                            <p className="text-[10px] text-muted-foreground">{(total / 100).toFixed(2)}€ · {parsed.items?.length ?? 0} art.</p>
                          </div>
                          <StatusBadge status={o.status} />
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ─── Admins Tab ───────────────────────────────────────────────────────────────

function LivreursTab({ livreursList: _ignored, onRefresh: _onRefresh }: { livreursList: any[]; onRefresh: () => void }) {
  const [list, setList] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [chatId, setChatId] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  const fetchList = async () => {
    try {
      setFetching(true);
      const r = await fetch(`${API}/admin/livreurs`);
      if (r.ok) setList(await r.json());
    } finally { setFetching(false); }
  };

  useEffect(() => { fetchList(); }, []);

  const handleAdd = async () => {
    const n = name.trim();
    const cid = chatId.trim();
    if (!n || !cid) {
      setErr(!n ? "Le nom est obligatoire." : "Le Chat ID est obligatoire.");
      return;
    }
    setLoading(true); setErr(""); setSuccess("");
    try {
      const r = await fetch(`${API}/admin/livreurs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, username: username.trim().replace(/^@/, "") || null, chatId: cid }),
      });
      if (r.status === 409) { setErr("Ce livreur existe déjà (Chat ID déjà enregistré)."); return; }
      if (!r.ok) { const d = await r.json(); setErr(d.error || "Erreur serveur"); return; }
      setName(""); setUsername(""); setChatId("");
      setSuccess("Livreur ajouté ✓");
      setTimeout(() => setSuccess(""), 3000);
      await fetchList();
    } catch (e: any) {
      setErr("Erreur réseau — " + e.message);
    } finally { setLoading(false); }
  };

  const handleToggle = async (id: number) => {
    await fetch(`${API}/admin/livreurs/${id}/toggle`, { method: "PATCH" });
    await fetchList();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce livreur ?")) return;
    await fetch(`${API}/admin/livreurs/${id}`, { method: "DELETE" });
    await fetchList();
  };

  const inputCls = "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all placeholder:text-white/30";

  return (
    <div className="space-y-4">
      {/* Formulaire ajout */}
      <div className="glass-panel p-5 rounded-[1.5rem]">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <Truck className="w-4 h-4" style={{ color: "#f0d070" }} /> Ajouter un livreur
        </h2>
        <div className="space-y-2.5">
          <input value={name} onChange={e => { setName(e.target.value); setErr(""); }}
            placeholder="Nom du livreur *" className={inputCls} />
          <input value={username} onChange={e => setUsername(e.target.value)}
            placeholder="@username Telegram (optionnel)" className={inputCls} />
          <input value={chatId} onChange={e => { setChatId(e.target.value); setErr(""); }}
            placeholder="Chat ID Telegram * (ex : 5818221358)"
            inputMode="numeric"
            className={inputCls} />

          {err && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <p className="text-xs text-red-400 font-bold">{err}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-400 font-bold">{success}</p>
            </div>
          )}

          <button
            onClick={handleAdd}
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, rgba(201,160,76,0.35), rgba(240,208,112,0.2))", border: "1px solid rgba(201,160,76,0.5)", color: "#f0d070" }}>
            {loading ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Ajout en cours…</>
            ) : (
              <><Plus className="w-4 h-4" /> Ajouter le livreur</>
            )}
          </button>
        </div>
      </div>

      {/* Liste livreurs */}
      <div className="space-y-2">
        {fetching && (
          <div className="text-center py-8 text-muted-foreground">
            <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin opacity-40" />
          </div>
        )}
        {!fetching && list.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <Truck className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Aucun livreur configuré</p>
            <p className="text-xs mt-1 opacity-60">Remplis le formulaire ci-dessus</p>
          </div>
        )}
        {list.map(l => (
          <div key={l.id} className="glass-panel rounded-[1.25rem] p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg"
              style={{ background: l.isActive ? "rgba(201,160,76,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${l.isActive ? "rgba(201,160,76,0.3)" : "rgba(255,255,255,0.08)"}` }}>
              🛵
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate" style={{ color: l.isActive ? "#f0d070" : "rgba(255,255,255,0.35)" }}>
                {l.name}
              </p>
              {l.username && <p className="text-[10px] text-muted-foreground truncate">@{l.username}</p>}
              <p className="text-[10px] font-mono text-muted-foreground/50">ID : {l.chatId}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => handleToggle(l.id)}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold active:scale-95 transition-all"
                style={{ background: l.isActive ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${l.isActive ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.08)"}`, color: l.isActive ? "#10b981" : "rgba(255,255,255,0.35)" }}>
                {l.isActive ? "Actif" : "Inactif"}
              </button>
              <button onClick={() => handleDelete(l.id)}
                className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Aide */}
      <div className="glass-panel p-4 rounded-[1.25rem] text-xs text-muted-foreground space-y-1.5" style={{ border: "1px solid rgba(201,160,76,0.12)" }}>
        <p className="font-bold flex items-center gap-1.5" style={{ color: "#f0d070" }}>
          <AlertCircle className="w-3.5 h-3.5" /> Comment ça marche
        </p>
        <p>1. Ajoute ici les livreurs avec leur Chat ID Telegram (obtenu via @userinfobot).</p>
        <p>2. Le bot doit avoir déjà échangé avec le livreur (au moins un /start).</p>
        <p>3. Dans les commandes, ouvre "Détails" → sélectionne un livreur → "Transmettre".</p>
      </div>
    </div>
  );
}

function AdminsTab() {
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchAdmins = () => {
    fetch(`${API}/admin/admins`)
      .then(r => r.json())
      .then(setAdminsList)
      .catch(() => {});
  };

  useEffect(() => { fetchAdmins(); }, []);

  const handleAdd = async () => {
    if (!newId.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramId: newId.trim(), name: newName.trim() || null }),
      });
      if (res.status === 409) { alert("Cet admin existe déjà."); return; }
      if (!res.ok) { alert("Erreur lors de l'ajout."); return; }
      setNewId(""); setNewName(""); fetchAdmins();
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cet admin ?")) return;
    await fetch(`${API}/admin/admins/${id}`, { method: "DELETE" });
    fetchAdmins();
  };

  return (
    <div className="space-y-4">
      <div className="glass-panel p-5 rounded-[1.5rem]">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <UserCog className="w-4 h-4 text-primary" /> Ajouter un admin
        </h2>
        <div className="space-y-3">
          <input
            value={newId}
            onChange={e => setNewId(e.target.value)}
            placeholder="Chat ID Telegram (ex: 123456789)"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all"
            type="number"
          />
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nom (optionnel)"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all"
          />
          <button
            onClick={handleAdd}
            disabled={!newId.trim() || loading}
            className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, hsl(270,90%,55%), hsl(200,90%,55%))" }}
          >
            <Plus className="w-4 h-4" /> {loading ? "Ajout…" : "Ajouter comme admin"}
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3 pl-1 flex items-center gap-2">
          <Shield className="w-4 h-4" /> Admins actifs
        </h2>

        {/* Super admin toujours visible */}
        <div className="glass-panel px-5 py-4 rounded-[1.5rem] mb-2 flex items-center justify-between border border-primary/20">
          <div>
            <p className="font-bold text-sm">Super Admin</p>
            <p className="text-xs text-muted-foreground font-mono">5818221358</p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary/20 text-primary border border-primary/30">Principal</span>
        </div>

        {adminsList.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <UserCog className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Aucun admin supplémentaire</p>
          </div>
        )}
        {adminsList.map(admin => (
          <div key={admin.id} className="glass-panel px-5 py-4 rounded-[1.5rem] mb-2 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm">{admin.name || "Admin"}</p>
              <p className="text-xs text-muted-foreground font-mono">{admin.telegramId}</p>
            </div>
            <button onClick={() => handleDelete(admin.id)} className="p-2 text-destructive/70 hover:text-destructive active:scale-90 transition-all">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
