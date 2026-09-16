/* Tiny WebAudio synth — no assets, all sounds generated. */
let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = localStorage.getItem('fruitcrush.muted') === '1';
} catch {
  /* ignore */
}

function ac(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem('fruitcrush.muted', m ? '1' : '0');
  } catch {
    /* ignore */
  }
}
export function isMuted() {
  return muted;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType = 'sine',
  vol = 0.18,
  when = 0,
  slide = 0,
) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, vol = 0.3, when = 0, fFrom = 3000, fTo = 150) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + when;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(fFrom, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, fTo), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
}

export const sfx = {
  /** call on any user gesture to unlock audio */
  unlock() {
    ac();
  },
  swap() {
    tone(320, 0.06, 'triangle', 0.1, 0, 160);
  },
  bad() {
    tone(170, 0.16, 'sawtooth', 0.08, 0, -70);
  },
  pop(chain = 1) {
    const base = 360 + Math.min(chain, 6) * 80;
    tone(base, 0.09, 'square', 0.09);
    tone(base * 1.5, 0.08, 'sine', 0.07, 0.02);
  },
  bomb() {
    noise(0.4, 0.5, 0, 2600, 110);
    tone(95, 0.35, 'sine', 0.32, 0, -55);
  },
  mega() {
    noise(0.7, 0.55, 0, 4200, 80);
    tone(72, 0.5, 'sine', 0.38, 0, -42);
    tone(880, 0.3, 'triangle', 0.11, 0.06, -420);
    tone(1320, 0.32, 'triangle', 0.09, 0.14, -640);
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.15, i * 0.09));
  },
  lose() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.2, 'sawtooth', 0.08, i * 0.12));
  },
  star(i = 0) {
    tone(880 + i * 200, 0.14, 'sine', 0.13, 0, 120);
  },
};
