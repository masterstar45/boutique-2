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
    const params = new URLSearchParams(window.location.search);
    const tgUser = params.get("tg_user");
    const tgId = params.get("tg_id");

    if (tgUser && tgId) {
      saveChatId(tgId);
      saveUsername(tgUser);
      setUsername(tgUser);
      // Nettoyer l'URL sans recharger
      window.history.replaceState({}, "", window.location.pathname);
    } else {
      // Récupérer depuis localStorage si déjà connecté
      const savedUsername = localStorage.getItem("telegram_username");
      if (savedUsername) setUsername(savedUsername);
    }

    const t1 = setTimeout(() => setPhase("user"), 1200);
    const t2 = setTimeout(() => setPhase("out"), 2800);
    const t3 = setTimeout(onDone, 3300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <AnimatePresence>
      {phase !== "out" && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background overflow-hidden"
        >
          {/* Fond animé */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px] animate-pulse" />
            <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-primary/8 blur-[100px] animate-pulse" style={{ animationDelay: "0.5s" }} />
          </div>

          <div className="relative z-10 flex flex-col items-center gap-6">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
              className="w-28 h-28 rounded-[2rem] bg-black border border-primary/30 shadow-[0_0_60px_-10px_rgba(34,197,94,0.5)] flex items-center justify-center overflow-hidden"
            >
              <svg viewBox="0 0 80 80" className="w-16 h-16" fill="none">
                <circle cx="40" cy="40" r="38" fill="#111" stroke="#22c55e" strokeWidth="1.5" />
                <path d="M40 15 C40 15 25 28 25 40 C25 52 32 60 40 65 C48 60 55 52 55 40 C55 28 40 15 40 15Z" fill="#22c55e" opacity="0.8"/>
                <path d="M40 20 C40 20 50 30 50 40 C50 50 45 57 40 62 C35 57 30 50 30 40 C30 30 40 20 40 20Z" fill="#16a34a"/>
                <circle cx="40" cy="40" r="6" fill="#4ade80"/>
              </svg>
            </motion.div>

            {/* Nom de la boutique */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-center"
            >
              <h1 className="text-4xl font-black font-display text-primary tracking-tight">
                SOS LE PLUG
              </h1>
              <p className="text-xs text-muted-foreground tracking-[0.3em] uppercase mt-1">
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
