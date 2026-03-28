import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/hooks/use-session";

interface SplashScreenProps {
  onDone: () => void;
}

const GOLD = "rgba(201,160,76,";
const GOLD_GRAD = "linear-gradient(135deg, #c9a04c 0%, #f0d070 45%, #d4a843 100%)";

export function SplashScreen({ onDone }: SplashScreenProps) {
  const { saveChatId, saveUsername } = useSession();
  const [username, setUsername] = useState<string | null>(null);
  const [phase, setPhase] = useState<"intro" | "logo" | "user" | "out">("intro");
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    const tgWebApp = (window as any).Telegram?.WebApp;
    if (tgWebApp) {
      tgWebApp.ready();
      tgWebApp.expand();
      if (typeof tgWebApp.requestFullscreen === "function") tgWebApp.requestFullscreen();
      tgWebApp.setHeaderColor("#080603");
      tgWebApp.setBackgroundColor("#080603");
      if (typeof tgWebApp.setBottomBarColor === "function") tgWebApp.setBottomBarColor("#080603");
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
    const t1 = setTimeout(() => setPhase("logo"), 120);
    const t2 = setTimeout(() => setPhase("user"), 1900);
    const t3 = setTimeout(() => setPhase("out"), 3300);
    const t4 = setTimeout(() => onDoneRef.current(), 3800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  const isActive = phase !== "intro";

  return (
    <AnimatePresence>
      {phase !== "out" && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden select-none"
          style={{ background: "#080603" }}
        >
          {/* Deep radial glow */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(ellipse 80% 65% at 50% 52%, rgba(201,160,76,0.08) 0%, rgba(201,160,76,0.03) 40%, transparent 70%)",
          }} />

          {/* Grain texture */}
          <div className="absolute inset-0 pointer-events-none" style={{
            opacity: 0.025,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
          }} />

          {/* ── Central content ── */}
          <div className="relative z-10 flex flex-col items-center" style={{ gap: "2.2rem" }}>

            {/* ── Animated rings + plug ── */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={isActive ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.05, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex items-center justify-center"
              style={{ width: 100, height: 100 }}
            >
              {/* Outer rotating ring — clockwise */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  border: "1px solid transparent",
                  borderTopColor: GOLD + "0.7)",
                  borderRightColor: GOLD + "0.15)",
                  borderBottomColor: "transparent",
                  borderLeftColor: GOLD + "0.15)",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
              />
              {/* Inner rotating ring — counter-clockwise */}
              <motion.div
                className="absolute rounded-full"
                style={{
                  width: 76, height: 76,
                  top: "50%", left: "50%",
                  transform: "translate(-50%, -50%)",
                  border: "1px solid transparent",
                  borderBottomColor: GOLD + "0.5)",
                  borderLeftColor: GOLD + "0.1)",
                  borderTopColor: "transparent",
                  borderRightColor: GOLD + "0.1)",
                }}
                animate={{ rotate: -360 }}
                transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
              />
              {/* Glow pulse */}
              <motion.div
                className="absolute rounded-full"
                style={{
                  width: 52, height: 52,
                  top: "50%", left: "50%",
                  transform: "translate(-50%, -50%)",
                  background: GOLD + "0.06)",
                }}
                animate={{ scale: [1, 1.15, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              />
              {/* Center disc */}
              <div
                className="absolute rounded-full flex items-center justify-center"
                style={{
                  width: 54, height: 54,
                  top: "50%", left: "50%",
                  transform: "translate(-50%, -50%)",
                  background: "linear-gradient(135deg, rgba(201,160,76,0.1), rgba(201,160,76,0.04))",
                  border: `1px solid ${GOLD}0.25)`,
                  boxShadow: `0 0 24px -4px ${GOLD}0.3), inset 0 1px 0 rgba(255,240,180,0.06)`,
                  fontSize: 22,
                }}
              >
                🔌
              </div>
            </motion.div>

            {/* ── Brand name — word by word blur reveal ── */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-[0.6rem]">
                {["SOS", "LE", "PLUG"].map((word, i) => (
                  <motion.span
                    key={word}
                    initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
                    animate={isActive ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                    transition={{ delay: 0.28 + i * 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    className="font-display font-black tracking-widest"
                    style={{
                      fontSize: "clamp(1.8rem, 7.5vw, 2.5rem)",
                      background: GOLD_GRAD,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {word}
                  </motion.span>
                ))}
              </div>

              {/* Separator line expanding from center */}
              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={isActive ? { scaleX: 1, opacity: 1 } : {}}
                transition={{ delay: 0.9, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  height: 1,
                  width: 160,
                  background: `linear-gradient(90deg, transparent, ${GOLD}0.6), transparent)`,
                  transformOrigin: "center",
                }}
              />

              {/* Tagline */}
              <motion.p
                initial={{ opacity: 0, letterSpacing: "0.2em" }}
                animate={isActive ? { opacity: 1, letterSpacing: "0.38em" } : {}}
                transition={{ delay: 1.05, duration: 0.9, ease: "easeOut" }}
                style={{
                  fontSize: "0.58rem",
                  textTransform: "uppercase",
                  color: GOLD + "0.5)",
                }}
              >
                Premium Selection
              </motion.p>
            </div>

            {/* ── User greeting ── */}
            <AnimatePresence mode="wait">
              {phase === "user" && username && (
                <motion.div
                  key="user-card"
                  initial={{ opacity: 0, y: 22, scale: 0.88 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.55, ease: [0.34, 1.4, 0.64, 1] }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.8rem",
                    padding: "0.75rem 1.25rem",
                    borderRadius: "1rem",
                    background: `linear-gradient(135deg, ${GOLD}0.07), ${GOLD}0.03))`,
                    border: `1px solid ${GOLD}0.18)`,
                    boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,240,180,0.03)`,
                    minWidth: 200,
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 38, height: 38,
                    borderRadius: "50%",
                    background: GOLD + "0.1)",
                    border: `1.5px solid ${GOLD}0.3)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "Syne, sans-serif",
                    fontWeight: 800, fontSize: "1.05rem",
                    color: GOLD + "0.9)",
                    flexShrink: 0,
                    boxShadow: `0 0 12px -2px ${GOLD}0.2)`,
                  }}>
                    {username[0]?.toUpperCase() || "🔌"}
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1 }}>
                    <p style={{
                      fontSize: "0.55rem",
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: GOLD + "0.45)",
                      marginBottom: "0.15rem",
                    }}>
                      Bienvenue
                    </p>
                    <p style={{
                      fontFamily: "Syne, sans-serif",
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      background: GOLD_GRAD,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}>
                      @{username}
                    </p>
                  </div>

                  {/* Live dot */}
                  <motion.div
                    style={{
                      width: 7, height: 7,
                      borderRadius: "50%",
                      background: GOLD + "0.85)",
                      boxShadow: `0 0 6px ${GOLD}0.6)`,
                    }}
                    animate={{ opacity: [0.4, 1, 0.4], scale: [0.85, 1, 0.85] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  />
                </motion.div>
              )}

              {phase === "user" && !username && (
                <motion.div
                  key="dots"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex gap-2"
                >
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      style={{
                        width: 5, height: 5,
                        borderRadius: "50%",
                        background: GOLD + "0.5)",
                      }}
                      animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1, 0.8] }}
                      transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22, ease: "easeInOut" }}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Bottom progress ── */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2" style={{ width: 110 }}>
            {/* Track */}
            <div style={{
              width: "100%", height: 1,
              background: GOLD + "0.1)",
              borderRadius: 2,
              overflow: "hidden",
              position: "relative",
            }}>
              <motion.div
                style={{
                  position: "absolute", top: 0, left: 0,
                  height: "100%", borderRadius: 2,
                  background: `linear-gradient(90deg, ${GOLD}0.3), ${GOLD}0.9), ${GOLD}0.6))`,
                  boxShadow: `0 0 6px ${GOLD}0.4)`,
                }}
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 3.0, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
              />
            </div>
            {/* Label */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.38 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              style={{
                fontSize: "0.5rem",
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: GOLD + "0.7)",
              }}
            >
              Chargement
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
