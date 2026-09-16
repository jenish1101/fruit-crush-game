# Fruit Crush

A polished match-3 fruit puzzle you can play in the browser or install as a **Progressive Web App** on your phone.

**Created and maintained by Jenish Gondaliya (JG)**

---

## Features

- **Adventure mode** — 500 levels across 5 chapters, star ratings, and progress saved locally
- **Endless Time Attack** — race the clock, chain combos, climb the high-score list
- **Specials** — match 4 for a bomb, match 5+ for a mega bomb; swap bombs for big blasts
- **Touch + keyboard** — swipe/tap on mobile; arrows / WASD + Space on desktop
- **PWA** — install to home screen, play offline, auto-updates when you redeploy
- **Splash credit screen** — short intro on every open
- **Link previews** — Open Graph / Twitter cards for nice share cards

---

## Tech stack

| Layer | Choice |
|--------|--------|
| UI | React 19 + TypeScript |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`) |
| PWA | `vite-plugin-pwa` (Workbox, auto-update) |
| State / data | React state + `localStorage` (no backend) |
| Audio | Web Audio API (`src/sound.ts`) |
| Utils | `clsx` + `tailwind-merge` |

**Node.js:** `20.19+` or `22.12+` (Vite 7 requirement)

---

## How it works

### Game loop (high level)

1. An **8×8 board** is filled with fruit kinds (`src/game.ts`).
2. The player swaps two adjacent cells (tap-tap, swipe, or keyboard).
3. `findMatches` looks for runs of **3+** in rows/columns.
4. Matched cells pop → board collapses → new fruits fall in.
5. Longer runs create **bombs / mega bombs**; cascades and bomb swaps score more.
6. **Adventure:** hit the level score target before moves run out.  
   **Endless:** keep scoring before the timer hits zero (matches add time).

Core match / board logic lives in `src/game.ts`. UI and input orchestration live in `src/App.tsx`. Levels and progress live in `src/levels.ts`.

### Progress & scores

- Adventure progress / stars → `localStorage` key `fruitcrush.progress.v1`
- Endless high scores → `localStorage` (see `loadScores` / `saveScore` in `game.ts`)

Everything stays on the device — no server or database.

### Screens

| Screen | Role |
|--------|------|
| `Splash.tsx` | ~2s branded loading / credit overlay |
| Menu (`App`) | Adventure, Endless, Install App |
| `LevelMap.tsx` | Chapter map, fog, unlocks |
| Play / pause / win / lose (`App`) | Board, HUD, particles |

### PWA

- Manifest + service worker from `vite-plugin-pwa`
- `registerType: "autoUpdate"` — new deploys refresh caches automatically
- Install button uses `beforeinstallprompt` (Chrome/Android); iOS gets Add to Home Screen tips

### Share preview

`index.html` includes Open Graph / Twitter meta tags and `public/og-image.png` (1200×630). After deploy, sharing the HTTPS URL shows title, description, and image. For picky apps (e.g. WhatsApp), set absolute `og:image` / `twitter:image` URLs to your domain.

---

## Project structure

```
├── public/
│   ├── icons/          # PWA & favicon icons
│   ├── images/         # Sky / orchard art
│   └── og-image.png    # Link preview image
├── src/
│   ├── App.tsx         # Screens, input, game session UI
│   ├── game.ts         # Board, matches, scoring helpers
│   ├── levels.ts       # 500 levels, chapters, progress I/O
│   ├── LevelMap.tsx    # Adventure map
│   ├── Particles.tsx   # Burst FX
│   ├── Sky.tsx         # Background atmosphere
│   ├── sound.ts        # SFX / mute
│   ├── Splash.tsx      # Startup splash
│   ├── usePwaInstall.ts
│   ├── main.tsx        # Entry + SW register + splash gate
│   └── index.css       # Tailwind + game animations
├── index.html
├── vite.config.ts
└── package.json
```

---

## Getting started

```bash
# Use a supported Node version
nvm use 20

# Install dependencies
npm install

# Dev server
npm run dev

# Production build → dist/
npm run build

# Preview production build locally
npm run preview
```

Open the local URL Vite prints (usually `http://localhost:5173`).  
For phone testing on the same Wi‑Fi: `npm run dev -- --host`.

---

## Deploy

1. Run `nvm use 20 && npm install && npm run build`
2. Host the contents of **`dist/`** on any static HTTPS host (Netlify, Vercel, Cloudflare Pages, GitHub Pages, cPanel, etc.)
3. PWA install and auto-update need **HTTPS** (localhost is fine for testing)

### What to commit to GitHub

| Path | Commit? |
|------|---------|
| Source (`src/`, `public/`, configs, `package.json`, …) | **Yes** |
| `node_modules/` | **No** |
| `dist/` | **No** (build on CI / before upload) |
| `dev-dist/` | **No** (dev PWA cache) |

If the host builds for you, push the repo and set install/build commands to `npm install` / `npm run build`, publish directory `dist`.

---

## Controls

| Action | Mobile | Desktop |
|--------|--------|---------|
| Select / swap | Tap two fruits or swipe | Click, or arrows/WASD + Space / Shift+move |
| Pause | In-game button | `P` or `Esc` |
| Restart | — | `R` (in a run) |

---

## License / credit

Created and maintained by **Jenish Gondaliya (JG)**.

Enjoy crushing fruit.
