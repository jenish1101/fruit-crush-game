import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CHAPTERS, LEVELS, chapterOf, fogFor, totalStars, type Progress } from './levels';

const STEP = 74;
const PAD = 46;
const CH_GAP = 66;

function nodePos(i: number, w: number, amp: number) {
  const x = w / 2 + Math.sin(i * 0.85) * amp + Math.sin(i * 0.31) * (amp * 0.3);
  const y = PAD + i * STEP + Math.floor(i / 100) * CH_GAP;
  return { x, y };
}

export default function LevelMap({
  progress,
  onPlay,
  onBack,
}: {
  progress: Progress;
  onPlay: (n: number) => void;
  onBack: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const roadRef = useRef<HTMLDivElement>(null);
  const current = Math.min(progress.unlocked, LEVELS.length);
  const [view, setView] = useState({ top: 0, h: 800 });
  const [W, setW] = useState(340);

  const amp = useMemo(() => Math.max(42, Math.min(W * 0.32, 118)), [W]);

  useLayoutEffect(() => {
    const measure = () => {
      const el = roadRef.current;
      if (!el) return;
      setW(Math.max(200, Math.floor(el.clientWidth)));
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  const pts = useMemo(() => LEVELS.map((_, i) => nodePos(i, W, amp)), [W, amp]);
  const height = pts[pts.length - 1].y + PAD + 60;

  const path = useMemo(() => {
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const my = (p0.y + p1.y) / 2;
      d += ` C ${p0.x} ${my}, ${p1.x} ${my}, ${p1.x} ${p1.y}`;
    }
    return d;
  }, [pts]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = Math.max(0, nodePos(current - 1, W, amp).y - el.clientHeight * 0.6);
    setView({ top: el.scrollTop, h: el.clientHeight });
  }, [current, W, amp]);

  const onScroll = () => {
    const el = scroller.current;
    if (el) setView({ top: el.scrollTop, h: el.clientHeight });
  };

  const lo = Math.max(0, Math.floor((view.top - 420) / STEP));
  const hi = Math.min(LEVELS.length, Math.ceil((view.top + view.h + 420) / STEP));
  const visible = LEVELS.slice(lo, hi);

  const ch = chapterOf(current);
  const nodeSize = W < 300 ? 46 : 56;

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-full flex-col overflow-hidden sm:max-w-[560px]">
      {/* header — always fits, never scrolls horizontally */}
      <header className="z-10 flex shrink-0 items-center justify-between gap-2 px-3 py-3 sm:px-4">
        <button
          onClick={onBack}
          className="shrink-0 rounded-xl bg-white/85 px-3 py-2 text-sm font-bold text-[#6b3f24] shadow-sm ring-1 ring-[#efd5b8] backdrop-blur transition hover:bg-white active:scale-95 cursor-pointer"
        >
          ←
        </button>
        <div className="min-w-0 flex-1 text-center leading-tight">
          <div className="truncate text-sm font-black tracking-tight text-[#4a2c1a] sm:text-base">
            {ch.icon} {ch.title}
          </div>
          <div className="text-[11px] text-[#9a6b45]">
            Level {current} / {LEVELS.length}
          </div>
        </div>
        <div className="shrink-0 rounded-xl bg-[#fff1dc] px-3 py-2 text-sm font-black text-[#e07a5f] ring-1 ring-[#ffd6a5] shadow-sm">
          ★ {totalStars(progress)}
        </div>
      </header>

      {/* chapter jump — wraps to new lines on narrow screens instead of x-scrolling */}
      <div className="z-10 flex shrink-0 flex-wrap justify-center gap-1.5 px-3 pb-2 sm:px-4">
        {CHAPTERS.map((c) => {
          const reached = progress.unlocked >= c.from;
          return (
            <button
              key={c.from}
              disabled={!reached}
              onClick={() => {
                const el = scroller.current;
                if (el) el.scrollTo({ top: Math.max(0, nodePos(c.from - 1, W, amp).y - 120), behavior: 'smooth' });
              }}
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 transition cursor-pointer sm:text-[11px] ${
                reached
                  ? 'bg-white/85 text-[#6b3f24] ring-[#efd5b8] hover:bg-white'
                  : 'bg-white/45 text-[#c4a07a] ring-[#efd5b8]/60'
              }`}
            >
              {reached ? `${c.icon} ${c.from}–${c.to}` : `☁️ ${c.from}–${c.to}`}
            </button>
          );
        })}
      </div>

      {/* road — vertical only, width fits viewport exactly */}
      <div
        ref={scroller}
        onScroll={onScroll}
        className="fc-scroll relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-3xl bg-white/55 ring-1 ring-white/80 shadow-inner backdrop-blur-sm sm:mx-2"
      >
        <div
          ref={roadRef}
          className="relative mx-auto w-full overflow-hidden"
          style={{ height, maxWidth: 520 }}
        >
          <svg width={W} height={height} className="pointer-events-none absolute inset-0">
            <path d={path} fill="none" stroke="rgba(224,122,95,.18)" strokeWidth={30} strokeLinecap="round" />
            <path
              d={path}
              fill="none"
              stroke="rgba(242,183,5,.55)"
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray="2 18"
            />
          </svg>

          {CHAPTERS.slice(1).map((c) => {
            const y = nodePos(c.from - 1, W, amp).y - STEP / 2 - CH_GAP / 2;
            const reached = progress.unlocked >= c.from - 1;
            return (
              <div
                key={c.from}
                className="pointer-events-none absolute left-1/2 z-20 w-[min(300px,90%)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#efd5b8] bg-white/80 px-3 py-2 text-center shadow-sm backdrop-blur-sm"
                style={{ top: y }}
              >
                <div className={`text-xs font-black ${reached ? 'text-[#4a2c1a]' : 'text-[#b07a4a]'} sm:text-sm`}>
                  {reached ? `${c.icon} ${c.title}` : `☁️ ${'? '.repeat(3)}`}
                </div>
                <div className="text-[10px] leading-snug text-[#9a6b45]">
                  {reached
                    ? `Levels ${c.from}–${c.to}`
                    : `Something stirs beyond the clouds… clear level ${c.from - 1} to part the mist`}
                </div>
              </div>
            );
          })}

          {visible.map((lv) => {
            const i = lv.n - 1;
            const { x, y } = nodePos(i, W, amp);
            const stars = progress.stars[lv.n] || 0;
            const unlocked = lv.n <= progress.unlocked;
            const isCurrent = lv.n === current;
            const fog = fogFor(lv.n, progress.unlocked);
            const hidden = fog > 0.85;
            return (
              <button
                key={lv.n}
                disabled={!unlocked}
                onClick={() => unlocked && onPlay(lv.n)}
                title={hidden ? 'Shrouded in mist' : `${lv.name} · target ${lv.target}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 transition active:scale-90 disabled:cursor-not-allowed cursor-pointer"
                style={{
                  left: x,
                  top: y,
                  filter: fog ? `blur(${(fog * 4).toFixed(1)}px)` : undefined,
                  opacity: 1 - fog * 0.45,
                }}
              >
                <div
                  className={`relative flex items-center justify-center rounded-full text-base font-black shadow-lg ring-4 sm:text-lg ${
                    !unlocked
                      ? 'bg-white/75 text-[#c4a07a] ring-[#efd5b8]/70'
                      : stars > 0
                        ? 'bg-gradient-to-br from-[#8ee08a] to-[#4caf50] text-white ring-white/70'
                        : 'bg-gradient-to-br from-[#ff7a8a] to-[#ffd23f] text-[#4a2c1a] ring-white/80'
                  } ${isCurrent ? 'fc-bounce' : ''}`}
                  style={{ width: nodeSize, height: nodeSize }}
                >
                  {hidden ? '☁️' : unlocked ? lv.n : '🔒'}
                  {isCurrent && (
                    <span className="absolute -inset-2 animate-ping rounded-full border-2 border-[#f2b705]/60" />
                  )}
                </div>
                {unlocked && (
                  <div className="mt-0.5 text-center text-[9px] leading-none text-[#f2b705] drop-shadow sm:text-[11px]">
                    {[0, 1, 2].map((s) => (
                      <span key={s} className={s < stars ? '' : 'opacity-25'}>
                        ★
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}

          {/* mist over the unexplored stretch */}
          <div
            className="pointer-events-none absolute left-0 right-0 z-10"
            style={{ top: nodePos(Math.max(0, current + 2), W, amp).y, bottom: 0 }}
          >
            <div className="h-24 bg-gradient-to-b from-transparent to-white/45" />
            <div className="h-full bg-white/45 backdrop-blur-[2px]">
              <div className="fc-mist absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,255,255,.55),transparent_60%),radial-gradient(ellipse_at_70%_60%,rgba(255,236,210,.5),transparent_55%)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
