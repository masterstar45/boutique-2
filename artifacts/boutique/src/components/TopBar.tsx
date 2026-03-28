import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  backHref?: string;
  branded?: boolean;
}

const GOLD = "rgba(201,160,76,";
const GOLD_GRAD = "linear-gradient(135deg, #c9a04c 0%, #f0d070 45%, #d4a843 100%)";

export function TopBar({ title, subtitle, backHref = "/", branded = false }: TopBarProps) {
  return (
    <header
      className="sticky top-0 z-40 pt-safe"
      style={{
        background: branded
          ? "rgba(8,6,3,0.92)"
          : "rgba(10,7,4,0.85)",
        backdropFilter: "blur(24px) saturate(150%)",
        WebkitBackdropFilter: "blur(24px) saturate(150%)",
        borderBottom: branded
          ? `1px solid ${GOLD}0.18)`
          : `1px solid ${GOLD}0.08)`,
      }}
    >
      {/* Subtle ambient glow behind the brand name */}
      {branded && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 60% 80% at 50% -20%, rgba(201,160,76,0.10) 0%, transparent 70%)",
          }}
        />
      )}

      <div className="px-4 py-3 flex items-center gap-3 relative">
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
        {branded ? (
          <div className="flex-1 flex flex-col items-start">
            {/* Brand name with gold gradient + glow */}
            <h1
              className="font-display font-black leading-none select-none"
              style={{
                fontSize: "1.25rem",
                letterSpacing: "0.12em",
                background: GOLD_GRAD,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 0 8px rgba(201,160,76,0.55))",
              }}
            >
              🔌 SOS LE PLUG 🔌
            </h1>
            {subtitle && (
              <p
                className="text-[9px] font-bold uppercase tracking-[0.28em] mt-0.5"
                style={{ color: `${GOLD}0.55)` }}
              >
                {subtitle}
              </p>
            )}
          </div>
        ) : title ? (
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
        ) : null}
      </div>

      {/* Gold separator — more vivid in branded mode */}
      <div
        className="gold-line"
        style={branded ? { opacity: 0.6 } : undefined}
      />
    </header>
  );
}
