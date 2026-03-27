export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Base warm black */}
      <div className="absolute inset-0" style={{ background: "hsl(28 10% 4%)" }} />

      {/* Background image with strong dark overlay */}
      <img
        src={`${import.meta.env.BASE_URL}bg.png`}
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-center opacity-10 mix-blend-luminosity"
        style={{ imageRendering: "auto" }}
      />

      {/* Top warm gold orb — very subtle */}
      <div
        className="absolute rounded-full"
        style={{
          width: "60vw",
          height: "60vw",
          top: "-20vw",
          left: "20vw",
          background: "radial-gradient(circle, rgba(201,160,76,0.08) 0%, transparent 70%)",
          animation: "float-orb 18s ease-in-out infinite",
        }}
      />

      {/* Bottom-left warm orb */}
      <div
        className="absolute rounded-full"
        style={{
          width: "50vw",
          height: "50vw",
          bottom: "-10vw",
          left: "-10vw",
          background: "radial-gradient(circle, rgba(180,120,40,0.06) 0%, transparent 70%)",
          animation: "float-orb 24s ease-in-out infinite reverse",
        }}
      />

      {/* Subtle bottom vignette */}
      <div className="absolute inset-x-0 bottom-0 h-1/3" style={{
        background: "linear-gradient(to top, rgba(8,6,4,0.8) 0%, transparent 100%)"
      }} />

      {/* Top vignette */}
      <div className="absolute inset-x-0 top-0 h-24" style={{
        background: "linear-gradient(to bottom, rgba(8,6,4,0.6) 0%, transparent 100%)"
      }} />

      {/* Subtle noise grain */}
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
