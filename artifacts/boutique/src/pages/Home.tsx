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
    { icon: ShieldCheck, label: "Qualité\nPremium" },
    { icon: Zap,         label: "Livraison\nÉclair"  },
    { icon: Lock,        label: "Discret &\nSécurisé" },
  ];

  return (
    <div className="relative min-h-screen flex flex-col text-white overflow-hidden pb-nav">
      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 text-center z-10 pt-10 sm:pt-14 gap-9">

        {/* ── Logo ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex flex-col items-center gap-5"
        >
          {/* Halo ambient */}
          <div className="absolute rounded-full blur-3xl -z-10 pointer-events-none" style={{
            width: "240px", height: "240px",
            background: "radial-gradient(circle, rgba(201,160,76,0.13) 0%, transparent 70%)",
            animation: "pulse-gold 4s ease-in-out infinite",
          }} />

          {/* Anneau décoratif rotatif */}
          <div className="relative flex items-center justify-center" style={{ width: 88, height: 88 }}>
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                border: "1px solid transparent",
                borderTopColor: `${GOLD}0.6)`,
                borderRightColor: `${GOLD}0.12)`,
                borderBottomColor: "transparent",
                borderLeftColor: `${GOLD}0.12)`,
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute rounded-full"
              style={{
                width: 66, height: 66,
                border: "1px solid transparent",
                borderBottomColor: `${GOLD}0.4)`,
                borderLeftColor: `${GOLD}0.08)`,
                borderTopColor: "transparent",
                borderRightColor: `${GOLD}0.08)`,
              }}
              animate={{ rotate: -360 }}
              transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
            />
            <div
              className="absolute rounded-full flex items-center justify-center"
              style={{
                width: 50, height: 50,
                background: "linear-gradient(135deg, rgba(201,160,76,0.1), rgba(201,160,76,0.04))",
                border: `1px solid ${GOLD}0.22)`,
                boxShadow: `0 0 22px -4px ${GOLD}0.3)`,
                fontSize: 20,
              }}
            >
              🔌
            </div>
          </div>

          {/* Titre avec PL🔌G */}
          <div>
            <h1
              className="font-display font-black tracking-[0.12em] uppercase gradient-gold glow-gold"
              style={{ fontSize: "clamp(1.65rem, 7vw, 2.3rem)" }}
              aria-label="SOS LE PLUG"
            >
              SOS LE PL🔌G
            </h1>
            <div className="gold-line mt-3 mx-10" />
            <p className="text-[9px] tracking-[0.38em] uppercase mt-3" style={{ color: `${GOLD}0.5)` }}>
              Premium Selection
            </p>
          </div>
        </motion.div>

        {/* ── Feature grid ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-3 gap-3 sm:gap-5 w-full max-w-sm sm:max-w-lg"
        >
          {features.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2.5 py-5 px-2 rounded-2xl"
              style={{
                background: "rgba(201,160,76,0.04)",
                border: "1px solid rgba(201,160,76,0.1)",
                backdropFilter: "blur(12px)",
              }}
            >
              <Icon className="w-5 h-5" style={{ color: `${GOLD}0.85)` }} />
              <span
                className="text-[9.5px] font-medium leading-tight text-center uppercase tracking-wider whitespace-pre-line"
                style={{ color: `${GOLD}0.6)` }}
              >
                {label}
              </span>
            </div>
          ))}
        </motion.div>

        {/* ── Compteur produits ── */}
        {productCount > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.12, duration: 0.25 }}
            className="flex items-center gap-3 px-6 py-3 rounded-full"
            style={{
              background: "rgba(201,160,76,0.05)",
              border: "1px solid rgba(201,160,76,0.16)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "rgba(201,160,76,0.85)" }} />
            <span className="font-display text-xl font-semibold gradient-gold">{productCount}</span>
            <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: `${GOLD}0.55)` }}>
              Produits disponibles
            </span>
          </motion.div>
        )}

        {/* ── CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-3 w-full max-w-sm sm:max-w-md"
        >
          {/* Bouton principal — zone de touche confortable (min 56px) */}
          <Link
            href="/menu"
            className="w-full relative px-8 rounded-2xl font-semibold flex items-center justify-center gap-2 shimmer-btn group active:scale-[0.98] transition-all"
            style={{
              background: GOLD_GRAD,
              color: "#080603",
              boxShadow: "0 4px 28px rgba(201,160,76,0.32), 0 1px 0 rgba(255,240,180,0.3) inset",
              letterSpacing: "0.07em",
              minHeight: 56,
            }}
          >
            <span className="font-bold uppercase tracking-[0.09em] text-[13px]">Découvrir la collection</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          {/* Bouton secondaire */}
          <Link
            href="/info"
            className="w-full px-6 rounded-2xl text-[12px] font-medium uppercase tracking-[0.1em] flex items-center justify-center transition-all active:scale-[0.98]"
            style={{
              background: "rgba(201,160,76,0.04)",
              border: "1px solid rgba(201,160,76,0.12)",
              color: `${GOLD}0.65)`,
              minHeight: 50,
              backdropFilter: "blur(12px)",
            }}
          >
            Informations & Horaires
          </Link>
        </motion.div>

      </div>
    </div>
  );
}
