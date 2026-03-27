import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Zap, Lock, Package } from "lucide-react";
import { useListProducts } from "@workspace/api-client-react";

export default function Home() {
  const { data: products } = useListProducts();
  const productCount = products?.length || 0;

  return (
    <div className="relative min-h-screen flex flex-col text-white overflow-hidden pb-24">
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent z-0" />

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center z-10 pt-16">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 relative"
        >
          <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden border border-purple-500/40 shadow-[0_0_60px_-10px_rgba(168,85,247,0.7)] relative glass-panel">
            <img
              src={`${import.meta.env.BASE_URL}bg.png`}
              alt="SOS LE PLUG"
              className="w-full h-full object-cover object-top scale-150"
            />
          </div>
          <motion.div
            animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.9, 1.1, 0.9] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="absolute -inset-4 rounded-[3rem] bg-purple-500/25 blur-2xl -z-10"
          />
        </motion.div>

        {/* Titre principal */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-10"
        >
          <h1 className="text-4xl font-black tracking-tight gradient-plug glow-text font-display">
            🔌 SOS LE PLUG 🔌
          </h1>
          <p className="text-xs font-bold uppercase tracking-[0.4em] mt-2 text-purple-400/90">
            Premium Selection
          </p>
        </motion.div>

        {/* Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="grid grid-cols-3 gap-3 mb-8 w-full max-w-sm"
        >
          <div className="glass-panel rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-purple-500/50 transition-colors">
            <ShieldCheck className="w-6 h-6 text-purple-400" />
            <span className="text-[10px] font-bold text-muted-foreground leading-tight text-center uppercase tracking-wider">Qualité<br/>Premium</span>
          </div>
          <div className="glass-panel rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-cyan-500/50 transition-colors">
            <Zap className="w-6 h-6 text-cyan-400" />
            <span className="text-[10px] font-bold text-muted-foreground leading-tight text-center uppercase tracking-wider">Livraison<br/>Éclair</span>
          </div>
          <div className="glass-panel rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-pink-500/50 transition-colors">
            <Lock className="w-6 h-6 text-pink-400" />
            <span className="text-[10px] font-bold text-muted-foreground leading-tight text-center uppercase tracking-wider">Discret &<br/>Sécurisé</span>
          </div>
        </motion.div>

        {/* Compteur produits */}
        {productCount > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-2 mb-10 glass-panel border-purple-500/20 rounded-full px-6 py-3 shadow-[0_0_20px_-5px_rgba(168,85,247,0.3)]"
          >
            <Package className="w-4 h-4 text-purple-400" />
            <span className="text-xl font-black text-purple-400 glow-text">{productCount}</span>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Produits disponibles</span>
          </motion.div>
        )}

        {/* Boutons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="flex flex-col gap-4 w-full max-w-sm"
        >
          <Link
            href="/menu"
            className="w-full relative px-8 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 shimmer-btn group hover:scale-[1.02] active:scale-[0.98] transition-all text-white shadow-[0_0_30px_-5px_rgba(168,85,247,0.5)]"
            style={{ background: "linear-gradient(135deg, #a855f7, #06b6d4, #ec4899)" }}
          >
            <span className="relative z-10 font-black">Voir le Menu</span>
            <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/info"
            className="w-full px-6 py-4 glass-panel text-white rounded-2xl font-semibold text-sm hover:border-purple-500/30 transition-colors flex items-center justify-center hover:bg-white/5 active:scale-[0.98]"
          >
            Informations & Horaires
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
