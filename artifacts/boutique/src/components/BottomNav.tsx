import { Link, useLocation } from "wouter";
import { Home, LayoutGrid, ShoppingBag, User } from "lucide-react";
import { motion } from "framer-motion";
import { useSession } from "@/hooks/use-session";
import { useGetCart } from "@workspace/api-client-react";

const LINKS = [
  { href: "/",        label: "Accueil",   Icon: Home       },
  { href: "/menu",    label: "Catalogue", Icon: LayoutGrid },
  { href: "/cart",    label: "Panier",    Icon: ShoppingBag, badge: true },
  { href: "/account", label: "Compte",   Icon: User       },
];

const GOLD = "rgba(201,160,76,";
const GOLD_GRAD = "linear-gradient(135deg, #c9a04c 0%, #f0d070 50%, #d4a843 100%)";

export function BottomNav() {
  const [location] = useLocation();
  const { sessionId } = useSession();
  const { data: cartItems } = useGetCart(sessionId, { query: { enabled: !!sessionId } });
  const cartCount = cartItems?.reduce((acc, i) => acc + i.quantity, 0) || 0;

  /* Cache sur pages sans nav */
  const hidden = location.startsWith("/admin");
  if (hidden) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-50 flex justify-center pb-safe"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
    >
      <nav
        className="flex items-center gap-1 px-3 py-2.5 rounded-[2rem]"
        style={{
          background: "rgba(10,7,4,0.88)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          border: `1px solid ${GOLD}0.14)`,
          boxShadow: `0 -2px 0 0 ${GOLD}0.06), 0 8px 40px rgba(0,0,0,0.55), 0 2px 0 0 ${GOLD}0.04) inset`,
          width: "min(340px, calc(100vw - 32px))",
        }}
      >
        {LINKS.map(({ href, label, Icon, badge }) => {
          const exact = href === "/" ? location === "/" || location === "" : location.startsWith(href);
          const isActive = exact;
          const count = badge ? cartCount : 0;

          return (
            <Link key={href} href={href} className="flex-1 flex flex-col items-center gap-1 py-1 relative group">
              <div className="relative">
                {/* Active background pill */}
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 -m-2.5 rounded-2xl"
                    style={{ background: `${GOLD}0.1)` }}
                    transition={{ type: "spring", bounce: 0.25, duration: 0.4 }}
                  />
                )}

                {/* Icon */}
                <div className="relative z-10 w-6 h-6 flex items-center justify-center">
                  <Icon
                    className="w-[19px] h-[19px] transition-all duration-200"
                    style={isActive
                      ? { color: `${GOLD}1)`, filter: `drop-shadow(0 0 6px ${GOLD}0.5))` }
                      : { color: `${GOLD}0.38)` }
                    }
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                </div>

                {/* Cart badge */}
                {badge && count > 0 && (
                  <motion.div
                    key={count}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full flex items-center justify-center z-20"
                    style={{ background: GOLD_GRAD, color: "#080603" }}
                  >
                    {count}
                  </motion.div>
                )}
              </div>

              {/* Label */}
              <span
                className="text-[9px] font-medium tracking-[0.06em] transition-all duration-200"
                style={isActive
                  ? { color: `${GOLD}0.9)`, fontWeight: 600 }
                  : { color: `${GOLD}0.35)` }
                }
              >
                {label}
              </span>

              {/* Active dot */}
              {isActive && (
                <motion.div
                  layoutId="nav-dot"
                  className="absolute -bottom-1 w-1 h-1 rounded-full"
                  style={{ background: GOLD_GRAD }}
                  transition={{ type: "spring", bounce: 0.25, duration: 0.4 }}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
