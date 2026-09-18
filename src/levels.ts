export type Level = {
  n: number;
  target: number;
  moves: number;
  kinds: number;
  name: string;
};

const NAMES = [
  'Berry Meadow', 'Citrus Grove', 'Grape Hollow', 'Melon Bay', 'Kiwi Canyon',
  'Sugar Peaks', 'Jam Falls', 'Orchard Gate', 'Nectar Isle', 'Rainbow Summit',
  'Misty Vineyard', 'Frost Plum', 'Amber Dunes', 'Cocoa Deep', 'Lychee Lagoon',
  'Storm Cider', 'Velvet Fig', 'Dragon Rind', 'Ember Peach', 'Moonberry Reach',
  'Glass Orchard', 'Thorn Basin', 'Saffron Steps', 'Hollow Pit', 'Pearl Blossom',
  'Cinder Vine', 'Twilight Pear', 'Salt Mango', 'Iron Guava', 'Aurora Bloom',
  'Silk Papaya', 'Obsidian Seed', 'Nebula Melon', 'Gilded Husk', 'Coral Sorbet',
  'Zephyr Grove', 'Crystal Pulp', 'Shadow Harvest', 'Solar Citrus', 'Prism Falls',
  'Echo Orchard', 'Void Berry', 'Titan Grape', 'Mirage Melon', 'Rune Peel',
  'Astral Jam', 'Phantom Fig', 'Eclipse Core', 'Celestial Rind', 'Eternal Harvest',
];

export const CHAPTERS = [
  { from: 1, to: 100, title: 'The Sunlit Orchard', icon: '🍓' },
  { from: 101, to: 200, title: 'The Clouded Vale', icon: '🌫️' },
  { from: 201, to: 300, title: 'The Storm Canopy', icon: '⛈️' },
  { from: 301, to: 400, title: 'The Frozen Rind', icon: '❄️' },
  { from: 401, to: 500, title: 'The Eternal Harvest', icon: '✨' },
];

export const TOTAL = 500;

function targetFor(n: number) {
  // Keep the original climb through L50; after that grow steadier so L500 isn't absurd.
  if (n <= 50) {
    return Math.round((260 + n * 80 + Math.pow(n, 1.45) * 5) / 10) * 10;
  }
  return Math.round((5710 + (n - 50) * 90 + Math.pow(n - 50, 1.1) * 5) / 10) * 10;
}

function movesFor(n: number, target: number) {
  // Early levels: generous floor (L11 ≈ 17). Later: scale with score so
  // 51–500 aren't stuck at a flat 30 while targets keep rising.
  const early = 14 + Math.floor((n - 1) / 3) + Math.floor(n / 20);
  const ppmGoal = 105 + Math.pow(n, 0.6) * 2.2; // slowly harder late-game
  const scaled = Math.round(target / ppmGoal);
  return Math.max(early, scaled);
}

export const LEVELS: Level[] = Array.from({ length: TOTAL }, (_, i) => {
  const n = i + 1;
  const target = targetFor(n);
  const moves = movesFor(n, target);
  const kinds = n <= 3 ? 4 : n <= 8 ? 5 : 6;
  return { n, target, moves, kinds, name: `${NAMES[Math.floor(i / 10)]} ${(i % 10) + 1}` };
});

export function chapterOf(n: number) {
  return CHAPTERS[Math.min(CHAPTERS.length - 1, Math.floor((n - 1) / 100))];
}

/** 0 = fully clear, 1 = total fog. Levels far past your progress are shrouded. */
export function fogFor(n: number, unlocked: number) {
  const ahead = n - unlocked;
  if (ahead <= 2) return 0;
  return Math.min(1, (ahead - 2) / 12);
}

export type Progress = { stars: Record<number, number>; unlocked: number };

const KEY = 'fruitcrush.progress.v1';

export function loadProgress(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (p && typeof p.unlocked === 'number') return p;
  } catch {
    /* ignore */
  }
  return { stars: {}, unlocked: 1 };
}

export function saveProgress(p: Progress) {
  localStorage.setItem(KEY, JSON.stringify(p));
  return p;
}

export function starsFor(level: Level, score: number) {
  if (score >= level.target * 1.5) return 3;
  if (score >= level.target * 1.25) return 2;
  if (score >= level.target) return 1;
  return 0;
}

export function totalStars(p: Progress) {
  return Object.values(p.stars).reduce((a, b) => a + b, 0);
}
