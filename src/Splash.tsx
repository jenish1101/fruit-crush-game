import { useEffect, useState } from 'react';

const SHOW_MS = 2200;
const FADE_MS = 450;

type Props = {
  onDone: () => void;
};

function JgLogo() {
  return (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
      <svg
        className="h-10 w-10 drop-shadow-md"
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="jgBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff7a8a" />
            <stop offset="50%" stopColor="#e07a5f" />
            <stop offset="100%" stopColor="#f2b705" />
          </linearGradient>
          <linearGradient id="jgGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor="#ffe6a7" />
            <stop offset="100%" stopColor="#ffd23f" />
          </linearGradient>
        </defs>
        {/* Outer squircle with warm gradient */}
        <rect x="2" y="2" width="40" height="40" rx="12" fill="url(#jgBgGrad)" />
        <rect
          x="3"
          y="3"
          width="38"
          height="38"
          rx="11"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1.5"
        />
        {/* Stylized JG monogram */}
        <text
          x="22"
          y="28"
          textAnchor="middle"
          fill="url(#jgGoldGrad)"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="16"
          letterSpacing="0.8"
          style={{ filter: 'drop-shadow(0px 1px 2px rgba(74, 44, 26, 0.45))' }}
        >
          JG
        </text>
      </svg>
    </div>
  );
}

export default function Splash({ onDone }: Props) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const fade = window.setTimeout(() => setLeaving(true), SHOW_MS);
    const done = window.setTimeout(() => onDone(), SHOW_MS + FADE_MS);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div
      className={`fc-splash fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 text-center ${
        leaving ? 'fc-splash-out' : ''
      }`}
      role="status"
      aria-live="polite"
      aria-label="Loading Fruit Crush - Developed and maintained by Jenish Gondaliya"
    >
      <div className="fc-splash-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative z-10 flex max-w-sm flex-col items-center gap-5">
        <div className="text-5xl fc-bounce sm:text-6xl" aria-hidden>
          🍓🍋🍇
        </div>
        <h1 className="bg-gradient-to-r from-[#e07a5f] via-[#ff7a8a] to-[#f2b705] bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
          FRUIT CRUSH
        </h1>
        <div className="fc-splash-bar h-1.5 w-40 overflow-hidden rounded-full bg-white/50 ring-1 ring-[#efd5b8]">
          <div className="fc-splash-bar-fill h-full rounded-full bg-gradient-to-r from-[#ff7a8a] to-[#ffd23f]" />
        </div>

        {/* Developer Credit & JG Logo Badge */}
        <div className="mt-2 flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-2.5 shadow-md shadow-orange-900/10 ring-1 ring-[#efd5b8] backdrop-blur-md">
          <JgLogo />
          <div className="flex flex-col text-left leading-tight">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9a6b45]">
              Developed &amp; Maintained by
            </span>
            <span className="text-sm font-extrabold text-[#4a2c1a]">
              Jenish Gondaliya
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
