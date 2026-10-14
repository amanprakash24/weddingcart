import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Briefcase, CalendarClock, FileText, Inbox, ListChecks, Receipt, Smartphone, Users } from 'lucide-react';
import { festive } from '@/lib/festive';
import { MarigoldGarland, OrnamentRule } from '@/components/festive/Decor';
import ConnectedWedding from '@/components/vivah-os/ConnectedWedding';
import TrackedLink from '@/components/vivah-os/TrackedLink';

// The public page that introduces Vivah OS (14 Oct 2026) — honestly. Vivah OS is in early access: a small number of partner
// businesses in Patna use it, and couples meet parts of it through Shaadi Shopping. So every list on this page says which of
// three things it is — here today, in early access, or planned — and nothing planned is described as if it existed. No prices,
// no numbers about customers, no screenshots of anyone's data. The ways in are flows that already work: /plan for couples,
// /vendor-onboarding for businesses (a registration the team reviews), /vendor/login for a business that already has its code.
export const metadata: Metadata = {
  title: 'Vivah OS — A New Chapter in Connected Wedding Planning',
  description:
    'Vivah OS by Shaadi Shopping, now in early access: one wedding, one Wedding ID, one connected workspace for couples, venues and wedding businesses. See what is available today and request early access.',
  alternates: { canonical: '/vivah-os' },
  openGraph: {
    title: 'Vivah OS — A New Chapter in Connected Wedding Planning',
    description: 'One wedding. One Wedding ID. One connected workspace. Now in early access with Shaadi Shopping in Patna.',
    url: '/vivah-os',
    type: 'website',
  },
};

const serif = { fontFamily: 'var(--font-playfair), serif' };
const eyebrow = 'text-[11px] font-semibold uppercase tracking-[0.3em] text-[#8A6A2F]';
const primary = 'inline-flex min-h-[52px] whitespace-nowrap items-center justify-center gap-2 rounded-full bg-[#8B1A4A] px-8 text-[15px] font-semibold tracking-wide text-white shadow-[0_12px_32px_rgba(139,26,74,0.28)] transition-opacity hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-[#8B1A4A] focus-visible:ring-offset-2';
const secondary = 'inline-flex min-h-[52px] whitespace-nowrap items-center justify-center rounded-full border border-[#8B1A4A]/35 px-7 text-sm font-semibold text-[#8B1A4A] transition-colors hover:bg-[#8B1A4A] hover:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#8B1A4A] focus-visible:ring-offset-2';

type Status = 'today' | 'early' | 'planned';
const STATUS: Record<Status, { label: string; cls: string }> = {
  today: { label: 'Here today', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  early: { label: 'Early access', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  planned: { label: 'Planned', cls: 'bg-[#F4EEE3] text-[#6B5B4D] border-[#E4D6BF]' },
};
function Pill({ status }: { status: Status }) {
  return <span className={`inline-flex flex-shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${STATUS[status].cls}`}>{STATUS[status].label}</span>;
}

const COUPLES: { status: Status; title: string; text: string }[] = [
  { status: 'today', title: 'One wedding expert, from planning to Vidai', text: 'Tell us your date, guest count and budget. One person from Shaadi Shopping plans with you and stays with you.' },
  { status: 'today', title: 'Your quotation, on your phone', text: 'Your quotation arrives as a private link — no app and no login. Open it, read every line, and pay the advance by UPI from the same page.' },
  { status: 'early', title: 'Your own wedding login', text: 'Couples whose wedding is booked with us are beginning to get their own sign-in to follow their wedding.' },
  { status: 'planned', title: 'One workspace for your whole wedding', text: 'Functions, guests, vendors and payments together, shared with your venue and vendors under one Wedding ID.' },
];

const BUSINESS = [
  { icon: Inbox, title: 'Every enquiry in one place', text: 'The enquiries you bring and the requests Shaadi Shopping sends you, with follow-ups you can give to someone in your team.' },
  { icon: FileText, title: 'Quotations under your own name', text: 'Build a quotation from your own price list, with your logo, and share it as a link the couple opens on their phone.' },
  { icon: Receipt, title: 'Payments you can follow', text: 'Your UPI details on the proposal, what has been received and what is still due — seen only by the people you allow.' },
  { icon: Briefcase, title: 'Weddings, function by function', text: 'Each booked wedding with its functions, the services you are giving, and a to-do list you can hand out.' },
  { icon: Users, title: 'Your team, each with their own sign-in', text: 'Owner, manager, employee — everyone signs in with their own mobile number and code and sees their own work.' },
  { icon: CalendarClock, title: 'Availability, answered quickly', text: 'Keep your dates up to date and answer availability requests without a phone call.' },
  { icon: ListChecks, title: 'What you offer, kept tidy', text: 'Your services and prices in one list, ready to drop into a quotation.' },
  { icon: Smartphone, title: 'Made for the phone in your hand', text: 'Every screen works on a phone — the one you carry on the wedding day.' },
];

const STEPS = [
  { n: '01', title: 'Request early access', text: 'Tell us about your venue or wedding service on the registration form.' },
  { n: '02', title: 'We review it', text: 'The Shaadi Shopping team reads every request and gets in touch.' },
  { n: '03', title: 'Sign in and begin', text: 'Once approved, you sign in with your mobile number and a 6-digit code, finish your profile and add your team.' },
];

export default function VivahOsPage() {
  return (
    <div className="bg-[#FFFAF5] text-[#2A1F1B]">
      {/* Opening — below the site header (36px announcement + 52 / 64 / 72px nav) */}
      <section className="relative overflow-hidden bg-[#F8F3EA] pt-[88px] sm:pt-[100px] lg:pt-[108px]">
        {festive.enabled && <MarigoldGarland className="h-9 opacity-90 sm:h-11" />}
        <div aria-hidden className="pointer-events-none absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-[#C5A46D]/14 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-[#8B1A4A]/8 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pb-24">
          <div>
            <p className={`flex flex-wrap items-center gap-3 ${eyebrow}`}>
              <span className="h-px w-8 bg-[#C5A46D]" />Introducing Vivah OS
              <span className="rounded-full border border-[#C5A46D]/60 px-2.5 py-1 text-[10px] tracking-[0.18em] text-[#8B1A4A]">Early access</span>
            </p>
            <h1 className="mt-5 text-[2.3rem] leading-[1.12] sm:text-[52px]" style={serif}>
              A New Chapter in <span className="italic text-[#8B1A4A]">Connected</span> Wedding Planning.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[#5A4A40]">
              Shaadi Shopping helps you discover the right wedding services. Vivah OS is our next step toward bringing the wedding journey into a more connected, organized experience for couples, venues, and wedding businesses.
            </p>
            <p className="mt-5 font-cormorant text-[1.45rem] italic leading-snug text-[#8B1A4A]">One wedding. One Wedding ID. One connected workspace. One source of truth.</p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#6B5B4D]">
              We are building it step by step, with real weddings in Patna. This page says plainly what is here today, what is in early access, and what is still planned.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <TrackedLink href="#couples" audience="couples" cta="choose_audience" className={primary}>For Couples <ArrowRight className="h-4 w-4" aria-hidden /></TrackedLink>
              <TrackedLink href="#business" audience="business" cta="choose_audience" className={secondary}>For Venues &amp; Vendors</TrackedLink>
            </div>
          </div>
          <ConnectedWedding />
        </div>
      </section>

      {/* For couples */}
      <section id="couples" aria-labelledby="vivah-os-couples" className="scroll-mt-28 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className={eyebrow}>For couples</p>
            <h2 id="vivah-os-couples" className="mt-4 text-3xl leading-tight sm:text-[40px]" style={serif}>Less to chase. More to celebrate.</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[#5A4A40]">You do not need to learn any software. You plan your wedding with Shaadi Shopping, and Vivah OS works quietly behind it.</p>
            <OrnamentRule className="mt-6" />
          </div>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2">
            {COUPLES.map((c) => (
              <li key={c.title} className="rounded-[22px] border border-[#EFE6D8] bg-white p-6 shadow-[0_10px_30px_rgba(42,6,20,0.05)]">
                <Pill status={c.status} />
                <h3 className="mt-3 text-xl leading-snug" style={serif}>{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#6B5B4D]">{c.text}</p>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <TrackedLink href="/plan" audience="couples" cta="begin_journey" className={primary}>Begin your wedding journey <ArrowRight className="h-4 w-4" aria-hidden /></TrackedLink>
            <TrackedLink href="/cities/patna/venue" audience="couples" cta="explore_venues" className={secondary}>Explore wedding venues</TrackedLink>
          </div>
        </div>
      </section>

      {/* For venues and vendors */}
      <section id="business" aria-labelledby="vivah-os-business" className="scroll-mt-28 bg-[#FAF5EE] px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className={eyebrow}>For venues &amp; wedding businesses</p>
            <h2 id="vivah-os-business" className="mt-4 text-3xl leading-tight sm:text-[40px]" style={serif}>An invitation to the next chapter</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[#5A4A40]">
              A small number of venues and wedding businesses in Patna already run their work on Vivah OS with us. We are opening early access to more — venues, planners, decorators, caterers, photographers and artists.
            </p>
            <p className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm text-[#6B5B4D]"><Pill status="today" /> for businesses in early access:</p>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BUSINESS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-[22px] border border-[#EFE6D8] bg-white p-6 shadow-[0_10px_30px_rgba(42,6,20,0.05)]">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#8B1A4A]/8"><Icon className="h-5 w-5 text-[#8B1A4A]" aria-hidden /></span>
                <h3 className="mt-4 text-lg leading-snug" style={serif}>{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#6B5B4D]">{text}</p>
              </li>
            ))}
          </ul>
          <p className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-2 text-center text-sm leading-relaxed text-[#6B5B4D]">
            <Pill status="planned" /> one shared view of each wedding for the couple, the venue and every vendor, under one Wedding ID.
          </p>

          <ol className="mx-auto mt-14 grid max-w-5xl gap-5 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-[22px] border border-[#EFE6D8] bg-white p-7">
                <p className="font-cormorant text-4xl italic text-[#9A7536]">{s.n}</p>
                <h3 className="mt-3 text-xl" style={serif}>{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#6B5B4D]">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <TrackedLink href="/vendor-onboarding" audience="business" cta="request_early_access" className={primary}>Request early access <ArrowRight className="h-4 w-4" aria-hidden /></TrackedLink>
            <TrackedLink href="/vendor/login" audience="business" cta="sign_in" className={secondary}>Already with us? Sign in</TrackedLink>
          </div>
        </div>
      </section>

      {/* Closing */}
      <section aria-labelledby="vivah-os-cta" className="relative overflow-hidden bg-[#17151A] px-4 py-16 text-center sm:px-6 sm:py-20">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-72 w-[42rem] max-w-full -translate-x-1/2 rounded-full bg-[#C5A46D]/12 blur-3xl" />
        <div className="relative mx-auto max-w-2xl">
          <h2 id="vivah-os-cta" className="text-3xl leading-tight text-white sm:text-[40px]" style={serif}>Discover your wedding with Shaadi Shopping. Experience the next chapter with Vivah OS.</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">Questions about early access? Talk to our team in Patna.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <a href="tel:+917646028228" className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[#C5A46D] px-8 text-[15px] font-semibold text-[#17151A] transition-opacity hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#17151A]">Talk to our team</a>
            <Link href="/" className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/25 px-7 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10 outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#17151A]">Back to Shaadi Shopping</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
