import orchard from './assets/orchard.jpg';
import clouds from './assets/clouds.png';

const FRUIT = ['🍓', '🍋', '🍇', '🍊', '🥝', '🫐', '🍑', '🍒'];

const FLOATS = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  fruit: FRUIT[i % FRUIT.length],
  left: `${(i * 7.3 + 4) % 96}%`,
  size: 18 + (i % 5) * 6,
  delay: (i * 1.7) % 18,
  dur: 16 + (i % 7) * 2.4,
  drift: (i % 2 === 0 ? 18 : -16) + (i % 5),
}));

export default function Sky() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <img src={orchard} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#fff7e8]/55 via-[#ffe8d2]/35 to-[#ffd9c2]/50" />

      <img
        src={clouds}
        alt=""
        className="fc-cloud-drift absolute -left-[10%] top-[4%] h-[28%] w-[70%] max-w-none object-contain opacity-70"
      />
      <img
        src={clouds}
        alt=""
        className="fc-cloud-drift-slow absolute -right-[18%] top-[18%] h-[34%] w-[80%] max-w-none object-contain opacity-55"
      />
      <img
        src={clouds}
        alt=""
        className="fc-cloud-drift absolute left-[8%] bottom-[8%] h-[22%] w-[55%] max-w-none object-contain opacity-40"
      />

      {FLOATS.map((f) => (
        <span
          key={f.id}
          className="fc-float-fruit absolute"
          style={{
            left: f.left,
            fontSize: f.size,
            animationDelay: `${f.delay}s`,
            animationDuration: `${f.dur}s`,
            ['--drift' as string]: `${f.drift}px`,
          }}
        >
          {f.fruit}
        </span>
      ))}
    </div>
  );
}
