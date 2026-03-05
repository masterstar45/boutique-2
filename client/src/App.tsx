import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BottomNav } from "@/components/BottomNav";
import { AnimatePresence, motion } from "framer-motion";
import bgVideoUrl from "@assets/fotor_creation_2026-03-05_1772731700946.mp4";

interface BgSettings {
  bg_preset: string | null;
  bg_color1: string | null;
  bg_color2: string | null;
  bg_color3: string | null;
  bg_opacity: string | null;
  bg_speed: string | null;
}

const defaultBg: BgSettings = {
  bg_preset: null,
  bg_color1: "150,80%,45%",
  bg_color2: "170,80%,40%",
  bg_color3: "140,70%,35%",
  bg_opacity: "0.18",
  bg_speed: "18",
};

const presets: Record<string, Omit<BgSettings, 'bg_preset'>> = {
  emerald: { bg_color1: "150,80%,45%", bg_color2: "170,80%,40%", bg_color3: "140,70%,35%", bg_opacity: "0.18", bg_speed: "18" },
  purple: { bg_color1: "270,80%,55%", bg_color2: "290,70%,45%", bg_color3: "250,60%,50%", bg_opacity: "0.18", bg_speed: "18" },
  ocean: { bg_color1: "200,80%,50%", bg_color2: "220,70%,45%", bg_color3: "190,75%,40%", bg_opacity: "0.18", bg_speed: "18" },
  sunset: { bg_color1: "20,90%,55%", bg_color2: "350,80%,50%", bg_color3: "40,85%,50%", bg_opacity: "0.18", bg_speed: "18" },
  gold: { bg_color1: "45,90%,50%", bg_color2: "35,85%,45%", bg_color3: "55,80%,40%", bg_opacity: "0.18", bg_speed: "18" },
  neon: { bg_color1: "120,100%,50%", bg_color2: "180,100%,50%", bg_color3: "300,100%,50%", bg_opacity: "0.15", bg_speed: "12" },
};

function AnimatedBg() {
  const { data: settings } = useQuery<BgSettings>({
    queryKey: ["/api/background-settings"],
    staleTime: 30000,
  });

  const s = { ...defaultBg, ...settings };
  const c1 = s.bg_color1 || defaultBg.bg_color1!;
  const c2 = s.bg_color2 || defaultBg.bg_color2!;
  const c3 = s.bg_color3 || defaultBg.bg_color3!;
  const opacity = parseFloat(s.bg_opacity || "0.18");
  const speed = parseFloat(s.bg_speed || "18");

  return (
    <div className="animated-bg">
      <div
        className="animated-bg-orb"
        style={{
          top: "-15%", left: "-10%", width: "55vw", height: "55vw",
          background: `radial-gradient(circle, hsl(${c1} / ${opacity}), hsl(${c1} / ${opacity * 0.25}))`,
          animation: `orb-drift-1 ${speed}s ease-in-out infinite`,
        }}
      />
      <div
        className="animated-bg-orb"
        style={{
          bottom: "-15%", right: "-10%", width: "60vw", height: "60vw",
          background: `radial-gradient(circle, hsl(${c2} / ${opacity * 0.9}), hsl(${c2} / ${opacity * 0.15}))`,
          animation: `orb-drift-2 ${speed * 1.22}s ease-in-out infinite`,
        }}
      />
      <div
        className="animated-bg-orb"
        style={{
          top: "40%", left: "30%", width: "40vw", height: "40vw",
          background: `radial-gradient(circle, hsl(${c3} / ${opacity * 0.65}), hsl(${c3} / ${opacity * 0.1}))`,
          animation: `orb-drift-3 ${speed * 0.83}s ease-in-out infinite`,
        }}
      />
      <div
        className="animated-bg-particles"
        style={{
          backgroundImage: [
            `radial-gradient(1px 1px at 10% 20%, hsl(${c1} / 0.3) 50%, transparent 50%)`,
            `radial-gradient(1px 1px at 30% 65%, hsl(${c2} / 0.25) 50%, transparent 50%)`,
            `radial-gradient(1.5px 1.5px at 55% 15%, hsl(${c1} / 0.2) 50%, transparent 50%)`,
            `radial-gradient(1px 1px at 70% 80%, hsl(${c3} / 0.3) 50%, transparent 50%)`,
            `radial-gradient(1px 1px at 85% 40%, hsl(${c2} / 0.2) 50%, transparent 50%)`,
            `radial-gradient(1.5px 1.5px at 20% 85%, hsl(${c1} / 0.25) 50%, transparent 50%)`,
            `radial-gradient(1px 1px at 45% 45%, hsl(${c3} / 0.2) 50%, transparent 50%)`,
            `radial-gradient(1px 1px at 90% 10%, hsl(${c1} / 0.15) 50%, transparent 50%)`,
          ].join(","),
          animation: `orb-drift-1 ${speed * 1.67}s linear infinite`,
          opacity: 0.8,
        }}
      />
    </div>
  );
}

// Pages
import Home from "@/pages/Home";
import Menu from "@/pages/Menu";
import ProductDetail from "@/pages/ProductDetail";
import Cart from "@/pages/Cart";
import Reviews from "@/pages/Reviews";
import Info from "@/pages/Info";
import Account from "@/pages/Account";
import AdminDashboard from "@/pages/Admin";
import NotFound from "@/pages/not-found";

function Router() {
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Switch location={location} key={location}>
        <Route path="/" component={Home} />
        
        <Route path="/menu">
          <PageWrapper>
            <Menu />
          </PageWrapper>
        </Route>
        
        <Route path="/product/:id">
          <PageWrapper>
            <ProductDetail />
          </PageWrapper>
        </Route>
        
        <Route path="/cart">
          <PageWrapper>
            <Cart />
          </PageWrapper>
        </Route>
        
        <Route path="/reviews">
          <PageWrapper>
            <Reviews />
          </PageWrapper>
        </Route>
        
        <Route path="/info">
          <PageWrapper>
            <Info />
          </PageWrapper>
        </Route>
        
        <Route path="/account">
          <PageWrapper>
            <Account />
          </PageWrapper>
        </Route>
        
        <Route path="/admin">
          <PageWrapper>
            <AdminDashboard />
          </PageWrapper>
        </Route>
        
        <Route component={NotFound} />
      </Switch>
    </AnimatePresence>
  );
}

// Simple wrapper for page transitions
function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="fixed inset-0 z-0 overflow-hidden">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            src={bgVideoUrl}
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <AnimatedBg />
        <div className="relative z-10 bg-transparent min-h-screen text-foreground font-body antialiased">
          <Router />
          <BottomNav />
          <Toaster />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
