import { Briefcase, CalendarClock, Heart, Inbox, LayoutDashboard, MoreHorizontal, Receipt } from 'lucide-react';

// A drawn preview of the Vivah OS "Today" screen — the same header, menu, counters and lists a business sees after signing in
// (components/vendor/VendorShell.tsx, VendorTodayScreen.tsx), on a laptop and on a phone. It is a picture made in code: it reads
// nothing, links nowhere, and every entry in it is a made-up sample — no real business, couple or amount appears on a public page.
const MENU = [
  { label: 'Today', icon: LayoutDashboard },
  { label: 'Enquiries', icon: Inbox },
  { label: 'Weddings', icon: Heart },
  { label: 'Services', icon: Briefcase },
  { label: 'Availability', icon: CalendarClock },
  { label: 'Payments', icon: Receipt },
];
const STATS = [
  { n: '2', label: 'Services today' },
  { n: '3', label: 'Awaiting your response' },
  { n: '5', label: 'Upcoming weddings' },
];
const SERVICES = [
  { title: 'Sample wedding — Haldi', meta: 'Lawn · 11:00 am', pill: 'Confirmed', tone: 'bg-emerald-50 text-emerald-700' },
  { title: 'Sample wedding — Sangeet', meta: 'Main hall · 7:00 pm', pill: 'Awaiting confirmation', tone: 'bg-sky-50 text-sky-700' },
];
const UPCOMING = [
  { title: 'Sample wedding', meta: '24 Nov · Reception' },
  { title: 'Sample wedding', meta: '2 Dec · Wedding' },
];

const head = 'text-[9px] font-bold uppercase tracking-widest text-[#8A7A6A]';
const cardBox = 'rounded-lg border border-[#EFE6D8] bg-white';

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className={`${cardBox} px-3 py-2.5`}>
      <p className="text-lg font-bold leading-none text-[#2A1F1B]">{n}</p>
      <p className="mt-1 text-[9px] leading-tight text-[#8A7A6A]">{label}</p>
    </div>
  );
}

function Row({ title, meta, right }: { title: string; meta: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[#F4EEE3] px-3 py-2 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-[10px] font-semibold text-[#2A1F1B]">{title}</p>
        <p className="truncate text-[9px] text-[#8A7A6A]">{meta}</p>
      </div>
      {right}
    </div>
  );
}

export default function ProductPreview({ className = '' }: { className?: string }) {
  return (
    <figure className={`relative ${className}`} aria-label="A preview of the Vivah OS Today screen on a laptop and a phone, shown with sample entries">
      <div aria-hidden className="relative select-none">
        {/* Laptop */}
        <div className="overflow-hidden rounded-2xl border border-[#E4D6BF] bg-[#FBF7F0] shadow-[0_30px_80px_rgba(42,6,20,0.16)]">
          <div className="flex items-center gap-1.5 border-b border-[#EFE6D8] bg-[#F4EDE1] px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-[#E3B9A6]" /><span className="h-2 w-2 rounded-full bg-[#E9D29A]" /><span className="h-2 w-2 rounded-full bg-[#B9CFAE]" />
          </div>
          <div className="flex items-center gap-3 border-b border-[#EFE6D8] bg-white px-3 py-2.5 sm:px-4">
            <div className="flex-shrink-0 leading-none">
              <p className="text-[11px] font-bold text-[#2A1F1B]">Vivah OS</p>
              <p className="mt-0.5 text-[7px] text-[#8A7A6A]">by ShaadiShopping</p>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
              {MENU.map(({ label, icon: Icon }, i) => (
                <span key={label} className={`flex flex-shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[9px] font-medium ${i === 0 ? 'bg-[#8B1A4A]/8 text-[#8B1A4A]' : 'text-[#6B5B4D]'}`}>
                  <Icon className="h-3 w-3" /> <span className="hidden sm:inline">{label}</span>
                </span>
              ))}
            </div>
            <span className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-[#EFE6D8] py-0.5 pl-0.5 pr-2 text-[9px] font-medium text-[#2A1F1B]">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#8B1A4A] text-[7px] font-bold text-white">YB</span>
              <span className="hidden sm:inline">Your business</span>
            </span>
          </div>
          <div className="grid gap-3 p-3 sm:grid-cols-[1.4fr_1fr] sm:p-4">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">{STATS.map((s) => <Stat key={s.label} {...s} />)}</div>
              <div className="rounded-lg border border-[#E9C98A] bg-[#FFF8EA] px-3 py-2.5">
                <p className={head}>Next action</p>
                <p className="mt-1 text-[10px] font-semibold text-[#2A1F1B]">Answer 3 availability requests</p>
              </div>
              <div>
                <p className={`${head} mb-1.5`}>Today&rsquo;s services</p>
                <div className={cardBox}>
                  {SERVICES.map((s) => (
                    <Row key={s.title} title={s.title} meta={s.meta} right={<span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${s.tone}`}>{s.pill}</span>} />
                  ))}
                </div>
              </div>
            </div>
            <div className="hidden space-y-3 sm:block">
              <div>
                <p className={`${head} mb-1.5`}>Upcoming weddings</p>
                <div className={cardBox}>
                  {UPCOMING.map((u, i) => <Row key={i} title={u.title} meta={u.meta} right={<span className="text-[9px] font-semibold text-[#2A1F1B] underline underline-offset-2">Open</span>} />)}
                </div>
              </div>
              <div>
                <p className={`${head} mb-1.5`}>Your work</p>
                <div className={cardBox}>
                  <Row title="Confirm the flower delivery" meta="Sample wedding · due tomorrow" right={<span className="h-3.5 w-3.5 flex-shrink-0 rounded border border-[#C5A46D]" />} />
                  <Row title="Call back about the menu" meta="Enquiry follow-up · today" right={<span className="h-3.5 w-3.5 flex-shrink-0 rounded border border-[#C5A46D]" />} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Phone */}
        <div className="absolute -bottom-8 -right-2 w-[34%] min-w-[120px] max-w-[190px] overflow-hidden rounded-[22px] border-[5px] border-[#2A1F1B] bg-[#FBF7F0] shadow-[0_24px_60px_rgba(42,6,20,0.28)] sm:-right-6">
          <div className="flex items-center justify-between border-b border-[#EFE6D8] bg-white px-2.5 py-2">
            <p className="text-[9px] font-bold text-[#2A1F1B]">Vivah OS</p>
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#8B1A4A] text-[7px] font-bold text-white">YB</span>
          </div>
          <div className="space-y-2 p-2.5">
            <div className="grid grid-cols-3 gap-1">
              {STATS.map((s) => (
                <div key={s.label} className={`${cardBox} px-1 py-1.5 text-center`}>
                  <p className="text-[11px] font-bold leading-none text-[#2A1F1B]">{s.n}</p>
                </div>
              ))}
            </div>
            <p className={head}>Your work</p>
            <div className={cardBox}>
              <Row title="Confirm the flowers" meta="Due tomorrow" />
              <Row title="Call back: menu" meta="Today" />
            </div>
          </div>
          <div className="grid grid-cols-5 border-t border-[#EFE6D8] bg-white py-1.5">
            {[LayoutDashboard, Inbox, Heart, Briefcase, MoreHorizontal].map((Icon, i) => (
              <span key={i} className={`flex justify-center ${i === 0 ? 'text-[#8B1A4A]' : 'text-[#A89A8A]'}`}><Icon className="h-3 w-3" /></span>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="mt-12 text-center text-[11px] text-[#8A7A6A]">The Vivah OS &ldquo;Today&rdquo; screen, drawn with sample entries.</figcaption>
    </figure>
  );
}
