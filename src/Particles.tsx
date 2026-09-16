import { useEffect, useRef } from 'react';

export type Burst = { x: number; y: number; color: string };

type P = { x: number; y: number; vx: number; vy: number; life: number; c: string; s: number };

export function useParticles() {
  const ref = useRef<((b: Burst[]) => void) | null>(null);
  return ref;
}

export default function Particles({
  api,
}: {
  api: React.MutableRefObject<((b: Burst[]) => void) | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const parts = useRef<P[]>([]);
  const boundsRef = useRef({ w: 320, h: 320 });

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = cv.getBoundingClientRect();
      boundsRef.current = { w: r.width, h: r.height };
      cv.width = Math.max(10, Math.floor(r.width * dpr));
      cv.height = Math.max(10, Math.floor(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    api.current = (bursts) => {
      for (const b of bursts) {
        const count = 7;
        for (let i = 0; i < count; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 80 + Math.random() * 200;
          parts.current.push({
            x: b.x,
            y: b.y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 70,
            life: 0.35 + Math.random() * 0.35,
            c: b.color,
            s: 2 + Math.random() * 4,
          });
        }
      }
      if (parts.current.length > 400) parts.current.splice(0, parts.current.length - 400);
    };

    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.04);
      last = t;
      const { w, h } = boundsRef.current;
      ctx.clearRect(0, 0, w, h);

      const arr = parts.current;
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        p.life -= dt;
        if (p.life <= 0) {
          arr.splice(i, 1);
          continue;
        }
        p.vy += 850 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2.5));
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      api.current = null;
    };
  }, [api]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-30 h-full w-full"
    />
  );
}
