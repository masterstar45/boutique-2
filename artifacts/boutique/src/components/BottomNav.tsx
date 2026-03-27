import { Link, useLocation } from "wouter";
import { Home, LayoutGrid, ShoppingCart, User, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useGetCart } from "@workspace/api-client-react";
import { useSession } from "@/hooks/use-session";

export function BottomNav() {
  const [location] = useLocation();
  const { sessionId } = useSession();
  const { data: cartItems } = useGetCart(sessionId, { query: { enabled: !!sessionId } });

  const itemCount = cartItems?.reduce((acc, item) => acc + item.quantity, 0) || 0;

  const links = [
    { href: "/", icon: Home, label: "Accueil" },
    { href: "/menu", icon: LayoutGrid, label: "Menu" },
    { href: "/cart", icon: ShoppingCart, label: "Panier", badge: itemCount },
    { href: "/account", icon: User, label: "Compte" },
    { href: "/reviews", icon: MessageSquare, label: "Avis" },
  ];

  // Don't show on admin routes
  if (location.startsWith("/admin")) return null;

  return (
    <motion.nav 
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe pt-2 bg-background/80 backdrop-blur-2xl border-t border-white/10"
    >
      <div className="max-w-md mx-auto flex items-center justify-between gap-1">
        {links.map((link) => {
          const isActive = location === link.href || (link.href !== '/' && location.startsWith(link.href));
          const Icon = link.icon;

          return (
            <Link key={link.href} href={link.href} className="relative flex-1 flex flex-col items-center justify-center h-14 group outline-none">
              <div className="relative z-10 flex flex-col items-center justify-center transition-transform duration-300 active:scale-90">
                <div className={cn(
                  "p-2 rounded-xl transition-all duration-300 relative",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}>
                  <Icon className={cn("w-[22px] h-[22px]", isActive && "stroke-[2.5px]")} />
                  
                  {link.badge !== undefined && link.badge > 0 && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm"
                    >
                      {link.badge}
                    </motion.div>
                  )}
                </div>
                
                <span className={cn(
                  "text-[10px] font-medium tracking-wide transition-all duration-300 absolute -bottom-1 opacity-0 translate-y-2",
                  isActive && "opacity-100 translate-y-0 text-primary"
                )}>
                  {link.label}
                </span>
              </div>
              
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className="absolute inset-0 bg-primary/10 rounded-2xl z-0 overflow-hidden"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                >
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary/40 blur-md rounded-full" />
                </motion.div>
              )}
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
