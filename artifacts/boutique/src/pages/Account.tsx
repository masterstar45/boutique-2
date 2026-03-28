import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useSession } from "@/hooks/use-session";
import { useGetMyOrders } from "@workspace/api-client-react";
import {
  User, Package, KeyRound, Save, Shield, Settings,
  ChevronRight, Clock, CheckCircle, XCircle, Truck,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { TopBar } from "@/components/TopBar";
import { motion, AnimatePresence } from "framer-motion";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
const GOLD = "rgba(201,160,76,";
const GOLD_GRAD = "linear-gradient(135deg, #c9a04c 0%, #f0d070 45%, #d4a843 100%)";

// ── Statut commande ────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; bg: string; Icon: typeof Clock }> = {
  pending:   { label: "En attente",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  Icon: Clock },
  confirmed: { label: "Confirmée",   color: "#10b981", bg: "rgba(16,185,129,0.12)",  Icon: CheckCircle },
  delivered: { label: "Livrée",      color: "#c9a04c", bg: "rgba(201,160,76,0.12)",  Icon: Truck },
  completed: { label: "Terminée",    color: "#10b981", bg: "rgba(16,185,129,0.12)",  Icon: CheckCircle },
  cancelled: { label: "Annulée",     color: "#ef4444", bg: "rgba(239,68,68,0.12)",   Icon: XCircle },
};

function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, color: "#ffffff80", bg: "rgba(255,255,255,0.08)", Icon: Clock };
}

// ── Tabs ───────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "orders",  label: "Commandes", Icon: Package },
  { id: "profile", label: "Profil",    Icon: User },
] as const;
type TabId = typeof TABS[number]["id"];

// ── Composant principal ────────────────────────────────────────────────────────
export default function Account() {
  const { chatId, username, saveChatId } = useSession();
  const [inputChatId, setInputChatId] = useState(chatId);
  const [isAdmin, setIsAdmin] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [tab, setTab] = useState<TabId>("orders");

  useEffect(() => {
    if (!chatId) { setIsAdmin(false); return; }
    fetch(`${API}/is-admin/${chatId}`)
      .then(r => r.json())
      .then(d => setIsAdmin(d.isAdmin === true))
      .catch(() => setIsAdmin(false));
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    setAvatarUrl(null); setAvatarError(false);
    fetch(`${API}/user-photo/${chatId}`, { method: "HEAD" })
      .then(r => { if (r.ok) setAvatarUrl(`${API}/user-photo/${chatId}`); })
      .catch(() => {});
  }, [chatId]);

  const { data: orders } = useGetMyOrders(chatId, { query: { enabled: !!chatId } });

  const handleSave = () => { if (inputChatId.trim()) saveChatId(inputChatId.trim()); };

  // ── Pas connecté ─────────────────────────────────────────────────────────────
  if (!chatId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 pb-nav">
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-8"
          style={{ background: "rgba(201,160,76,0.08)", border: "1px solid rgba(201,160,76,0.2)", boxShadow: "0 0 30px -8px rgba(201,160,76,0.3)" }}>
          <KeyRound className="w-10 h-10" style={{ color: `${GOLD}0.8)` }} />
        </div>
        <h1 className="text-3xl font-black font-display mb-2 text-center">Connexion</h1>
        <p className="text-muted-foreground text-center mb-8 text-sm max-w-xs">
          Entrez votre ID Telegram pour retrouver votre historique et vos points.
        </p>
        <div className="w-full max-w-sm space-y-4">
          <input
            type="text"
            value={inputChatId}
            onChange={(e) => setInputChatId(e.target.value)}
            placeholder="Votre Telegram Chat ID"
            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-center focus:outline-none focus:border-primary transition-all text-lg font-bold"
          />
          <button
            onClick={handleSave}
            disabled={!inputChatId.trim()}
            className="w-full font-black text-lg py-4 rounded-2xl disabled:opacity-50 active:scale-95 transition-transform flex items-center justify-center gap-2"
            style={{ background: GOLD_GRAD, color: "#080603" }}
          >
            <Save className="w-5 h-5" /> Connecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-nav">
      <TopBar title="Mon Compte" backHref="/menu" />

      <main className="px-4 pt-4 space-y-4">

        {/* ── Carte profil ── */}
        <div className="relative overflow-hidden rounded-[2rem] p-5"
          style={{ background: "rgba(12,9,5,0.9)", border: `1px solid ${GOLD}0.12)` }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 70% 60% at 90% -10%, rgba(201,160,76,0.07) 0%, transparent 70%)" }} />

          <div className="flex items-center gap-4 relative">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center"
                style={{ border: `2px solid ${GOLD}0.3)`, boxShadow: `0 0 20px -4px ${GOLD}0.25)`, background: `${GOLD}0.08)` }}>
                {avatarUrl && !avatarError ? (
                  <img src={avatarUrl} alt="Photo" className="w-full h-full object-cover" onError={() => setAvatarError(true)} />
                ) : username ? (
                  <span className="font-display font-black text-2xl" style={{ color: `${GOLD}0.9)` }}>
                    {username[0]?.toUpperCase()}
                  </span>
                ) : (
                  <User className="w-8 h-8" style={{ color: `${GOLD}0.7)` }} />
                )}
              </div>
              {avatarUrl && !avatarError && (
                <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[#2aabee] border-2 border-[#080603] flex items-center justify-center"
                  style={{ width: 18, height: 18 }}>
                  <svg viewBox="0 0 24 24" fill="white" style={{ width: 10, height: 10 }}>
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Infos */}
            <div className="min-w-0 flex-1">
              {username && (
                <p className="font-display font-black text-xl truncate" style={{ color: `${GOLD}0.95)` }}>
                  @{username}
                </p>
              )}
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mt-0.5">
                {username ? "Telegram ID" : "Identifiant"}
              </p>
              <p className="font-mono text-sm text-white/60 truncate">{chatId}</p>
            </div>

          </div>
        </div>

        {/* ── Bouton Admin ── */}
        {isAdmin && (
          <Link href="/admin">
            <div className="relative overflow-hidden rounded-[1.5rem] p-[1px] cursor-pointer group">
              <div className="absolute inset-0 rounded-[1.5rem]" style={{ background: "linear-gradient(135deg, #a855f7, #06b6d4)" }} />
              <div className="relative rounded-[calc(1.5rem-1px)] px-5 py-4 flex items-center justify-between"
                style={{ background: "rgba(8,6,3,0.85)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #a855f7, #06b6d4)" }}>
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-black text-sm text-white">Panel Admin</p>
                    <p className="text-[10px] text-purple-400 font-medium">Gérer la boutique</p>
                  </div>
                </div>
                <Settings className="w-4 h-4 text-white/40 group-hover:rotate-45 transition-all duration-300" />
              </div>
            </div>
          </Link>
        )}

        {/* ── Onglets ── */}
        <div className="flex gap-2 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                style={active ? {
                  background: GOLD_GRAD,
                  color: "#080603",
                  boxShadow: "0 2px 12px -4px rgba(201,160,76,0.5)",
                } : {
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Contenu par onglet ── */}
        <AnimatePresence mode="wait">
          {tab === "orders" && <OrdersTab key="orders" orders={orders} />}
          {tab === "profile" && <ProfileTab key="profile" chatId={chatId} username={username} />}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ── Onglet Commandes ───────────────────────────────────────────────────────────
function OrdersTab({ orders }: { orders: any[] | undefined }) {
  if (!orders?.length) {
    return (
      <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="rounded-[1.5rem] p-10 text-center"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <Package className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(201,160,76,0.3)" }} />
        <p className="font-bold text-white/40 text-sm">Aucune commande pour le moment</p>
        <p className="text-white/25 text-xs mt-1">Passe ta première commande !</p>
      </motion.div>
    );
  }

  return (
    <motion.div key="orders" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="space-y-3">
      {orders.map(order => <OrderCard key={order.id} order={order} />)}
    </motion.div>
  );
}

function OrderCard({ order }: { order: any }) {
  const [open, setOpen] = useState(false);
  const sm = statusMeta(order.status);
  const StatusIcon = sm.Icon;

  let items: any[] = [];
  let total = 0;
  try {
    const parsed = typeof order.orderData === "string" ? JSON.parse(order.orderData) : order.orderData;
    items = parsed?.items ?? [];
    // selectedPrice is in euros; product.price is in centimes
    total = items.reduce((s: number, it: any) => {
      const price = it.selectedPrice != null ? it.selectedPrice : (it.product?.price || 0) / 100;
      return s + price * (it.quantity || 1);
    }, 0);
  } catch { }

  const dateStr = order.createdAt
    ? format(new Date(order.createdAt), "d MMM yyyy · HH:mm", { locale: fr })
    : "Date inconnue";

  const delivLabel = order.deliveryType === "delivery" ? "🚚 Livraison" : "🏪 Click & Collect";

  return (
    <div className="rounded-[1.5rem] overflow-hidden transition-all"
      style={{ background: "rgba(12,9,5,0.85)", border: "1px solid rgba(255,255,255,0.07)" }}>

      {/* En-tête carte */}
      <button
        className="w-full text-left px-4 py-4 flex items-center gap-3 active:bg-white/[0.02] transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        {/* Icône statut */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: sm.bg }}>
          <StatusIcon className="w-5 h-5" style={{ color: sm.color }} />
        </div>

        {/* Infos principales */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-black font-display text-sm tracking-wide">
              #{order.orderCode?.slice(-8) ?? order.orderCode}
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: sm.bg, color: sm.color }}>
              {sm.label}
            </span>
          </div>
          <p className="text-[10px] text-white/35 font-medium">{dateStr} · {delivLabel}</p>
        </div>

        {/* Total + chevron */}
        <div className="shrink-0 flex items-center gap-2">
          {total > 0 && (
            <span className="font-black text-sm" style={{ color: "rgba(201,160,76,0.9)" }}>
              {total.toFixed(0)}€
            </span>
          )}
          <ChevronRight
            className="w-4 h-4 text-white/20 transition-transform duration-200"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          />
        </div>
      </button>

      {/* Détail articles (dépliable) */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-1.5"
              style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 pt-3 pb-1">Articles</p>
              {items.length > 0 ? items.map((it: any, i: number) => {
                const name = it.product?.name ?? "Produit";
                const weight = it.selectedWeight ?? null;
                const price = it.selectedPrice != null ? it.selectedPrice : (it.product?.price || 0) / 100;
                return (
                  <div key={i} className="flex justify-between items-center text-xs">
                    <span className="text-white/60 font-medium">
                      {it.quantity}× {name}{weight ? ` (${weight})` : ""}
                    </span>
                    <span className="font-bold text-white/50">{(price * it.quantity).toFixed(0)}€</span>
                  </div>
                );
              }) : (
                <p className="text-xs text-white/25 italic">Détail indisponible</p>
              )}
              {total > 0 && (
                <div className="flex justify-between items-center text-xs pt-2"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="font-bold text-white/40 uppercase tracking-wider text-[10px]">Total</span>
                  <span className="font-black text-sm" style={{ background: "linear-gradient(135deg, #c9a04c, #f0d070)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    {total.toFixed(0)} €
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Onglet Profil ──────────────────────────────────────────────────────────────
function ProfileTab({ chatId, username }: { chatId: string; username: string }) {
  return (
    <motion.div key="profile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="space-y-3">

      {/* Infos actuelles */}
      <div className="rounded-[1.5rem] p-5 space-y-3"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Informations</p>
        {username && (
          <div className="flex justify-between items-center py-2"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-xs text-white/40 font-medium">Username Telegram</span>
            <span className="text-xs font-bold" style={{ color: "rgba(201,160,76,0.8)" }}>@{username}</span>
          </div>
        )}
        <div className="flex justify-between items-center py-2">
          <span className="text-xs text-white/40 font-medium">Chat ID</span>
          <span className="font-mono text-xs text-white/60">{chatId}</span>
        </div>
      </div>
    </motion.div>
  );
}
