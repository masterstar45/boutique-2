import { useEffect, useRef } from "react";

interface Segment { x1: number; y1: number; x2: number; y2: number; w: number }

function buildBolt(
  x1: number, y1: number, x2: number, y2: number,
  disp: number, out: Segment[], depth = 0
) {
  if (disp < 2.5 || depth > 7) {
    out.push({ x1, y1, x2, y2, w: Math.max(0.3, 2.8 - depth * 0.35) });
    return;
  }
  const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * disp;
  const my = (y1 + y2) / 2 + (Math.random() - 0.5) * disp * 0.25;
  buildBolt(x1, y1, mx, my, disp / 2, out, depth + 1);
  buildBolt(mx, my, x2, y2, disp / 2, out, depth + 1);
  if (Math.random() < 0.28 && depth < 4) {
    const bx = mx + (Math.random() - 0.5) * 90;
    const by = my + Math.random() * 120 + 30;
    buildBolt(mx, my, bx, by, disp / 3.5, out, depth + 3);
  }
}

interface Flash {
  segments: Segment[];
  alpha: number;
  phase: "in" | "hold" | "out";
  holdFrames: number;
  glowX: number;
  glowY: number;
}

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashesRef = useRef<Flash[]>([]);
  const rafRef = useRef<number>(0);
  const nextRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    function spawnBolt() {
      const w = canvas!.width;
      const h = canvas!.height;
      const startX = Math.random() * w;
      const endX = startX + (Math.random() - 0.5) * w * 0.4;
      const endY = h * (0.3 + Math.random() * 0.6);
      const segs: Segment[] = [];
      buildBolt(startX, -10, endX, endY, 60 + Math.random() * 60, segs);
      flashesRef.current.push({
        segments: segs,
        alpha: 0,
        phase: "in",
        holdFrames: Math.floor(4 + Math.random() * 6),
        glowX: (startX + endX) / 2,
        glowY: endY / 2,
      });
    }

    function draw() {
      const w = canvas!.width;
      const h = canvas!.height;
      ctx.clearRect(0, 0, w, h);

      // Dark background
      ctx.fillStyle = "hsl(28 10% 4%)";
      ctx.fillRect(0, 0, w, h);

      // Ambient top gold orb
      const grad = ctx.createRadialGradient(w * 0.55, -h * 0.05, 0, w * 0.55, -h * 0.05, w * 0.55);
      grad.addColorStop(0, "rgba(201,160,76,0.07)");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Bottom gold orb
      const grad2 = ctx.createRadialGradient(w * 0.2, h * 1.05, 0, w * 0.2, h * 1.05, w * 0.45);
      grad2.addColorStop(0, "rgba(180,120,40,0.05)");
      grad2.addColorStop(1, "transparent");
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, w, h);

      // Lightning flashes
      const now = performance.now();
      if (now > nextRef.current) {
        spawnBolt();
        nextRef.current = now + 1800 + Math.random() * 3000;
        // Occasional double strike
        if (Math.random() < 0.25) {
          setTimeout(spawnBolt, 80 + Math.random() * 120);
        }
      }

      for (let i = flashesRef.current.length - 1; i >= 0; i--) {
        const f = flashesRef.current[i];

        if (f.phase === "in") {
          f.alpha = Math.min(1, f.alpha + 0.18);
          if (f.alpha >= 1) { f.phase = "hold"; }
        } else if (f.phase === "hold") {
          f.holdFrames--;
          if (f.holdFrames <= 0) { f.phase = "out"; }
        } else {
          f.alpha = Math.max(0, f.alpha - 0.055);
          if (f.alpha <= 0) { flashesRef.current.splice(i, 1); continue; }
        }

        // Glow halo around bolt center
        const glow = ctx.createRadialGradient(f.glowX, f.glowY, 0, f.glowX, f.glowY, 90);
        glow.addColorStop(0, `rgba(220,200,140,${f.alpha * 0.12})`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(f.glowX, f.glowY, 90, 0, Math.PI * 2);
        ctx.fill();

        // Screen flash pulse (very subtle)
        if (f.phase === "in" || (f.phase === "hold" && f.holdFrames > 2)) {
          ctx.fillStyle = `rgba(220,200,140,${f.alpha * 0.03})`;
          ctx.fillRect(0, 0, w, h);
        }

        // Draw segments
        for (const seg of f.segments) {
          // Outer glow
          ctx.beginPath();
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
          ctx.strokeStyle = `rgba(201,160,76,${f.alpha * 0.25})`;
          ctx.lineWidth = seg.w * 5;
          ctx.lineCap = "round";
          ctx.filter = "blur(6px)";
          ctx.stroke();
          ctx.filter = "none";

          // Mid glow
          ctx.beginPath();
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
          ctx.strokeStyle = `rgba(230,210,160,${f.alpha * 0.5})`;
          ctx.lineWidth = seg.w * 2.5;
          ctx.filter = "blur(2px)";
          ctx.stroke();
          ctx.filter = "none";

          // Core bright white
          ctx.beginPath();
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
          ctx.strokeStyle = `rgba(255,252,240,${f.alpha * 0.9})`;
          ctx.lineWidth = seg.w;
          ctx.filter = "none";
          ctx.stroke();
        }
      }

      // Top + bottom vignettes
      const topV = ctx.createLinearGradient(0, 0, 0, h * 0.18);
      topV.addColorStop(0, "rgba(8,6,4,0.65)");
      topV.addColorStop(1, "transparent");
      ctx.fillStyle = topV;
      ctx.fillRect(0, 0, w, h * 0.18);

      const botV = ctx.createLinearGradient(0, h * 0.65, 0, h);
      botV.addColorStop(0, "transparent");
      botV.addColorStop(1, "rgba(8,6,4,0.82)");
      ctx.fillStyle = botV;
      ctx.fillRect(0, h * 0.65, w, h * 0.35);

      rafRef.current = requestAnimationFrame(draw);
    }

    nextRef.current = performance.now() + 600;
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      {/* Subtle noise grain */}
      <div
        className="absolute inset-0 opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
