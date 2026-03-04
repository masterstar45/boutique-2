import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Leaf, ShieldCheck, Zap } from "lucide-react";
import backgroundImage from "@assets/background.png";

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col text-white overflow-hidden bg-background">
      <div className="animated-bg" />
      
      {/* Background Image with elegant overlay */}
      <div 
        className="absolute inset-0 z-0 opacity-40 mix-blend-overlay"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent z-0" />
      
      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center z-10 pt-20 pb-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="w-24 h-24 mb-8 rounded-full glass-panel flex items-center justify-center border-primary/30 shadow-[0_0_40px_-10px_rgba(34,197,94,0.3)]"
        >
          <Leaf className="w-12 h-12 text-primary" />
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-4xl md:text-5xl font-extrabold text-white mb-4 drop-shadow-lg"
        >
          Premium <span className="text-primary">Farm</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-lg text-muted-foreground mb-10 max-w-sm mx-auto"
        >
          La meilleure qualité, livrée rapidement et discrètement.
        </motion.p>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="grid grid-cols-2 gap-4 mb-12 w-full max-w-sm"
        >
          <div className="glass-panel rounded-2xl p-4 flex flex-col items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Qualité Premium</span>
          </div>
          <div className="glass-panel rounded-2xl p-4 flex flex-col items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Livraison Éclair</span>
          </div>
        </motion.div>

        <div className="flex flex-col gap-4 w-full max-w-sm">
          <Link href="/menu">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full relative px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-lg shadow-[0_0_30px_-5px_rgba(34,197,94,0.4)] flex items-center justify-center gap-2 overflow-hidden group"
            >
              <span className="relative z-10">Voir le Menu</span>
              <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
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
        </div>
      </div>
    </div>
  );
}