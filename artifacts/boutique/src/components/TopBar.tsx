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
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-40 pt-safe"
      style={{
        background: "rgba(10, 7, 5, 0.85)",
        backdropFilter: "blur(24px) saturate(150%)",
        WebkitBackdropFilter: "blur(24px) saturate(150%)",
        borderBottom: "1px solid rgba(201, 160, 76, 0.08)",
      }}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Back button */}
        <Link
          href={backHref}
          className="w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-90 shrink-0"
          style={{
            background: "rgba(201, 160, 76, 0.06)",
            border: "1px solid rgba(201, 160, 76, 0.15)",
          }}
        >
          <ArrowLeft className="w-4 h-4" style={{ color: "rgba(201,160,76,0.8)" }} />
        </Link>

        {/* Title */}
        {title && (
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-display font-semibold truncate" style={{ letterSpacing: "0.02em" }}>{title}</h1>
            {subtitle && (
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] mt-0.5" style={{ color: "rgba(201,160,76,0.7)" }}>{subtitle}</p>
            )}
          </div>
        )}

        {/* Nav icons */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {navLinks.map(({ href, icon: Icon, badge }) => {
            const isActive = location === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-90",
                  isActive ? "" : "opacity-60 hover:opacity-100"
                )}
                style={{
                  background: isActive ? "rgba(201, 160, 76, 0.12)" : "rgba(201, 160, 76, 0.04)",
                  border: `1px solid ${isActive ? "rgba(201, 160, 76, 0.3)" : "rgba(201, 160, 76, 0.1)"}`,
                  color: isActive ? "rgba(201,160,76,1)" : "rgba(201,160,76,0.7)",
                }}
              >
                <Icon className="w-[15px] h-[15px]" />
                {badge !== undefined && badge > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-0.5 text-[8px] font-bold rounded-full flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, #c9a04c, #f0d070)",
                      color: "#0a0705",
                    }}
                  >
                    {badge}
                  </motion.div>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Gold line */}
      <div className="gold-line" />
    </motion.header>
  );
}
