import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BottomNav } from "@/components/BottomNav";
import { AnimatePresence, motion } from "framer-motion";
import backgroundImage from "@assets/background.png";

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
        <div 
          className="fixed inset-0 z-0"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.85)), url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            backgroundAttachment: 'fixed',
            backgroundRepeat: 'no-repeat'
          }}
        />
        <div className="animated-bg">
          <div className="animated-bg-orb animated-bg-orb-1" />
          <div className="animated-bg-orb animated-bg-orb-2" />
          <div className="animated-bg-orb animated-bg-orb-3" />
          <div className="animated-bg-particles" />
        </div>
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
