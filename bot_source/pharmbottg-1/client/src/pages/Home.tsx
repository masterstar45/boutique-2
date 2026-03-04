import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import backgroundImage from "@assets/background.png";

export default function Home() {
  return (
    <div 
      className="relative min-h-screen flex flex-col text-white overflow-hidden bg-black"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-black/60" />
      
      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center z-10">
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-xl text-white/90 mb-12 max-w-sm mx-auto drop-shadow-md"
        >
          Bienvenue sur notre bot 2.0
          <br />
          <span className="text-sm opacity-80">Premium Farm & Livraison rapide</span>
        </motion.p>

        <div className="flex flex-col gap-4">
          <Link href="/menu">
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group relative px-8 py-4 bg-white text-black rounded-full font-bold text-lg shadow-xl flex items-center gap-2 overflow-hidden"
            >
              <span className="relative z-10">Voir le Menu</span>
              <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.button>
          </Link>
          
          <Link href="/account">
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3 bg-white/20 backdrop-blur-sm text-white rounded-full font-medium text-sm border border-white/30 flex items-center gap-2"
            >
              Mon Compte & Fidélité
            </motion.button>
          </Link>
        </div>
      </div>

      <div className="p-6 text-center text-xs text-white/50 z-10 relative">
        © 2026 PharmacyHash. All rights reserved.
      </div>
    </div>
  );
}
