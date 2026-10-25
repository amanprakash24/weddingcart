import { Building2, Heart, Store, UserCheck } from 'lucide-react';

// The idea behind Vivah OS, drawn simply: one wedding in the middle, and everyone who works on it joined to the same record.
// An illustration of the idea — not a screenshot, and not a picture of any real wedding. Decoration only for screen readers; the
// words beside it say the same thing.
const PEOPLE = [
  { label: 'The couple', icon: Heart, pos: 'left-1/2 top-0 -translate-x-1/2' },
  { label: 'The venue', icon: Building2, pos: 'right-0 top-1/2 -translate-y-1/2' },
  { label: 'Wedding vendors', icon: Store, pos: 'bottom-0 left-1/2 -translate-x-1/2' },
  { label: 'Your wedding expert', icon: UserCheck, pos: 'left-0 top-1/2 -translate-y-1/2' },
];

export default function ConnectedWedding({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`relative mx-auto aspect-square w-full max-w-[440px] select-none ${className}`}>
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
        <circle cx="200" cy="200" r="150" fill="none" stroke="#C5A46D" strokeWidth="1" strokeDasharray="3 7" opacity="0.7" />
        <circle cx="200" cy="200" r="98" fill="none" stroke="#C5A46D" strokeWidth="1" opacity="0.35" />
        {[[200, 50], [350, 200], [200, 350], [50, 200]].map(([x, y]) => (
          <line key={`${x}-${y}`} x1="200" y1="200" x2={x} y2={y} stroke="#C5A46D" strokeWidth="1.2" opacity="0.6" />
        ))}
      </svg>
      <div className="absolute left-1/2 top-1/2 flex h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-gradient-to-br from-[#8B1A4A] to-[#5A1030] text-center text-white shadow-[0_20px_50px_rgba(139,26,74,0.35)]">
        <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[#E9C98A] sm:text-[10px]">One wedding</span>
        <span className="mt-1 text-lg leading-tight sm:text-xl" style={{ fontFamily: 'var(--font-playfair), serif' }}>One Wedding ID</span>
        <span className="mt-1 font-cormorant text-sm italic text-white/75 sm:text-base">one shared record</span>
      </div>
      {PEOPLE.map(({ label, icon: Icon, pos }) => (
        <div key={label} className={`absolute ${pos} flex w-[30%] min-w-[92px] flex-col items-center gap-1.5 rounded-2xl border border-[#EADBC2] bg-white px-2 py-3 text-center shadow-[0_10px_26px_rgba(42,6,20,0.08)]`}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8B1A4A]/8"><Icon className="h-4 w-4 text-[#8B1A4A]" /></span>
          <span className="text-[11px] font-semibold leading-tight text-[#2A1F1B] sm:text-xs">{label}</span>
        </div>
      ))}
    </div>
  );
}
