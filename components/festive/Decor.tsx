// Festive decorations, drawn in code (no image files): a marigold garland, a diya with a soft flame, and a small ornament rule.
// All are decoration only — hidden from screen readers, never clickable — and the flame and the lights hold still for anyone who
// asks their device for less motion (app/globals.css). Shown only where lib/festive.ts says the season is on.

const MARIGOLD = ['#F2A541', '#E8871E', '#F6B955', '#D9701A'];

// A draped garland: `swags` gentle curves of marigolds across the full width, with a green leaf between flowers.
export function MarigoldGarland({ swags = 5, className = '' }: { swags?: number; className?: string }) {
  const perSwag = 9;
  const w = 240; // one swag
  const flowers: { x: number; y: number; r: number; c: string }[] = [];
  for (let s = 0; s < swags; s++) {
    for (let i = 0; i <= perSwag; i++) {
      const t = i / perSwag;
      flowers.push({ x: s * w + t * w, y: 6 + Math.sin(t * Math.PI) * 30, r: i % 3 === 0 ? 9 : 7.5, c: MARIGOLD[(s + i) % MARIGOLD.length] });
    }
  }
  return (
    <svg aria-hidden viewBox={`0 0 ${swags * w} 62`} preserveAspectRatio="xMidYMin slice" className={`pointer-events-none block w-full ${className}`} role="presentation">
      {Array.from({ length: swags }, (_, s) => (
        <path key={s} d={`M ${s * w} 6 Q ${s * w + w / 2} 66 ${(s + 1) * w} 6`} fill="none" stroke="#5E7A3A" strokeWidth="1.5" opacity="0.55" />
      ))}
      {flowers.map((f, i) => (
        <g key={i}>
          <circle cx={f.x} cy={f.y} r={f.r} fill={f.c} />
          <circle cx={f.x} cy={f.y} r={f.r * 0.55} fill="#FBD277" opacity="0.75" />
          <circle cx={f.x} cy={f.y} r={f.r * 0.2} fill="#B5530F" opacity="0.6" />
        </g>
      ))}
      {Array.from({ length: swags + 1 }, (_, s) => (
        <g key={`t${s}`}>
          <line x1={s * w} y1="12" x2={s * w} y2="40" stroke="#C5A46D" strokeWidth="1.2" />
          <circle cx={s * w} cy="44" r="5" fill="#8B1A4A" />
          <circle cx={s * w} cy="53" r="3" fill="#C5A46D" />
        </g>
      ))}
    </svg>
  );
}

// A clay diya with a flame. `size` is its width in pixels.
export function Diya({ size = 44, className = '' }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden role="presentation" width={size} height={size * 1.15} viewBox="0 0 60 69" className={`pointer-events-none ${className}`}>
      <ellipse cx="30" cy="22" rx="17" ry="20" fill="#F6B955" opacity="0.18" className="festive-glow" />
      <path d="M30 4 C 38 16 38 26 30 32 C 22 26 22 16 30 4 Z" fill="#F2A541" className="festive-flame" />
      <path d="M30 13 C 34 20 34 26 30 30 C 26 26 26 20 30 13 Z" fill="#FFE9A8" className="festive-flame" />
      <path d="M6 38 Q 30 30 54 38 Q 50 60 30 62 Q 10 60 6 38 Z" fill="#8B1A4A" />
      <path d="M6 38 Q 30 46 54 38" fill="none" stroke="#C5A46D" strokeWidth="2" />
      <path d="M16 50 Q 30 56 44 50" fill="none" stroke="#C5A46D" strokeWidth="1.2" opacity="0.7" />
      <ellipse cx="30" cy="66" rx="17" ry="2.5" fill="#2A1F1B" opacity="0.12" />
    </svg>
  );
}

// A thin gold rule with a small diamond — the brand's own divider, used between festive sections.
export function OrnamentRule({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`flex items-center justify-center gap-3 ${className}`}>
      <span className="h-px w-12 bg-gradient-to-r from-transparent to-[#C5A46D]" />
      <span className="h-1.5 w-1.5 rotate-45 bg-[#C5A46D]" />
      <span className="h-px w-12 bg-gradient-to-l from-transparent to-[#C5A46D]" />
    </div>
  );
}
