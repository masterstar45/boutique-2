import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/hooks/use-session";

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const { saveChatId, saveUsername } = useSession();
  const [username, setUsername] = useState<string | null>(null);
  const [phase, setPhase] = useState<"logo" | "user" | "out">("logo");

  useEffect(() => {
    // 1. Priorité : Telegram Mini App WebApp SDK
    const tgWebApp = (window as any).Telegram?.WebApp;
    if (tgWebApp) {
      tgWebApp.ready();
      tgWebApp.expand();
      // Thème couleur cohérent avec la boutique
      tgWebApp.setHeaderColor("#0d0a1a");
      tgWebApp.setBackgroundColor("#0d0a1a");

      const user = tgWebApp.initDataUnsafe?.user;
      if (user) {
        const id = String(user.id);
        const uname = user.username || user.first_name || "";
        saveChatId(id);
        saveUsername(uname);
        setUsername(uname);
        return;
      }
    }

    // 2. Fallback : paramètres URL (bouton classique)
    const params = new URLSearchParams(window.location.search);
    const tgUser = params.get("tg_user");
    const tgId = params.get("tg_id");
    if (tgUser && tgId) {
      saveChatId(tgId);
      saveUsername(tgUser);
      setUsername(tgUser);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    // 3. Fallback : localStorage (déjà connecté)
    const savedUsername = localStorage.getItem("telegram_username");
    if (savedUsername) setUsername(savedUsername);
  }, []);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("user"), 1200);
    const t2 = setTimeout(() => setPhase("out"), 2800);
    const t3 = setTimeout(onDone, 3300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onDone]);

  return (
    <AnimatePresence>
      {phase !== "out" && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Fond : même image que le reste de la boutique */}
          <img
            src={`${import.meta.env.BASE_URL}bg.png`}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-black/70" />
          <div className="absolute inset-0 bg-gradient-to-b from-purple-950/20 via-transparent to-black/50" />

          <div className="relative z-10 flex flex-col items-center gap-6">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
              className="w-28 h-28 rounded-[2rem] shadow-[0_0_60px_-10px_rgba(147,51,234,0.7)] overflow-hidden"
            >
              <svg viewBox="0 0 112 112" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                <rect width="112" height="112" fill="#0d0a1a"/>
                <defs>
                  <linearGradient id="plugGrad" x1="0" y1="0" x2="112" y2="112" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#a855f7"/>
                    <stop offset="50%" stopColor="#06b6d4"/>
                    <stop offset="100%" stopColor="#ec4899"/>
                  </linearGradient>
                  <linearGradient id="plugGrad2" x1="0" y1="0" x2="0" y2="112" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity="0.15"/>
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.05"/>
                  </linearGradient>
                </defs>
                <rect width="112" height="112" fill="url(#plugGrad2)"/>
                <rect x="1" y="1" width="110" height="110" rx="19" stroke="url(#plugGrad)" strokeWidth="1.5" strokeOpacity="0.5"/>
                {/* Plug icon */}
                <rect x="49" y="14" width="6" height="14" rx="2" fill="url(#plugGrad)"/>
                <rect x="57" y="14" width="6" height="14" rx="2" fill="url(#plugGrad)"/>
                <path d="M38 28 H74 V44 C74 55 65 62 56 62 C47 62 38 55 38 44 Z" fill="url(#plugGrad)" fillOpacity="0.9"/>
                <rect x="52" y="62" width="8" height="10" rx="2" fill="url(#plugGrad)"/>
                <path d="M44 72 H68 V80 C68 83 65 86 56 86 C47 86 44 83 44 80 Z" fill="url(#plugGrad)" fillOpacity="0.7"/>
                <rect x="52" y="86" width="8" height="12" rx="2" fill="url(#plugGrad)" fillOpacity="0.5"/>
                {/* SOS text */}
                <text x="56" y="104" textAnchor="middle" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="9" fill="url(#plugGrad)" letterSpacing="3">SOS LE PLUG</text>
              </svg>
            </motion.div>

            {/* Nom de la boutique */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-center"
            >
              <h1 className="text-3xl font-black font-display tracking-tight gradient-plug glow-text">
                🔌 SOS LE PLUG 🔌
              </h1>
              <p className="text-xs text-purple-400/80 tracking-[0.3em] uppercase mt-1">
                Premium Selection
              </p>
            </motion.div>

            {/* Infos utilisateur Telegram */}
            <AnimatePresence>
              {phase === "user" && username && (
                <motion.div
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                  className="glass-panel border border-primary/20 rounded-2xl px-8 py-5 flex flex-col items-center gap-2 shadow-[0_0_30px_-10px_rgba(34,197,94,0.3)]"
                >
                  <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-2xl mb-1">
                    👤
                  </div>
                  <p className="text-muted-foreground text-xs uppercase tracking-widest">Connecté en tant que</p>
                  <p className="text-primary font-black text-xl">@{username}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs text-muted-foreground">Compte synchronisé</span>
                  </div>
                </motion.div>
              )}

              {phase === "user" && !username && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full bg-primary"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Chargement...</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Barre de progression */}
          <motion.div
            className="absolute bottom-10 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/10 rounded-full overflow-hidden"
          >
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 2.8, ease: "linear" }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
