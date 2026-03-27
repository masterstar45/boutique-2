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
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    const tgWebApp = (window as any).Telegram?.WebApp;
    if (tgWebApp) {
      tgWebApp.ready();
      tgWebApp.expand();
      tgWebApp.setHeaderColor("#080603");
      tgWebApp.setBackgroundColor("#080603");
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
    const savedUsername = localStorage.getItem("telegram_username");
    if (savedUsername) setUsername(savedUsername);
  }, []);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("user"), 1400);
    const t2 = setTimeout(() => setPhase("out"), 3000);
    const t3 = setTimeout(() => onDoneRef.current(), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <AnimatePresence>
      {phase !== "out" && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{ background: "#080603" }}
        >
          {/* Background image — very dark */}
          <img
            src={`${import.meta.env.BASE_URL}bg.png`}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-8 mix-blend-luminosity"
          />
          <div className="absolute inset-0" style={{ background: "rgba(8,6,3,0.88)" }} />

          {/* Gold ambient glow */}
          <div className="absolute rounded-full" style={{
            width: "70vw", height: "70vw",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            background: "radial-gradient(circle, rgba(201,160,76,0.1) 0%, transparent 65%)",
            animation: "pulse-gold 3s ease-in-out infinite",
          }} />

          <div className="relative z-10 flex flex-col items-center gap-8">

            {/* Logo monogram */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="w-24 h-24 rounded-2xl overflow-hidden relative"
                style={{
                  border: "1px solid rgba(201,160,76,0.25)",
                  boxShadow: "0 0 40px -8px rgba(201,160,76,0.3), inset 0 1px 0 rgba(255,240,180,0.08)",
                }}>
                <img
                  src={`${import.meta.env.BASE_URL}bg.png`}
                  alt=""
                  className="w-full h-full object-cover object-top scale-150"
                />
                <div className="absolute inset-0" style={{ background: "rgba(8,6,3,0.2)" }} />
              </div>
              {/* Corner ornaments */}
              <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t border-l" style={{ borderColor: "rgba(201,160,76,0.5)" }} />
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t border-r" style={{ borderColor: "rgba(201,160,76,0.5)" }} />
              <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b border-l" style={{ borderColor: "rgba(201,160,76,0.5)" }} />
              <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b border-r" style={{ borderColor: "rgba(201,160,76,0.5)" }} />
            </motion.div>

            {/* Name */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="text-center"
            >
              <h1 className="font-display font-semibold tracking-[0.12em] uppercase glow-gold gradient-gold"
                style={{ fontSize: "clamp(1.6rem, 6vw, 2.2rem)" }}>
                SOS LE PLUG
              </h1>
              <div className="gold-line mt-4 mx-8" />
              <p className="text-[9px] tracking-[0.35em] uppercase mt-3"
                style={{ color: "rgba(201,160,76,0.55)" }}>
                Premium Selection
              </p>
            </motion.div>

            {/* User greeting */}
            <AnimatePresence>
              {phase === "user" && username && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                  className="flex flex-col items-center gap-3 px-8 py-5 rounded-2xl"
                  style={{
                    background: "rgba(201,160,76,0.04)",
                    border: "1px solid rgba(201,160,76,0.15)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                  }}
                >
                  <div className="w-11 h-11 rounded-full flex items-center justify-center font-display text-xl font-semibold"
                    style={{
                      background: "rgba(201,160,76,0.1)",
                      border: "1px solid rgba(201,160,76,0.25)",
                      color: "rgba(201,160,76,0.9)",
                    }}>
                    {username[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] tracking-[0.25em] uppercase" style={{ color: "rgba(201,160,76,0.5)" }}>Bienvenue</p>
                    <p className="font-display font-medium text-lg mt-0.5 gradient-gold">@{username}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "rgba(201,160,76,0.8)" }} />
                    <span className="text-[10px]" style={{ color: "rgba(201,160,76,0.5)" }}>Compte synchronisé</span>
                  </div>
                </motion.div>
              )}
              {phase === "user" && !username && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-1.5"
                >
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "rgba(201,160,76,0.5)" }}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.25 }}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Progress line */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-24 h-px overflow-hidden"
            style={{ background: "rgba(201,160,76,0.1)" }}>
            <motion.div
              className="h-full"
              style={{ background: "linear-gradient(90deg, transparent, rgba(201,160,76,0.8), transparent)" }}
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 3, ease: "easeInOut" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
