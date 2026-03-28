import { useState, useCallback, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { BottomNav } from "@/components/BottomNav";
import { SplashScreen } from "@/components/SplashScreen";
import { motion, AnimatePresence } from "framer-motion";

// Pages
import Home from "@/pages/Home";
import Menu from "@/pages/Menu";
import ProductDetail from "@/pages/ProductDetail";
import Cart from "@/pages/Cart";
import Account from "@/pages/Account";
import Reviews from "@/pages/Reviews";
import Info from "@/pages/Info";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 30_000,
    },
  },
});

function isTelegramConnected(): boolean {
  const path = window.location.pathname;
  if (path.endsWith("/admin") || path.includes("/admin")) return true;
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.initData && tg.initData.length > 0) return true;
  if (localStorage.getItem("telegram_chat_id")) return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get("tg_id")) return true;
  return false;
}

function TelegramGate() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 overflow-hidden"
      style={{ background: "#080603" }}>
      <img
        src={`${import.meta.env.BASE_URL}bg.png`}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-10 mix-blend-luminosity"
      />
      <div className="absolute inset-0" style={{ background: "rgba(8,6,3,0.85)" }} />
      <div className="absolute rounded-full blur-3xl" style={{
        width: "70vw", height: "70vw",
        top: "50%", left: "50%",
        transform: "translate(-50%,-60%)",
        background: "radial-gradient(circle, rgba(201,160,76,0.1) 0%, transparent 65%)",
      }} />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-xs flex flex-col items-center gap-7 text-center"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-[1.25rem] overflow-hidden" style={{
            border: "1px solid rgba(201,160,76,0.25)",
            boxShadow: "0 0 40px -8px rgba(201,160,76,0.3)",
          }}>
            <img src={`${import.meta.env.BASE_URL}bg.png`} alt=""
              className="w-full h-full object-cover object-top scale-150" />
          </div>
          <div>
            <h1 className="font-display font-semibold tracking-[0.1em] uppercase gradient-gold glow-gold text-2xl">
              SOS LE PLUG
            </h1>
            <div className="gold-line mt-2.5 mx-8" />
          </div>
        </div>

        <div className="w-full flex flex-col items-center gap-5 p-6 rounded-[1.75rem]"
          style={{
            background: "rgba(201,160,76,0.04)",
            border: "1px solid rgba(201,160,76,0.14)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
          }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{
              background: "rgba(35,158,217,0.1)",
              border: "1px solid rgba(35,158,217,0.2)",
            }}>
            ✈️
          </div>
          <div>
            <p className="font-display text-lg font-medium mb-1">Membres uniquement</p>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(201,160,76,0.55)" }}>
              Ce service est réservé à nos membres.<br />Ouvre l'app depuis Telegram.
            </p>
          </div>
          <a
            href="https://t.me/sosleplugbot"
            className="w-full py-4 rounded-2xl text-sm font-semibold tracking-[0.08em] uppercase flex items-center justify-center gap-2 active:scale-[0.98] transition-all shimmer-btn"
            style={{
              background: "linear-gradient(135deg, #229ED9 0%, rgba(201,160,76,0.9) 100%)",
              color: "#080603",
              boxShadow: "0 4px 20px rgba(35,158,217,0.25)",
            }}
          >
            <span>Ouvrir dans Telegram</span>
          </a>
        </div>
      </motion.div>
    </div>
  );
}

function PageTransition({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

function Router() {
  return (
    <PageTransition>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/menu" component={Menu} />
        <Route path="/product/:id" component={ProductDetail} />
        <Route path="/cart" component={Cart} />
        <Route path="/account" component={Account} />
        <Route path="/reviews" component={Reviews} />
        <Route path="/info" component={Info} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </PageTransition>
  );
}

function ConditionalBottomNav() {
  const [location] = useLocation();
  if (location === "/info") return null;
  if (location.startsWith("/cart")) return null;
  return <BottomNav />;
}

function useTelegramFullscreen() {
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;
    const requestFs = () => {
      tg.expand();
      if (typeof tg.requestFullscreen === "function") tg.requestFullscreen();
    };
    requestFs();
    // Re-trigger when app regains focus (user returns from another Telegram screen)
    const onVisible = () => { if (!document.hidden) requestFs(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
}

function App() {
  const [telegramOk] = useState(() => isTelegramConnected());
  useTelegramFullscreen();

  const [splashDone, setSplashDone] = useState(() => {
    const isHome = window.location.pathname === import.meta.env.BASE_URL.replace(/\/$/, "") ||
                   window.location.pathname === import.meta.env.BASE_URL ||
                   window.location.pathname === "/";
    return !isHome || sessionStorage.getItem("splash_shown") === "1";
  });

  const handleSplashDone = useCallback(() => {
    sessionStorage.setItem("splash_shown", "1");
    setSplashDone(true);
  }, []);

  if (!telegramOk) {
    return (
      <QueryClientProvider client={queryClient}>
        <TelegramGate />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          {!splashDone && <SplashScreen onDone={handleSplashDone} />}

          {/* Fond vidéo global — toujours présent, jamais remonté */}
          <AnimatedBackground />

          {/* Conteneur centré : plein écran mobile, max 430px desktop */}
          <div
            className="relative z-10 mx-auto text-foreground font-body antialiased selection:bg-primary/30"
            style={{ maxWidth: "430px", minHeight: "100dvh" }}
          >
            <Router />
            <ConditionalBottomNav />
          </div>

          <Toaster />
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
