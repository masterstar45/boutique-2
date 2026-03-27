import { useState, useCallback } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { BottomNav } from "@/components/BottomNav";
import { SplashScreen } from "@/components/SplashScreen";
import { motion } from "framer-motion";

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
    },
  },
});

function isTelegramConnected(): boolean {
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.initData && tg.initData.length > 0) return true;
  if (localStorage.getItem("telegram_chat_id")) return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get("tg_id")) return true;
  return false;
}

function TelegramGate() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 overflow-hidden">
      <img
        src={`${import.meta.env.BASE_URL}bg.png`}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/80" />
      <div className="absolute inset-0 bg-gradient-to-b from-purple-950/30 via-transparent to-black/60" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative z-10 w-full max-w-xs flex flex-col items-center gap-6 text-center"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="text-5xl">🔌</div>
          <h1 className="text-3xl font-black font-display gradient-plug glow-text tracking-tight">
            SOS LE PLUG
          </h1>
          <p className="text-xs text-purple-400/80 tracking-[0.3em] uppercase">
            Premium Selection
          </p>
        </div>

        <div className="glass-panel p-6 rounded-[2rem] border border-white/10 w-full flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#229ED9]/15 border border-[#229ED9]/30 flex items-center justify-center text-2xl">
            ✈️
          </div>
          <div>
            <p className="font-bold text-base">Accès exclusif</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ce service est réservé aux membres.<br />Ouvre l'app depuis Telegram.
            </p>
          </div>
          <a
            href="https://t.me/sosleplugbot"
            className="w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-2 active:scale-95 transition-transform text-base"
            style={{ background: "linear-gradient(135deg, #229ED9, hsl(270,90%,55%))" }}
          >
            <span>Ouvrir dans Telegram</span>
          </a>
        </div>
      </motion.div>
    </div>
  );
}

function Router() {
  return (
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
  );
}

function App() {
  const [telegramOk] = useState(() => isTelegramConnected());

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
          <div className="relative z-10 bg-transparent min-h-screen text-foreground font-body antialiased selection:bg-primary/30">
            <AnimatedBackground />
            <div className="relative z-20">
              <Router />
              <BottomNav />
            </div>
            <Toaster />
          </div>
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
