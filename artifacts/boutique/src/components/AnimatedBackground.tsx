import { useEffect, useRef } from "react";

const GOLD = "rgba(201,160,76,";

/* Génère un chemin SVG d'éclair en zigzag */
function boltPath(
  x: number, y1: number, y2: number, spread: number, steps: number
): string {
  const pts: [number, number][] = [[x, y1]];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const jitter = (Math.random() - 0.5) * spread * (1 - t * 0.5);
    pts.push([x + jitter, y1 + (y2 - y1) * t]);
  }
  pts.push([x + (Math.random() - 0.5) * spread * 0.4, y2]);
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
}

interface BoltSpec { id: number; path: string; branchPath?: string; cx: number; animDelay: number; animDur: number }

function generateBolts(count: number, w: number, h: number): BoltSpec[] {
  return Array.from({ length: count }, (_, i) => {
    const x = 40 + Math.random() * (w - 80);
    const endY = h * (0.25 + Math.random() * 0.55);
    const spread = 35 + Math.random() * 45;
    const path = boltPath(x, -8, endY, spread, 8 + Math.floor(Math.random() * 4));
    const hasBranch = Math.random() > 0.45;
    let branchPath: string | undefined;
    if (hasBranch) {
      const branchX = x + (Math.random() - 0.5) * 60;
      const branchY = endY * (0.4 + Math.random() * 0.35);
      const bx2 = branchX + (Math.random() - 0.5) * 70;
      const by2 = branchY + 60 + Math.random() * 80;
      branchPath = boltPath(branchX, branchY, by2, 20, 5);
    }
    return {
      id: i,
      path,
      branchPath,
      cx: x,
      animDelay: Math.random() * 9,
      animDur: 2.5 + Math.random() * 4,
    };
  });
}

export function AnimatedBackground() {
  const svgRef = useRef<SVGSVGElement>(null);

  /* Re-génère les chemins au resize */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    function render() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (!svg) return;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.setAttribute("width", String(w));
      svg.setAttribute("height", String(h));

      const bolts = generateBolts(4, w, h);
      const boltGroup = svg.querySelector("#bolts");
      if (!boltGroup) return;
      boltGroup.innerHTML = bolts.map(b => `
        <g class="bolt-group" style="animation-delay:${b.animDelay}s; animation-duration:${b.animDur}s">
          <!-- glow outer -->
          <path d="${b.path}" stroke="rgba(201,160,76,0.15)" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <!-- glow mid -->
          <path d="${b.path}" stroke="rgba(230,210,150,0.3)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <!-- core -->
          <path d="${b.path}" stroke="rgba(255,252,235,0.85)" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          ${b.branchPath ? `
          <path d="${b.branchPath}" stroke="rgba(201,160,76,0.1)" stroke-width="5" fill="none" stroke-linecap="round"/>
          <path d="${b.branchPath}" stroke="rgba(255,252,235,0.5)" stroke-width="0.7" fill="none" stroke-linecap="round"/>
          ` : ""}
          <!-- flash halo -->
          <ellipse cx="${b.cx}" cy="${window.innerHeight * 0.35}" rx="55" ry="80" fill="rgba(201,160,76,0.04)"/>
        </g>
      `).join("");
    }

    render();
    const obs = new ResizeObserver(render);
    obs.observe(document.body);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Base background */}
      <div className="absolute inset-0" style={{ background: "hsl(28 10% 4%)" }} />

      {/* Ambient top gold orb */}
      <div className="absolute rounded-full" style={{
        width: "70vw", height: "70vw",
        top: "-25vw", left: "15vw",
        background: "radial-gradient(circle, rgba(201,160,76,0.07) 0%, transparent 70%)",
      }} />

      {/* Ambient bottom orb */}
      <div className="absolute rounded-full" style={{
        width: "55vw", height: "55vw",
        bottom: "-15vw", left: "-10vw",
        background: "radial-gradient(circle, rgba(180,120,40,0.05) 0%, transparent 70%)",
      }} />

      {/* SVG lightning bolts — CSS-animated, no JS loop */}
      <svg
        ref={svgRef}
        className="absolute inset-0"
        style={{ overflow: "visible" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <style>{`
            .bolt-group {
              animation: bolt-flash linear infinite;
              opacity: 0;
            }
            @keyframes bolt-flash {
              0%   { opacity: 0; }
              2%   { opacity: 1; }
              5%   { opacity: 0.7; }
              7%   { opacity: 1; }
              10%  { opacity: 0; }
              100% { opacity: 0; }
            }
          `}</style>
        </defs>
        <g id="bolts" />
      </svg>

      {/* Top vignette */}
      <div className="absolute inset-x-0 top-0 h-20" style={{
        background: "linear-gradient(to bottom, rgba(8,6,4,0.6) 0%, transparent 100%)",
      }} />

      {/* Bottom vignette */}
      <div className="absolute inset-x-0 bottom-0 h-1/3" style={{
        background: "linear-gradient(to top, rgba(8,6,4,0.8) 0%, transparent 100%)",
      }} />

      {/* Grain */}
      <div className="absolute inset-0 opacity-[0.025] mix-blend-overlay" style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }} />
    </div>
  );
}
