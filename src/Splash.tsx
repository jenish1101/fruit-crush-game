import { useEffect, useState } from 'react';

const SHOW_MS = 2200;
const FADE_MS = 450;

type Props = {
  onDone: () => void;
};

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
      aria-label="Loading Fruit Crush"
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
        <p className="mt-2 text-sm leading-relaxed text-[#6b3f24]/90">
          Created and Maintained by
          <br />
          <span className="text-base font-black text-[#4a2c1a]">Jenish Gondaliya</span>
          <span className="ml-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#4a2c1a] text-[11px] font-black text-[#fff7e8]">
            JG
          </span>
        </p>
      </div>
    </div>
  );
}
