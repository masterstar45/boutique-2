import { Link, useLocation } from "wouter";
import { Home, ShoppingBag, MessageSquareText, Info, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/hooks/use-cart";
import { motion } from "framer-motion";

export function BottomNav() {
  const [location] = useLocation();
  const { data: cartItems } = useCart();
  
  const cartItemCount = cartItems?.reduce((acc, item) => acc + item.quantity, 0) || 0;

  const links = [
    { href: "/menu", icon: Home, label: "Menu" },
    { href: "/cart", icon: ShoppingBag, label: "Panier", badge: cartItemCount },
    { href: "/account", icon: UserRound, label: "Compte" },
    { href: "/reviews", icon: MessageSquareText, label: "Avis" },
    { href: "/info", icon: Info, label: "Infos" },
  ];

  // Hide on home page
  if (location === "/") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe pointer-events-none">
      <div className="mx-4 mb-4 pointer-events-auto">
        <div className="glass-panel rounded-[2rem] p-2 flex items-center justify-between shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]">
          {links.map((link) => {
            const isActive = location === link.href;
            const Icon = link.icon;
            
            return (
              <Link key={link.href} href={link.href} className="relative flex-1 flex flex-col items-center justify-center h-14 group">
                <div className="relative z-10 flex flex-col items-center justify-center transition-transform duration-300 group-active:scale-90">
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
                    className="absolute inset-0 bg-primary/10 rounded-2xl z-0"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}