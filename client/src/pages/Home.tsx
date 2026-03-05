import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Zap, Lock, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import logoImage from "@assets/photo_2026-03-05_15-31-26_1772732416152.jpg";
import type { Product } from "@shared/schema";

function AnimatedCounter({ value }: { value: number }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-2xl font-black text-primary glow-text"
    >
      {value}
    </motion.span>
  );
}

export default function Home() {
  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      return res.json();
    },
  });

  const productCount = products?.length || 0;

  return (
    <div className="relative min-h-screen flex flex-col text-white overflow-hidden">
      
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent z-0" />
      
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center z-10 pt-16 pb-24">
        
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-4 relative"
        >
          <div className="w-56 h-28 rounded-3xl overflow-hidden border-2 border-primary/30 shadow-[0_0_40px_-10px_rgba(34,197,94,0.5)] relative bg-black/60 p-3">
            <img src={logoImage} alt="PharmacyHash" className="w-full h-full object-contain" />
          </div>
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="absolute -inset-3 rounded-[2rem] bg-primary/10 blur-xl -z-10"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-primary via-emerald-300 to-primary bg-clip-text text-transparent glow-text">
            PharmacyHash
          </h1>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-[0.3em] mt-1">Premium Selection</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="grid grid-cols-3 gap-3 mb-6 w-full max-w-sm"
        >
          <div className="glass-panel rounded-2xl p-3 flex flex-col items-center gap-1.5">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-medium text-muted-foreground leading-tight text-center">Qualité Premium</span>
          </div>
          <div className="glass-panel rounded-2xl p-3 flex flex-col items-center gap-1.5">
            <Zap className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-medium text-muted-foreground leading-tight text-center">Livraison Éclair</span>
          </div>
          <div className="glass-panel rounded-2xl p-3 flex flex-col items-center gap-1.5">
            <Lock className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-medium text-muted-foreground leading-tight text-center">Discret & Sécurisé</span>
          </div>
        </motion.div>

        {productCount > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-2 mb-8 glass-panel rounded-full px-5 py-2.5"
          >
            <Package className="w-4 h-4 text-primary" />
            <AnimatedCounter value={productCount} />
            <span className="text-xs text-muted-foreground font-medium">produits disponibles</span>
          </motion.div>
        )}

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="flex flex-col gap-3 w-full max-w-sm"
        >
          <Link href="/menu">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full relative px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-lg shadow-[0_0_30px_-5px_rgba(34,197,94,0.4)] flex items-center justify-center gap-2 shimmer-btn"
            >
              <span className="relative z-10">Voir le Menu</span>
              <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </Link>
          
          <Link href="/account">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full px-6 py-4 glass-panel text-white rounded-2xl font-medium text-sm hover:bg-white/10 transition-colors flex items-center justify-center"
            >
              Mon Compte & Fidélité
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
