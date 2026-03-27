import { Link, useLocation } from "wouter";
import { ArrowLeft, ShoppingCart, User, MessageSquare, Info } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { useGetCart } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  backHref?: string;
}

export function TopBar({ title, subtitle, backHref = "/" }: TopBarProps) {
  const [location] = useLocation();
  const { sessionId } = useSession();
  const { data: cartItems } = useGetCart(sessionId, { query: { enabled: !!sessionId } });
  const cartCount = cartItems?.reduce((acc, item) => acc + item.quantity, 0) || 0;

  const navLinks = [
    { href: "/cart", icon: ShoppingCart, badge: cartCount },
    { href: "/account", icon: User },
    { href: "/reviews", icon: MessageSquare },
    { href: "/info", icon: Info },
  ];

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-40 bg-background/80 backdrop-blur-2xl border-b border-white/5 pt-safe"
    >
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Bouton retour */}
        <Link
          href={backHref}
          className="w-10 h-10 glass-panel rounded-full flex items-center justify-center hover:border-purple-500/40 transition-colors shrink-0 active:scale-90"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        {/* Titre */}
        {title && (
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black font-display truncate">{title}</h1>
            {subtitle && (
              <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">{subtitle}</p>
            )}
          </div>
        )}

        {/* Icônes de navigation */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {navLinks.map(({ href, icon: Icon, badge }) => {
            const isActive = location === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative w-9 h-9 glass-panel rounded-full flex items-center justify-center transition-all active:scale-90",
                  isActive ? "border-purple-500/50 text-purple-400" : "hover:border-white/20 text-muted-foreground hover:text-white"
                )}
              >
                <Icon className="w-4 h-4" />
                {badge !== undefined && badge > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-0.5 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm"
                    style={{ background: "linear-gradient(135deg, #a855f7, #06b6d4)" }}
                  >
                    {badge}
                  </motion.div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </motion.header>
  );
}
