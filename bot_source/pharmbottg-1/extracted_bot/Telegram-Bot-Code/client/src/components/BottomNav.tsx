import { Link, useLocation } from "wouter";
import { Home, ShoppingCart, MessageSquare, Info } from "lucide-react";
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
    { href: "/reviews", icon: MessageSquare, label: "Avis" },
    { href: "/info", icon: Info, label: "Infos" },
  ];

  // Don't show nav on landing page
  if (location === "/") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-nav pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {links.map((link) => {
          const isActive = location === link.href;
          const Icon = link.icon;
          
          return (
            <Link key={link.href} href={link.href} className={cn(
              "relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}>
              <div className="relative">
                <Icon className={cn("w-6 h-6", isActive && "stroke-[2.5px]")} />
                {link.badge !== undefined && link.badge > 0 && (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center border border-card"
                  >
                    {link.badge}
                  </motion.span>
                )}
              </div>
              <span className="text-[10px] font-medium tracking-wide">{link.label}</span>
              {isActive && (
                <motion.div 
                  layoutId="active-pill"
                  className="absolute bottom-1 w-1 h-1 rounded-full bg-primary"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
