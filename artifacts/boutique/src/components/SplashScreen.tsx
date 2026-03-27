import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/hooks/use-session";

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const { saveChatId, saveUsername } = useSession();
  const [username, setUsername] = useState<string | null>(null);
  const [phase, setPhase] = useState<"logo" | "user" | "out">("logo");
  // Ref stable pour éviter que le changement de référence onDone ne reset les timers
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

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
    // Timers déclenchés une seule fois au montage (ref stable = pas de reset)
    const t1 = setTimeout(() => setPhase("user"), 1200);
    const t2 = setTimeout(() => setPhase("out"), 2800);
    const t3 = setTimeout(() => onDoneRef.current(), 3300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
              <img
                src={`${import.meta.env.BASE_URL}logo.jpg`}
                alt="SOS LE PLUG"
                className="w-full h-full object-cover"
              />
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
