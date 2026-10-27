// The Vivah OS logo (founder's choice, 28 Oct 2026: option B, "the mandap"): a mandap arch whose points — venue, caterer,
// decorator, photographer, family — are all joined to the one wedding in the centre. "One wedding, one Wedding ID."
// Maroon #7A1238, gold #C9A05A. `tone="light"` for dark backgrounds.

export function VivahOsMark({ size = 40, tone = 'dark', title }: { size?: number; tone?: 'dark' | 'light'; title?: string }) {
  const arch = tone === 'light' ? '#F3E3C3' : '#7A1238';
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <path d="M22 106 V60 A38 38 0 0 1 98 60 V106" fill="none" stroke={arch} strokeWidth={8} strokeLinecap="round" />
      <path d="M22 60 L60 72 M98 60 L60 72 M60 22 L60 72 M33 33 L60 72 M87 33 L60 72" stroke="#C9A05A" strokeWidth={3} strokeLinecap="round" />
      <circle cx="60" cy="72" r="9" fill="#C9A05A" />
      {[[22, 60], [98, 60], [60, 22], [33, 33], [87, 33]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill={arch} />)}
    </svg>
  );
}

export default function VivahOsLogo({ size = 40, tone = 'dark', byline = true }: { size?: number; tone?: 'dark' | 'light'; byline?: boolean }) {
  const ink = tone === 'light' ? '#FFFFFF' : '#221714';
  const accent = tone === 'light' ? '#E9C98E' : '#7A1238';
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="Vivah OS by Shaadi Shopping" role="img">
      <VivahOsMark size={size} tone={tone} />
      <span className="flex flex-col leading-none" aria-hidden>
        <span className="font-cormorant text-[1.75rem] font-semibold" style={{ color: ink }}>
          Vivah <span style={{ color: accent }}>OS</span>
        </span>
        {byline && <span className="mt-0.5 text-[10px] font-semibold tracking-[0.16em]" style={{ color: tone === 'light' ? '#D9CBB8' : '#6B5A4E' }}>BY SHAADI SHOPPING</span>}
      </span>
    </span>
  );
}
