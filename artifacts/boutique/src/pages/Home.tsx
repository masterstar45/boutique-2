import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Zap, Lock } from "lucide-react";
import { useListProducts } from "@workspace/api-client-react";

const GOLD = "rgba(201,160,76,";
const GOLD_GRAD = "linear-gradient(135deg, #c9a04c 0%, #f0d070 45%, #d4a843 100%)";

export default function Home() {
  const { data: products } = useListProducts();
  const productCount = products?.length || 0;

  const features = [
    { icon: ShieldCheck, label: "Qualité\nPremium", color: `${GOLD}0.9)` },
    { icon: Zap,         label: "Livraison\nÉclair", color: `${GOLD}0.9)` },
    { icon: Lock,        label: "Discret &\nSécurisé", color: `${GOLD}0.9)` },
  ];

  return (
    <div className="relative min-h-screen flex flex-col text-white overflow-hidden pb-28">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center z-10 pt-12 gap-10">

        {/* ── Monogram logo ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex flex-col items-center gap-5"
        >
          {/* Ambient glow behind logo */}
          <div className="absolute rounded-full blur-3xl -z-10"
            style={{
              width: "200px", height: "200px",
              background: "radial-gradient(circle, rgba(201,160,76,0.15) 0%, transparent 70%)",
              animation: "pulse-gold 4s ease-in-out infinite",
            }} />

          {/* Title */}
          <div>
            <h1 className="font-display font-semibold tracking-[0.1em] uppercase gradient-gold glow-gold"
              style={{ fontSize: "clamp(1.75rem, 7vw, 2.4rem)" }}>
              SOS LE PLUG
            </h1>
            <div className="gold-line mt-3 mx-12" />
            <p className="text-[9px] tracking-[0.35em] uppercase mt-3"
              style={{ color: "rgba(201,160,76,0.55)" }}>
              Premium Selection
            </p>
          </div>
        </motion.div>

        {/* ── Feature grid ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-3 gap-3 w-full max-w-sm"
        >
          {features.map(({ icon: Icon, label, color }) => (
            <div key={label} className="flex flex-col items-center gap-2.5 py-4 px-2 rounded-2xl"
              style={{
                background: "rgba(201,160,76,0.04)",
                border: "1px solid rgba(201,160,76,0.1)",
              }}>
              <Icon className="w-5 h-5" style={{ color }} />
              <span className="text-[9.5px] font-medium leading-tight text-center uppercase tracking-wider whitespace-pre-line"
                style={{ color: "rgba(201,160,76,0.65)" }}>
                {label}
              </span>
            </div>
          ))}
        </motion.div>

        {/* ── Product count pill ── */}
        {productCount > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.2 }}
            className="flex items-center gap-3 px-6 py-3 rounded-full"
            style={{
              background: "rgba(201,160,76,0.06)",
              border: "1px solid rgba(201,160,76,0.18)",
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "rgba(201,160,76,0.8)" }} />
            <span className="font-display text-xl font-medium gradient-gold">{productCount}</span>
            <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "rgba(201,160,76,0.6)" }}>
              Produits disponibles
            </span>
          </motion.div>
        )}

        {/* ── CTA Buttons ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-3 w-full max-w-sm"
        >
          <Link
            href="/menu"
            className="w-full relative px-8 py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 shimmer-btn group active:scale-[0.98] transition-all"
            style={{
              background: GOLD_GRAD,
              color: "#080603",
              boxShadow: "0 4px 24px rgba(201,160,76,0.3), 0 1px 0 rgba(255,240,180,0.3) inset",
              letterSpacing: "0.06em",
            }}
          >
            <span className="font-semibold uppercase tracking-[0.08em] text-[13px]">Découvrir la collection</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/info"
            className="w-full px-6 py-4 rounded-2xl text-[12px] font-medium uppercase tracking-[0.1em] flex items-center justify-center transition-all active:scale-[0.98] hover:border-[rgba(201,160,76,0.2)]"
            style={{
              background: "rgba(201,160,76,0.04)",
              border: "1px solid rgba(201,160,76,0.12)",
              color: "rgba(201,160,76,0.7)",
            }}
          >
            Informations & Horaires
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
