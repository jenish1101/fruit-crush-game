import { useCallback, useEffect, useRef, useState } from 'react';
import Particles, { useParticles, type Burst } from './Particles';
import LevelMap from './LevelMap';
import Sky from './Sky';
import { isMuted, setMuted, sfx } from './sound';
import {
  LEVELS,
  loadProgress,
  saveProgress,
  starsFor,
  type Level,
  type Progress,
} from './levels';
import {
  FRUITS,
  FRUIT_COLORS,
  SIZE,
  blastCells,
  collapseBoard,
  findMatches,
  findRuns,
  hasMove,
  idx,
  isAdjacent,
  loadScores,
  makeBoard,
  saveScore,
  swapped,
  type Cell,
  type Run,
  type Score,
} from './game';

type Phase = 'menu' | 'map' | 'playing' | 'paused' | 'won' | 'over';
type Mode = 'level' | 'endless';
const START_TIME = 60;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function rnd(a: number) {
  return (Math.random() * 2 - 1) * a;
}

const ZERO_SP = () => new Array(SIZE * SIZE).fill(0);

export default function App() {
  const [phase, setPhase] = useState<Phase>('menu');
  const [mode, setMode] = useState<Mode>('level');
  const [level, setLevel] = useState<Level>(LEVELS[0]);
  const [progress, setProgress] = useState<Progress>(() => loadProgress());

  const [board, setBoard] = useState<Cell[]>(() => makeBoard(4));
  const [specials, setSpecials] = useState<number[]>(ZERO_SP); // 0 none, 1 bomb, 2 mega
  const [popping, setPopping] = useState<Set<number>>(new Set());
  const [fall, setFall] = useState<number[]>(() => new Array(SIZE * SIZE).fill(0));
  const [sel, setSel] = useState<number | null>(null);
  const [cursor, setCursor] = useState(idx(4, 4));
  const [shake, setShake] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [moves, setMoves] = useState(10);
  const [time, setTime] = useState(START_TIME);
  const [scores, setScores] = useState<Score[]>(() => loadScores());
  const [floats, setFloats] = useState<{ id: number; x: number; y: number; text: string }[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);
  const [earned, setEarned] = useState(0);
  const [msg, setMsg] = useState<{ id: number; text: string } | null>(null);
  const [muted, setMutedState] = useState(isMuted());

  // Synchronized state refs to prevent any closure bugs or pending freezes
  const busy = useRef(false);
  const boardRef = useRef<Cell[]>(board);
  const specialsRef = useRef<number[]>(specials);
  const scoreRef = useRef(0);
  const movesRef = useRef(10);
  const phaseRef = useRef<Phase>(phase);
  const modeRef = useRef<Mode>(mode);
  const levelRef = useRef<Level>(level);
  const gridRef = useRef<HTMLDivElement>(null);
  const partApi = useParticles();
  const floatId = useRef(0);
  const msgId = useRef(0);
  const down = useRef<{ i: number; x: number; y: number } | null>(null);

  // Keep references in sync with latest render
  phaseRef.current = phase;
  modeRef.current = mode;
  levelRef.current = level;
  boardRef.current = board;
  specialsRef.current = specials;

  const kinds = mode === 'level' ? level.kinds : 6;

  const cellRect = useCallback((i: number) => {
    const el = gridRef.current;
    if (!el) return { x: 0, y: 0 };
    const w = el.clientWidth / SIZE;
    return { x: (i % SIZE) * w + w / 2, y: Math.floor(i / SIZE) * w + w / 2 };
  }, []);

  const showMsg = useCallback((text: string) => {
    const id = ++msgId.current;
    setMsg({ id, text });
    setTimeout(() => setMsg((m) => (m && m.id === id ? null : m)), 1000);
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) sfx.unlock();
  };

  // Endless timer
  useEffect(() => {
    if (phase !== 'playing' || mode !== 'endless') return;
    const t = setInterval(() => setTime((v) => (v <= 0.1 ? 0 : v - 0.1)), 100);
    return () => clearInterval(t);
  }, [phase, mode]);

  useEffect(() => {
    if (phase === 'playing' && mode === 'endless' && time <= 0) {
      setPhase('over');
      setScores(saveScore(Math.round(scoreRef.current)));
      sfx.lose();
    }
  }, [time, phase, mode]);

  const addFloat = useCallback(
    (i: number, text: string) => {
      const { x, y } = cellRect(i);
      const id = floatId.current++;
      setFloats((f) => [...f, { id, x, y, text }]);
      setTimeout(() => setFloats((f) => f.filter((z) => z.id !== id)), 700);
    },
    [cellRect],
  );

  const finishLevel = useCallback((finalScore: number) => {
    const curLevel = levelRef.current;
    const st = starsFor(curLevel, finalScore);
    setEarned(st);
    if (st > 0) {
      sfx.win();
      for (let i = 0; i < st; i++) setTimeout(() => sfx.star(i), 350 + i * 220);
      setProgress((prev) => {
        const next = {
          stars: { ...prev.stars, [curLevel.n]: Math.max(prev.stars[curLevel.n] || 0, st) },
          unlocked: Math.max(prev.unlocked, Math.min(LEVELS.length, curLevel.n + 1)),
        };
        return saveProgress(next);
      });
      setPhase('won');
    } else {
      sfx.lose();
      setPhase('over');
    }
  }, []);

  /** Chain-detonate every bomb inside `cleared`; mutates sp; returns blast stats */
  const detonate = (cleared: Set<number>, sp: number[]) => {
    let bombs = 0;
    let megas = 0;
    const queue = [...cleared].filter((i) => sp[i] > 0);
    while (queue.length) {
      const i = queue.pop()!;
      const type = sp[i];
      sp[i] = 0;
      if (type >= 2) megas++;
      else bombs++;
      for (const t of blastCells(i, type)) {
        if (!cleared.has(t)) {
          cleared.add(t);
          if (sp[t] > 0) queue.push(t);
        }
      }
    }
    return { bombs, megas };
  };

  const resolve = useCallback(
    async (start: Cell[], startSp: number[], swapA?: number, swapC?: number, ignite: number[] = []) => {
      let b = start;
      let sp = startSp.slice();
      let chain = 0;
      let total = 0;
      let firstPass = true;

      while (true) {
        let cleared: Set<number>;
        let runs: Run[] = [];
        let createdBomb = false;
        let createdMega = false;

        if (firstPass && ignite.length) {
          // A bomb was swapped directly — detonate it immediately
          cleared = new Set(ignite);
          firstPass = false;
        } else {
          runs = findRuns(b);
          if (!runs.length) break;
          firstPass = false;
          cleared = new Set<number>();
          runs.forEach((r) => r.cells.forEach((i) => cleared.add(i)));

          // Forge specials: 5+ → mega bomb, 4 → bomb (prefer the swapped cell)
          const pickCell = (cells: number[]) => {
            if (swapA !== undefined && cells.includes(swapA)) return swapA;
            if (swapC !== undefined && cells.includes(swapC)) return swapC;
            return cells[Math.floor(cells.length / 2)];
          };
          const sorted = runs.slice().sort((x, y) => y.cells.length - x.cells.length);
          for (const run of sorted) {
            if (run.cells.length >= 5) {
              const cell = pickCell(run.cells);
              sp[cell] = 2;
              cleared.delete(cell);
              createdMega = true;
            } else if (run.cells.length === 4) {
              const cell = pickCell(run.cells);
              if (sp[cell] === 0) {
                sp[cell] = 1;
                cleared.delete(cell);
                createdBomb = true;
              }
            }
          }
        }

        // Bombs caught in the blast go off too — chain reaction!
        const { bombs, megas } = detonate(cleared, sp);

        chain++;
        setCombo(chain);
        const pts = Math.round(cleared.size * 10 * (1 + (chain - 1) * 0.5));
        total += pts;
        scoreRef.current += pts;
        setScore(scoreRef.current);

        if (modeRef.current === 'endless') {
          setTime((t) => Math.min(START_TIME, t + cleared.size * 0.35));
        }

        // juicy feedback
        const bursts: Burst[] = [];
        for (const i of cleared) {
          const { x, y } = cellRect(i);
          bursts.push({ x, y, color: b[i] >= 0 ? FRUIT_COLORS[b[i]] : '#ff922b' });
        }
        partApi.current?.(bursts);
        addFloat([...cleared][0], `+${pts}${chain > 1 ? ` x${chain}` : ''}`);

        if (bombs + megas > 0) {
          if (megas > 0) sfx.mega();
          else sfx.bomb();
          setShake(Math.min(18, 8 + (bombs + megas) * 3));
        } else {
          sfx.pop(chain);
          setShake(Math.min(10, 3 + cleared.size + chain * 1.5));
        }
        setTimeout(() => setShake(0), 200);

        // hype messages
        let text: string | null = null;
        if (createdMega) text = 'MEGA BLAST! 🌈';
        else if (createdBomb) text = 'SWEET! 💣';
        else if (bombs + megas >= 3) text = 'CHAIN REACTION! 💥';
        else if (megas > 0) text = 'MEGA CHAIN! 🌈';
        else if (bombs > 0) text = 'BOOM! 💥';
        else if (runs.length >= 3) text = 'TRIPLE TREAT! 🍭';
        else if (runs.length === 2) text = 'DOUBLE JUICE! 🧃';
        else if (chain >= 4) text = 'SUGAR RUSH! 🍬';
        else if (chain === 3) text = 'DELICIOUS! 😋';
        else if (chain === 2) text = 'TASTY! 🍓';
        if (text) showMsg(text);

        setPopping(new Set(cleared));
        await sleep(110);

        const res = collapseBoard(b, sp, cleared, kinds);
        b = res.board;
        sp = res.specials;
        setPopping(new Set());
        setFall(res.fall);
        setBoard(b);
        setSpecials(sp);
        await sleep(120);
        setFall(new Array(SIZE * SIZE).fill(0));
      }

      if (!hasMove(b)) {
        b = makeBoard(kinds);
        sp = ZERO_SP();
        setBoard(b);
        setSpecials(sp);
        addFloat(idx(4, 4), 'shuffle!');
        await sleep(120);
      }

      setCombo(0);
      return total;
    },
    [cellRect, partApi, kinds, addFloat, showMsg],
  );

  const tryMove = useCallback(
    async (a: number, c: number) => {
      if (busy.current || phaseRef.current !== 'playing') return;
      if (!isAdjacent(a, c)) {
        setSel(c);
        return;
      }
      busy.current = true;
      setSel(null);

      try {
        const curBoard = boardRef.current;
        const curSp = specialsRef.current;
        const nb = swapped(curBoard, a, c);
        const nsp = curSp.slice();
        [nsp[a], nsp[c]] = [nsp[c], nsp[a]];

        // Swapping a bomb always detonates it
        const ignite: number[] = [];
        if (curSp[a] > 0) ignite.push(c); // bomb moved to c
        if (curSp[c] > 0) ignite.push(a); // bomb moved to a

        if (!ignite.length && findMatches(nb).size === 0) {
          sfx.bad();
          setWrong(c);
          setBoard(nb);
          setSpecials(nsp);
          await sleep(110);
          setBoard(curBoard);
          setSpecials(curSp);
          setTimeout(() => setWrong(null), 120);
          return;
        }

        sfx.swap();
        if (modeRef.current === 'level') {
          movesRef.current = Math.max(0, movesRef.current - 1);
          setMoves(movesRef.current);
        }

        boardRef.current = nb;
        specialsRef.current = nsp;
        setBoard(nb);
        setSpecials(nsp);
        await sleep(70);

        await resolve(nb, nsp, a, c, ignite);

        if (modeRef.current === 'level') {
          const currentScore = scoreRef.current;
          const currentTarget = levelRef.current.target;
          if (currentScore >= currentTarget * 1.5 || movesRef.current <= 0) {
            await sleep(180);
            finishLevel(currentScore);
          }
        }
      } catch (err) {
        console.error('Error during move resolution:', err);
      } finally {
        busy.current = false;
      }
    },
    [resolve, finishLevel],
  );

  const pick = useCallback(
    (i: number) => {
      if (phaseRef.current !== 'playing' || busy.current) return;
      setCursor(i);
      if (sel === null) setSel(i);
      else if (sel === i) setSel(null);
      else tryMove(sel, i);
    },
    [sel, tryMove],
  );

  const onDown = (i: number) => (e: React.PointerEvent) => {
    sfx.unlock();
    down.current = { i, x: e.clientX, y: e.clientY };
  };

  const onUp = (e: React.PointerEvent) => {
    const d = down.current;
    down.current = null;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const w = (gridRef.current?.clientWidth || 400) / SIZE;
    if (Math.hypot(dx, dy) > Math.min(22, w * 0.35)) {
      const r = Math.floor(d.i / SIZE),
        c = d.i % SIZE;
      let nr = r,
        nc = c;
      if (Math.abs(dx) > Math.abs(dy)) nc += dx > 0 ? 1 : -1;
      else nr += dy > 0 ? 1 : -1;
      if (nr < 0 || nc < 0 || nr >= SIZE || nc >= SIZE) return;
      setSel(null);
      setCursor(d.i);
      tryMove(d.i, idx(nr, nc));
    } else {
      pick(d.i);
    }
  };

  const startLevel = useCallback((n: number) => {
    const lv = LEVELS[n - 1];
    busy.current = false;
    setMode('level');
    setLevel(lv);
    setBoard(makeBoard(lv.kinds));
    setSpecials(ZERO_SP());
    setMoves(lv.moves);
    movesRef.current = lv.moves;
    setScore(0);
    scoreRef.current = 0;
    setCombo(0);
    setSel(null);
    setEarned(0);
    setCursor(idx(4, 4));
    setPhase('playing');
  }, []);

  const startEndless = useCallback(() => {
    busy.current = false;
    setMode('endless');
    setBoard(makeBoard(6));
    setSpecials(ZERO_SP());
    setScore(0);
    scoreRef.current = 0;
    setCombo(0);
    setTime(START_TIME);
    setSel(null);
    setCursor(idx(4, 4));
    setPhase('playing');
  }, []);

  const restart = useCallback(() => {
    busy.current = false;
    if (modeRef.current === 'level') startLevel(levelRef.current.n);
    else startEndless();
  }, [startLevel, startEndless]);

  const nextLevel = useCallback(() => {
    busy.current = false;
    if (levelRef.current.n < LEVELS.length) startLevel(levelRef.current.n + 1);
    else setPhase('map');
  }, [startLevel]);

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (phaseRef.current === 'menu') return setPhase('map');
        if (phaseRef.current === 'won') return nextLevel();
        if (phaseRef.current === 'over') return restart();
      }
      if (e.key.toLowerCase() === 'r' && phaseRef.current !== 'menu' && phaseRef.current !== 'map') {
        return restart();
      }
      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        if (phaseRef.current === 'playing') setPhase('paused');
        else if (phaseRef.current === 'paused') setPhase('playing');
        return;
      }
      if (phaseRef.current !== 'playing') return;
      const map: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
        w: [-1, 0],
        s: [1, 0],
        a: [0, -1],
        d: [0, 1],
      };
      const m = map[e.key] || map[e.key.toLowerCase()];
      if (m) {
        e.preventDefault();
        const r = Math.floor(cursor / SIZE) + m[0];
        const c = (cursor % SIZE) + m[1];
        if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return;
        const ni = idx(r, c);
        if (e.shiftKey || sel === cursor) {
          const from = sel === cursor ? sel : cursor;
          setCursor(ni);
          tryMove(from, ni);
        } else setCursor(ni);
      }
      if (e.key === ' ') {
        e.preventDefault();
        pick(cursor);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cursor, sel, pick, tryMove, restart, nextLevel]);

  const goalPct =
    mode === 'level' ? Math.min(100, (score / level.target) * 100) : (time / START_TIME) * 100;

  const shell =
    'relative min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden font-sans text-[#4a2c1a] select-none';

  if (phase === 'map')
    return (
      <div className={shell}>
        <Sky />
        <div className="relative z-10">
          <LevelMap progress={progress} onPlay={startLevel} onBack={() => setPhase('menu')} />
        </div>
      </div>
    );

  if (phase === 'menu')
    return (
      <div className={`${shell} flex items-center justify-center px-4 py-4`}>
        <Sky />
        <div className="fc-scroll relative z-10 max-h-[94dvh] w-full max-w-sm space-y-4 overflow-x-hidden overflow-y-auto rounded-3xl bg-white/70 p-5 text-center shadow-xl shadow-orange-200/40 ring-1 ring-white/80 backdrop-blur-md sm:space-y-5 sm:p-6">
          <div className="text-5xl fc-bounce">🍓🍋🍇</div>
          <h1 className="bg-gradient-to-r from-[#e07a5f] via-[#ff7a8a] to-[#f2b705] bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
            FRUIT CRUSH
          </h1>
          <p className="text-sm text-[#7a4e32]/80">
            Match 4 for a <b>💣 bomb</b>, match 5+ for a <b>🌈 mega bomb</b>. Swap bombs to blow up
            the board — chains detonate chains!
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                sfx.unlock();
                setPhase('map');
              }}
              className="rounded-2xl bg-gradient-to-r from-[#ff7a8a] to-[#ffd23f] px-7 py-4 text-lg font-black text-[#4a2c1a] shadow-lg shadow-orange-300/50 transition hover:brightness-110 active:scale-95 cursor-pointer"
            >
              Play Adventure
            </button>
            <button
              onClick={() => {
                sfx.unlock();
                startEndless();
              }}
              className="rounded-2xl bg-white/80 px-7 py-3 font-black text-[#6b3f24] ring-1 ring-[#e8c9a8] transition hover:bg-white active:scale-95 cursor-pointer"
            >
              Endless Time Attack
            </button>
          </div>
          {scores.length > 0 && (
            <div className="rounded-2xl bg-white/70 p-3 text-left ring-1 ring-[#efd5b8]">
              <div className="mb-1 text-[10px] font-bold tracking-widest text-[#b07a4a]">
                ENDLESS HIGH SCORES
              </div>
              <ol className="space-y-0.5 text-sm">
                {scores.slice(0, 5).map((s, i) => (
                  <li key={i} className="flex justify-between tabular-nums text-[#6b3f24]">
                    <span>
                      {['🥇', '🥈', '🥉', '4.', '5.'][i]} {s.date}
                    </span>
                    <span className="font-bold">{s.score}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    );

  return (
    <div className={`${shell} px-2 py-3 sm:px-3 sm:py-4`}>
      <Sky />
      <div className="relative z-10 mx-auto flex w-full max-w-md min-[900px]:max-w-lg flex-col gap-2.5 sm:gap-3">
        <header className="flex items-center justify-between gap-2 px-1">
          <button
            onClick={() => setPhase(mode === 'level' ? 'map' : 'menu')}
            className="rounded-xl bg-white/80 px-3 py-2 text-sm font-bold text-[#6b3f24] shadow-sm ring-1 ring-[#efd5b8] backdrop-blur transition hover:bg-white active:scale-95 cursor-pointer"
          >
            ←
          </button>
          <div className="text-center leading-tight">
            <div className="text-lg font-black text-[#4a2c1a]">
              {mode === 'level' ? `Level ${level.n}` : 'Time Attack'}
            </div>
            <div className="text-[11px] text-[#9a6b45]">
              {mode === 'level' ? level.name : 'crush to gain time'}
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={toggleMute}
              className="rounded-xl bg-white/80 px-3 py-2 text-sm font-bold text-[#6b3f24] shadow-sm ring-1 ring-[#efd5b8] backdrop-blur transition hover:bg-white active:scale-95 cursor-pointer"
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button
              onClick={() => setPhase(phase === 'playing' ? 'paused' : 'playing')}
              className="rounded-xl bg-white/80 px-3 py-2 text-sm font-bold text-[#6b3f24] shadow-sm ring-1 ring-[#efd5b8] backdrop-blur transition hover:bg-white active:scale-95 cursor-pointer"
            >
              {phase === 'paused' ? '▶' : '❚❚'}
            </button>
          </div>
        </header>

        <div className="flex items-center gap-3 rounded-2xl bg-white/75 p-3 shadow-sm ring-1 ring-white/90 backdrop-blur">
          <div className="flex-1">
            <div className="text-[10px] font-bold tracking-widest text-[#b07a4a]">SCORE</div>
            <div className="text-2xl font-black tabular-nums text-[#4a2c1a]">{Math.round(score)}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-bold tracking-widest text-[#b07a4a]">
              {mode === 'level' ? 'TARGET' : 'BEST'}
            </div>
            <div className="text-2xl font-black tabular-nums text-[#e07a5f]">
              {mode === 'level' ? level.target : (scores[0]?.score ?? 0)}
            </div>
          </div>
          <div className="flex-1 text-right">
            <div className="text-[10px] font-bold tracking-widest text-[#b07a4a]">
              {mode === 'level' ? 'MOVES' : 'TIME'}
            </div>
            <div
              className={`text-2xl font-black tabular-nums ${
                (mode === 'level' ? moves <= 5 : time < 10) ? 'text-[#ff4d6d]' : 'text-[#4a2c1a]'
              }`}
            >
              {mode === 'level' ? moves : time.toFixed(1)}
            </div>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-white/70 ring-1 ring-[#efd5b8]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#6bd968] via-[#ffd23f] to-[#ff4d6d] transition-[width] duration-200"
            style={{ width: `${goalPct}%` }}
          />
        </div>

        <div
          className="relative mx-auto aspect-square w-full rounded-3xl bg-white/70 p-2 shadow-xl shadow-orange-200/40 ring-1 ring-white/90 backdrop-blur-sm"
          style={{
            maxWidth: 'min(100%, 60dvh)',
            transform: shake ? `translate(${rnd(shake)}px, ${rnd(shake)}px)` : undefined,
          }}
        >
          <div
            ref={gridRef}
            className="relative grid h-full w-full grid-cols-8 gap-[2px] touch-none"
            onPointerUp={onUp}
            onPointerCancel={() => {
              down.current = null;
            }}
          >
            {board.map((k, i) => {
              const isSel = sel === i;
              const isCur = cursor === i && phase === 'playing';
              const sp = specials[i];
              return (
                <div
                  key={i}
                  onPointerDown={onDown(i)}
                  className={`relative flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
                    sp === 2
                      ? 'fc-mega-cell'
                      : sp === 1
                        ? 'fc-bomb-cell'
                        : isSel
                          ? 'bg-[#ffd6a5] ring-2 ring-[#ffb347]'
                          : isCur
                            ? 'bg-[#fff1dc]'
                            : 'bg-[#fff8ef]/80'
                  } ${isSel && sp === 0 ? 'ring-2 ring-[#ffb347]' : ''}`}
                >
                  <span
                    className={`block will-change-transform ${popping.has(i) ? 'fc-pop' : ''} ${
                      wrong === i ? 'fc-wrong' : ''
                    } ${isSel ? 'fc-sel' : ''}`}
                    style={{
                      fontSize: 'clamp(16px, 5.2vw, 30px)',
                      lineHeight: 1,
                      animationName: fall[i] ? 'fcFall' : undefined,
                      ['--fall' as string]: `${-fall[i] * 100}%`,
                    }}
                  >
                    {FRUITS[k]}
                  </span>
                  {sp === 1 && (
                    <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 text-[10px] drop-shadow sm:text-[12px]">
                      💣
                    </span>
                  )}
                  {sp === 2 && (
                    <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 text-[11px] drop-shadow sm:text-[13px]">
                      💥
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <Particles api={partApi} />

          {floats.map((f) => (
            <div
              key={f.id}
              className="pointer-events-none absolute z-40 -translate-x-1/2 text-lg font-black text-[#e07a5f] drop-shadow-[0_2px_0_rgba(255,255,255,.8)] fc-float"
              style={{ left: f.x + 8, top: f.y + 8 }}
            >
              {f.text}
            </div>
          ))}

          {combo > 1 && (
            <div className="pointer-events-none absolute left-1/2 top-2 z-40 -translate-x-1/2 rounded-full bg-[#ff4d6d] px-4 py-1 text-sm font-black text-white shadow-lg fc-combo">
              COMBO x{combo}
            </div>
          )}

          {msg && (
            <div
              key={msg.id}
              className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
            >
              <div className="fc-msg rounded-full bg-gradient-to-r from-[#ff7a8a] to-[#f2b705] px-6 py-2 text-2xl font-black text-white shadow-xl shadow-orange-400/40 sm:text-3xl">
                {msg.text}
              </div>
            </div>
          )}

          {phase !== 'playing' && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 rounded-3xl bg-white/85 p-6 text-center text-[#4a2c1a] backdrop-blur-md">
              {phase === 'paused' && <h2 className="text-3xl font-black">Paused</h2>}
              {phase === 'won' && (
                <>
                  <div className="text-4xl">🎉</div>
                  <h2 className="text-3xl font-black">Level {level.n} clear!</h2>
                  <div className="text-4xl text-[#f2b705]">
                    {[0, 1, 2].map((s) => (
                      <span key={s} className={s < earned ? 'fc-bounce inline-block' : 'opacity-20'}>
                        ★
                      </span>
                    ))}
                  </div>
                  <div className="text-2xl font-black tabular-nums">{Math.round(score)}</div>
                </>
              )}
              {phase === 'over' && (
                <>
                  <div className="text-4xl">😵</div>
                  <h2 className="text-2xl font-black">
                    {mode === 'level' ? 'Out of moves!' : "Time's up!"}
                  </h2>
                  <div className="text-3xl font-black tabular-nums text-[#e07a5f]">
                    {Math.round(score)}
                  </div>
                  {mode === 'level' && (
                    <p className="text-sm text-[#9a6b45]">Target was {level.target}</p>
                  )}
                </>
              )}
              <div className="flex flex-wrap justify-center gap-2">
                {phase === 'paused' && (
                  <button
                    onClick={() => setPhase('playing')}
                    className="rounded-2xl bg-[#fff1dc] px-6 py-3 font-black text-[#6b3f24] ring-1 ring-[#efd5b8] transition hover:bg-white active:scale-95 cursor-pointer"
                  >
                    Resume
                  </button>
                )}
                <button
                  onClick={restart}
                  className="rounded-2xl bg-[#fff1dc] px-6 py-3 font-black text-[#6b3f24] ring-1 ring-[#efd5b8] transition hover:bg-white active:scale-95 cursor-pointer"
                >
                  Retry
                </button>
                {phase === 'won' && (
                  <button
                    onClick={nextLevel}
                    className="rounded-2xl bg-gradient-to-r from-[#ff7a8a] to-[#ffd23f] px-6 py-3 font-black text-[#4a2c1a] shadow-lg transition hover:brightness-110 active:scale-95 cursor-pointer"
                  >
                    Next →
                  </button>
                )}
                {mode === 'level' && phase !== 'won' && (
                  <button
                    onClick={() => setPhase('map')}
                    className="rounded-2xl bg-gradient-to-r from-[#ff7a8a] to-[#ffd23f] px-6 py-3 font-black text-[#4a2c1a] shadow-lg transition hover:brightness-110 active:scale-95 cursor-pointer"
                  >
                    Map
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="px-1 text-center text-[11px] leading-relaxed text-[#9a6b45]">
          Match 4 → 💣 bomb · Match 5+ → 🌈 mega bomb · Swap bombs to detonate · P pause · R restart
        </p>
      </div>
    </div>
  );
}
