export const SIZE = 8;
export const KINDS = 6;

export const FRUITS = ['🍓', '🍋', '🍇', '🍊', '🥝', '🫐'] as const;
export const FRUIT_COLORS = ['#ff4d6d', '#ffd23f', '#a06cd5', '#ff922b', '#6bd968', '#4d8bff'];

export type Cell = number; // 0..KINDS-1

export function idx(r: number, c: number) {
  return r * SIZE + c;
}

export function randKind(kinds: number = KINDS) {
  return Math.floor(Math.random() * Math.max(1, kinds));
}

export function makeBoard(kinds: number = KINDS): Cell[] {
  let b: Cell[];
  let attempts = 0;
  do {
    attempts++;
    b = Array.from({ length: SIZE * SIZE }, () => randKind(kinds));
    let sub = 0;
    while (findMatches(b).size > 0 && sub < 60) {
      sub++;
      for (const i of findMatches(b)) b[i] = randKind(kinds);
    }
  } while (!hasMove(b) && attempts < 60);
  return b;
}

export function findMatches(b: Cell[]): Set<number> {
  const out = new Set<number>();
  for (let r = 0; r < SIZE; r++) {
    let run = 1;
    for (let c = 1; c <= SIZE; c++) {
      const same = c < SIZE && b[idx(r, c)] === b[idx(r, c - 1)] && b[idx(r, c)] >= 0;
      if (same) run++;
      else {
        if (run >= 3) for (let k = c - run; k < c; k++) out.add(idx(r, k));
        run = 1;
      }
    }
  }
  for (let c = 0; c < SIZE; c++) {
    let run = 1;
    for (let r = 1; r <= SIZE; r++) {
      const same = r < SIZE && b[idx(r, c)] === b[idx(r - 1, c)] && b[idx(r, c)] >= 0;
      if (same) run++;
      else {
        if (run >= 3) for (let k = r - run; k < r; k++) out.add(idx(k, c));
        run = 1;
      }
    }
  }
  return out;
}

export function swapped(b: Cell[], a: number, c: number) {
  const n = b.slice();
  const t = n[a];
  n[a] = n[c];
  n[c] = t;
  return n;
}

export function isAdjacent(a: number, b: number) {
  const r1 = Math.floor(a / SIZE),
    c1 = a % SIZE;
  const r2 = Math.floor(b / SIZE),
    c2 = b % SIZE;
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

export function hasMove(b: Cell[]): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (c < SIZE - 1 && findMatches(swapped(b, idx(r, c), idx(r, c + 1))).size > 0) return true;
      if (r < SIZE - 1 && findMatches(swapped(b, idx(r, c), idx(r + 1, c))).size > 0) return true;
    }
  }
  return false;
}

export function findPossibleMove(b: Cell[]): [number, number] | null {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const i = idx(r, c);
      if (c < SIZE - 1 && findMatches(swapped(b, i, idx(r, c + 1))).size > 0) return [i, idx(r, c + 1)];
      if (r < SIZE - 1 && findMatches(swapped(b, i, idx(r + 1, c))).size > 0) return [i, idx(r + 1, c)];
    }
  }
  return null;
}

/** Collapse board; returns new board + falls (how far each cell fell) */
export function collapse(b: Cell[], cleared: Set<number>, kinds: number = KINDS) {
  const n = b.slice();
  const fall = new Array(SIZE * SIZE).fill(0);
  for (const i of cleared) n[i] = -1;
  for (let c = 0; c < SIZE; c++) {
    let write = SIZE - 1;
    for (let r = SIZE - 1; r >= 0; r--) {
      const v = n[idx(r, c)];
      if (v >= 0) {
        n[idx(write, c)] = v;
        fall[idx(write, c)] = write - r;
        write--;
      }
    }
    for (let r = write; r >= 0; r--) {
      n[idx(r, c)] = randKind(kinds);
      fall[idx(r, c)] = write + 1;
    }
  }
  return { board: n, fall };
}

export type Run = { cells: number[]; kind: number };

/** All horizontal + vertical runs of 3+ */
export function findRuns(b: Cell[]): Run[] {
  const runs: Run[] = [];
  for (let r = 0; r < SIZE; r++) {
    let start = 0;
    for (let c = 1; c <= SIZE; c++) {
      if (c < SIZE && b[idx(r, c)] === b[idx(r, start)] && b[idx(r, c)] >= 0) continue;
      if (c - start >= 3)
        runs.push({
          cells: Array.from({ length: c - start }, (_, k) => idx(r, start + k)),
          kind: b[idx(r, start)],
        });
      start = c;
    }
  }
  for (let c = 0; c < SIZE; c++) {
    let start = 0;
    for (let r = 1; r <= SIZE; r++) {
      if (r < SIZE && b[idx(r, c)] === b[idx(start, c)] && b[idx(r, c)] >= 0) continue;
      if (r - start >= 3)
        runs.push({
          cells: Array.from({ length: r - start }, (_, k) => idx(start + k, c)),
          kind: b[idx(start, c)],
        });
      start = r;
    }
  }
  return runs;
}

/** Cells hit by a bomb: type 1 = 3x3 blast, type 2 (mega) = full row + column */
export function blastCells(i: number, type: number): number[] {
  const r = Math.floor(i / SIZE),
    c = i % SIZE;
  const out: number[] = [];
  if (type >= 2) {
    for (let k = 0; k < SIZE; k++) {
      out.push(idx(r, k));
      out.push(idx(k, c));
    }
  } else {
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr,
          nc = c + dc;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) out.push(idx(nr, nc));
      }
  }
  return out;
}

/** Collapse board AND specials together */
export function collapseBoard(
  b: Cell[],
  sp: number[],
  cleared: Set<number>,
  kinds: number = KINDS,
) {
  const n = b.slice();
  const ns = sp.slice();
  const fall = new Array(SIZE * SIZE).fill(0);
  for (const i of cleared) {
    n[i] = -1;
    ns[i] = 0;
  }
  for (let c = 0; c < SIZE; c++) {
    let write = SIZE - 1;
    for (let r = SIZE - 1; r >= 0; r--) {
      const v = n[idx(r, c)];
      if (v >= 0) {
        n[idx(write, c)] = v;
        ns[idx(write, c)] = ns[idx(r, c)];
        fall[idx(write, c)] = write - r;
        write--;
      }
    }
    for (let r = write; r >= 0; r--) {
      n[idx(r, c)] = randKind(kinds);
      ns[idx(r, c)] = 0;
      fall[idx(r, c)] = write + 1;
    }
  }
  return { board: n, specials: ns, fall };
}

export type Score = { score: number; date: string };

const KEY = 'fruitcrush.highscores.v1';
export function loadScores(): Score[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}
export function saveScore(score: number): Score[] {
  const list = loadScores();
  list.push({ score, date: new Date().toLocaleDateString() });
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, 8);
  localStorage.setItem(KEY, JSON.stringify(top));
  return top;
}
