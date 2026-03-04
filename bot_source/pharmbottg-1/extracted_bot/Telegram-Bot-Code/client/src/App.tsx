import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BottomNav } from "@/components/BottomNav";
import { AnimatePresence, motion } from "framer-motion";

// Pages
import Home from "@/pages/Home";
import Menu from "@/pages/Menu";
import Cart from "@/pages/Cart";
import Reviews from "@/pages/Reviews";
import Info from "@/pages/Info";
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
        
        <Route component={NotFound} />
      </Switch>
    </AnimatePresence>
  );
}

// Simple wrapper for page transitions
function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="bg-background min-h-screen text-foreground font-body antialiased">
          <Router />
          <BottomNav />
          <Toaster />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
