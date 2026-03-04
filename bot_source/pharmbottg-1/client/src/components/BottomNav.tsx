import { Link, useLocation } from "wouter";
import { Home, ShoppingCart, MessageSquare, Info, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/hooks/use-cart";
import { motion } from "framer-motion";

export function BottomNav() {
  const [location] = useLocation();
  const { data: cartItems } = useCart();
  
  const cartItemCount = cartItems?.reduce((acc, item) => acc + item.quantity, 0) || 0;

  const links = [
    { href: "/menu", icon: Home, label: "Menu" },
    { href: "/cart", icon: ShoppingCart, label: "Panier", badge: cartItemCount },
    { href: "/account", icon: User, label: "Compte" },
    { href: "/reviews", icon: MessageSquare, label: "Avis" },
    { href: "/info", icon: Info, label: "Infos" },
  ];

  // Show nav on all pages except the landing page - but if they came from menu they see it
  // Only hide on exact landing page with no history

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
      <div className="mx-3 mb-3 rounded-2xl bg-card/95 backdrop-blur-xl border border-primary/20 shadow-lg shadow-primary/10">
        <div className="flex items-center justify-around h-16 px-2">
          {links.map((link) => {
            const isActive = location === link.href;
            const Icon = link.icon;
            
            return (
              <Link key={link.href} href={link.href} className={cn(
                "relative flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-all duration-200 rounded-xl mx-1",
                isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}>
                <div className="relative">
                  <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
                  {link.badge !== undefined && link.badge > 0 && (
                    <motion.span 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-primary/30"
                    >
                      {link.badge}
                    </motion.span>
                  )}
                </div>
                <span className={cn("text-[10px] font-medium tracking-wide", isActive && "font-bold")}>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
