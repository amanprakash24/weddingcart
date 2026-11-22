'use client';

// "Animated Features Bento with Live Diagrams" (the founder, 12 Nov 2026) for the Vivah OS page: what venues and vendors get,
// each tile a small diagram that moves. Everything shown is something Venue OS / Vendor OS does today; names and amounts are
// examples and the section says so. Motion stops for anyone who asks for less of it.
import { useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { BadgeIndianRupee, CalendarHeart, Check, FileText, Inbox, Smartphone, Users, ArrowDown } from 'lucide-react';

function Tile({ icon, title, text, className = '', children, delay = 0 }: { icon: ReactNode; title: string; text: string; className?: string; children: ReactNode; delay?: number }) {
  const still = useReducedMotion();
  return (
    <motion.li
      initial={still ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative flex min-w-0 flex-col gap-4 overflow-hidden rounded-[26px] border border-white/12 bg-white/[0.06] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl transition-colors hover:bg-white/[0.09] sm:p-6 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#7B3FF2]/25 text-[#DDD6FE]">{icon}</span>
        <div className="min-w-0">
          <h3 className="text-[17px] font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-[#CBD5E1]">{text}</p>
        </div>
      </div>
      <div className="relative mt-auto min-h-[150px] rounded-2xl border border-white/10 bg-[#0B1022]/60 p-4">{children}</div>
    </motion.li>
  );
}

// A step that moves on every `ms` — the "live" in the diagrams. Stays on the last step for reduced motion.
function useStep(count: number, ms: number) {
  const still = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (still) return;
    const t = window.setInterval(() => setStep((s) => (s + 1) % count), ms);
    return () => window.clearInterval(t);
  }, [count, ms, still]);
  return still ? count - 1 : step;
}

function Sources() {
  const sources = ['Shaadi Shopping', 'Your enquiry page', 'Google', 'WhatsApp', 'Phone call'];
  const step = useStep(sources.length, 1600);
  return (
    // Phone: the sources wrap as chips above, an arrow, then the list at full width — three columns do not fit 375px without cutting
    // the words. From sm up: side by side, joined by the flowing lines.
    <div className="space-y-2 sm:grid sm:grid-cols-[minmax(0,1fr)_64px_minmax(0,1.1fr)] sm:items-center sm:gap-2 sm:space-y-0">
      <ul className="flex flex-wrap gap-1.5 sm:flex-col sm:flex-nowrap">
        {sources.map((s, i) => (
          <li key={s} className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors duration-500 sm:truncate ${i === step ? 'bg-[#7B3FF2] text-white' : 'bg-white/[0.06] text-[#CBD5E1]'}`}>{s}</li>
        ))}
      </ul>
      <div className="flex justify-center sm:hidden" aria-hidden>
        <ArrowDown className="os-flow h-5 w-5 text-[#C4B5FD]" />
      </div>
      <svg viewBox="0 0 64 150" className="hidden h-[150px] w-full sm:block" aria-hidden>
        {[15, 45, 75, 105, 135].map((y, i) => (
          <path key={y} d={`M0 ${y} C 32 ${y}, 32 75, 64 75`} fill="none" stroke={i === step ? '#C4B5FD' : 'rgba(203,213,225,0.25)'} strokeWidth="1.6" className={i === step ? 'os-flow' : ''} />
        ))}
      </svg>
      <div className="rounded-xl border border-white/15 bg-white/[0.08] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C4B5FD]">Your enquiries</p>
        <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mt-2 rounded-lg bg-white/10 p-2">
          <p className="truncate text-sm font-semibold text-white">New enquiry</p>
          <p className="truncate text-xs text-[#CBD5E1]">from {sources[step]}</p>
        </motion.div>
        <p className="mt-2 text-xs text-[#94A3B8]">Next: call them</p>
      </div>
    </div>
  );
}

function QuoteToBooking() {
  const steps = ['Enquiry', 'Quotation sent', 'Couple accepts', 'Booked'];
  const step = useStep(steps.length, 1400);
  return (
    <ol className="flex h-full flex-col justify-center gap-2">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-3">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-all duration-500 ${i <= step ? 'border-[#7B3FF2] bg-[#7B3FF2] text-white' : 'border-white/20 text-[#94A3B8]'}`}>
            {i < step ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
          </span>
          <span className={`text-sm transition-colors duration-500 ${i <= step ? 'font-semibold text-white' : 'text-[#94A3B8]'}`}>{s}</span>
          {i === step && <span className="os-blink ml-auto h-2 w-2 rounded-full bg-[#FF6B8B]" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

function UpiRing() {
  const step = useStep(5, 1100);
  const pct = [0, 10, 18, 25, 25][step];
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 110 110" className="h-[118px] w-[118px] shrink-0 -rotate-90" aria-hidden>
        <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10" />
        <circle cx="55" cy="55" r={r} fill="none" stroke="#7B3FF2" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset 700ms ease' }} />
        <circle cx="55" cy="55" r={r} fill="none" stroke="#FF6B8B" strokeWidth="2" strokeDasharray={`2 ${c}`} strokeDashoffset={-c * 0.25} />
      </svg>
      <div className="min-w-0">
        <p className="text-3xl font-semibold tabular-nums text-white">{pct}%</p>
        <p className="text-sm text-[#CBD5E1]">paid by UPI</p>
        <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-500 ${pct >= 25 ? 'bg-[#DCF3E5] text-[#14532D]' : 'bg-white/10 text-[#CBD5E1]'}`}>{pct >= 25 ? 'Booking confirmed' : '25% confirms the booking'}</p>
      </div>
    </div>
  );
}

function Team() {
  const on = useStep(2, 1800) === 1;
  const people = [
    { n: 'Owner', i: 'R', money: true },
    { n: 'Manager', i: 'A', money: on },
    { n: 'Employee', i: 'S', money: false },
  ];
  return (
    <ul className="flex flex-col gap-2">
      {people.map((p) => (
        <li key={p.n} className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7B3FF2]/40 text-sm font-semibold text-white">{p.i}</span>
          <span className="flex-1 text-sm text-white">{p.n}</span>
          <span className="text-xs text-[#94A3B8]">Sees money</span>
          <span className={`relative h-5 w-9 rounded-full transition-colors duration-500 ${p.money ? 'bg-[#7B3FF2]' : 'bg-white/15'}`} aria-hidden>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all duration-500 ${p.money ? 'left-[18px]' : 'left-0.5'}`} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Functions() {
  const fns = ['Haldi', 'Mehndi', 'Sangeet', 'Wedding', 'Reception'];
  const step = useStep(fns.length, 1300);
  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <div className="relative h-1.5 rounded-full bg-white/12">
        <div className="absolute inset-y-0 left-0 rounded-full bg-[#7B3FF2] transition-all duration-700" style={{ width: `${(step / (fns.length - 1)) * 100}%` }} />
      </div>
      {/* Five equal columns that may shrink (minmax 0): the names stay in their own column on a phone. The active one changes colour,
          not weight, so it never grows into its neighbour. */}
      <ul className="grid grid-cols-[repeat(5,minmax(0,1fr))] gap-0 text-center sm:gap-1">
        {fns.map((f, i) => (
          <li key={f} className="flex flex-col items-center gap-1.5">
            <span className={`h-3 w-3 rounded-full transition-colors duration-500 ${i <= step ? 'bg-[#C4B5FD]' : 'bg-white/20'}`} />
            <span className={`w-full truncate text-[9px] font-medium sm:text-[11px] ${i === step ? 'text-white' : 'text-[#94A3B8]'}`}>{f}</span>
          </li>
        ))}
      </ul>
      <p className="text-center text-xs text-[#CBD5E1]">Each function with its own services and to-dos.</p>
    </div>
  );
}

function CouplePhone() {
  const accepted = useStep(2, 2000) === 1;
  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-[150px] rounded-[22px] border border-white/20 bg-[#0F172A] p-2 shadow-[0_20px_40px_-20px_rgba(123,63,242,0.8)]">
        <div className="rounded-[16px] bg-[#F5F2FE] p-2.5 text-[#111827]">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#5B21D6]">Your quotation</p>
          <p className="mt-1 text-sm font-semibold">₹1,30,500</p>
          <p className="text-[10px] text-[#5B6472]">Haldi · Wedding</p>
          <div className={`mt-2 rounded-lg py-1.5 text-center text-[11px] font-semibold text-white transition-colors duration-500 ${accepted ? 'bg-[#15803D]' : 'bg-[#7B3FF2]'}`}>{accepted ? 'Accepted' : 'Accept'}</div>
          <p className="mt-1.5 text-center text-[9px] text-[#5B6472]">No app, no sign-in</p>
        </div>
      </div>
    </div>
  );
}

export default function FeaturesBento() {
  return (
    <div>
      <ul className="grid gap-4 md:grid-cols-6">
        <Tile className="md:col-span-4" icon={<Inbox className="h-5 w-5" aria-hidden />} title="Every enquiry in one place" text="From Shaadi Shopping, your own enquiry page, Google, WhatsApp or a call — each one lands in one list with its next step.">
          <Sources />
        </Tile>
        <Tile className="md:col-span-2" delay={0.05} icon={<FileText className="h-5 w-5" aria-hidden />} title="Quotation to booking" text="A quotation from your price list; the couple accepts on their phone.">
          <QuoteToBooking />
        </Tile>
        <Tile className="md:col-span-2" delay={0.1} icon={<BadgeIndianRupee className="h-5 w-5" aria-hidden />} title="Paid by UPI" text="Your UPI on the couple's link. The advance confirms the booking.">
          <UpiRing />
        </Tile>
        <Tile className="md:col-span-2" delay={0.15} icon={<Users className="h-5 w-5" aria-hidden />} title="Your team, your rules" text="Everyone signs in with their own code. You decide who sees money.">
          <Team />
        </Tile>
        <Tile className="md:col-span-2" delay={0.2} icon={<CalendarHeart className="h-5 w-5" aria-hidden />} title="Weddings, function by function" text="Every booked wedding, its functions and the work for each.">
          <Functions />
        </Tile>
        <Tile className="md:col-span-6 lg:col-span-6" delay={0.25} icon={<Smartphone className="h-5 w-5" aria-hidden />} title="The couple's own page" text="Your quotation arrives as a private link. The couple reads every line, accepts it and pays the advance — and later follows their wedding in Client OS.">
          <CouplePhone />
        </Tile>
      </ul>
      <p className="mt-4 text-center text-xs text-[#94A3B8]">Diagrams show example names and amounts.</p>
    </div>
  );
}
