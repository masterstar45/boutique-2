import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  backHref?: string;
}

const GOLD = "rgba(201,160,76,";

export function TopBar({ title, subtitle, backHref = "/" }: TopBarProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-40 pt-safe"
      style={{
        background: "rgba(10,7,4,0.85)",
        backdropFilter: "blur(24px) saturate(150%)",
        WebkitBackdropFilter: "blur(24px) saturate(150%)",
        borderBottom: `1px solid ${GOLD}0.08)`,
      }}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Back button */}
        <Link
          href={backHref}
          className="w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-90 shrink-0"
          style={{
            background: `${GOLD}0.06)`,
            border: `1px solid ${GOLD}0.15)`,
          }}
        >
          <ArrowLeft className="w-4 h-4" style={{ color: `${GOLD}0.8)` }} />
        </Link>

        {/* Title */}
        {title && (
          <div className="flex-1 min-w-0">
            <h1
              className="text-xl font-display font-semibold truncate"
              style={{ letterSpacing: "0.02em" }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className="text-[10px] font-medium uppercase tracking-[0.2em] mt-0.5"
                style={{ color: `${GOLD}0.7)` }}
              >
                {subtitle}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Gold separator */}
      <div className="gold-line" />
    </motion.header>
  );
}
