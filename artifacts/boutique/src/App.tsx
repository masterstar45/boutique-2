import { useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { BottomNav } from "@/components/BottomNav";
import { SplashScreen } from "@/components/SplashScreen";

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
  const [splashDone, setSplashDone] = useState(() => {
    // Splash uniquement sur la page d'accueil, ou si déjà vu cette session
    const isHome = window.location.pathname === import.meta.env.BASE_URL.replace(/\/$/, "") || 
                   window.location.pathname === import.meta.env.BASE_URL ||
                   window.location.pathname === "/";
    return !isHome || sessionStorage.getItem("splash_shown") === "1";
  });

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          {!splashDone && <SplashScreen onDone={() => { sessionStorage.setItem("splash_shown", "1"); setSplashDone(true); }} />}
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
