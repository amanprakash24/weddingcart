import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Briefcase, CalendarClock, FileText, Inbox, ListChecks, Receipt, Smartphone, Users } from 'lucide-react';
import { festive } from '@/lib/festive';
import { Diya, MarigoldGarland, OrnamentRule } from '@/components/festive/Decor';
import ProductPreview from '@/components/vivah-os/ProductPreview';

// The public page that introduces Vivah OS (14 Oct 2026). Everything described here is in the product today — nothing planned,
// no prices, no numbers about customers. The preview is a drawing with sample entries; no dashboard or business data is shown.
// The way in is the existing vendor registration (/vendor-onboarding); a business that already has its code signs in at
// /vendor/login.
export const metadata: Metadata = {
  title: 'Vivah OS — The Wedding Operating System for Wedding Businesses',
  description:
    'Vivah OS by Shaadi Shopping: enquiries, quotations, bookings, your team and payments for a wedding business — in one connected place, built for the phone. Register your venue or wedding service.',
  alternates: { canonical: '/vivah-os' },
  openGraph: {
    title: 'Vivah OS — Now Is the Time to Revel',
    description: 'Your wedding operating system to plan, organize, coordinate, and celebrate—all in one connected experience.',
    url: '/vivah-os',
    type: 'website',
  },
};

const serif = { fontFamily: 'var(--font-playfair), serif' };
const eyebrow = 'text-[11px] font-semibold uppercase tracking-[0.3em] text-[#B08D55]';
const primary = 'inline-flex min-h-[52px] whitespace-nowrap items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#8B1A4A] via-[#9E2A55] to-[#C5A46D] px-8 text-[15px] font-semibold tracking-wide text-white shadow-[0_12px_32px_rgba(139,26,74,0.3)]';
const secondary = 'inline-flex min-h-[52px] whitespace-nowrap items-center justify-center rounded-full border border-[#8B1A4A]/30 px-7 text-sm font-semibold text-[#8B1A4A] transition-colors hover:bg-[#8B1A4A] hover:text-white';

const FEATURES = [
  { icon: Inbox, title: 'Every enquiry in one place', text: 'The enquiries you bring and the requests Shaadi Shopping sends you, on one screen — with follow-ups you can give to someone in your team.' },
  { icon: FileText, title: 'Quotations under your own name', text: 'Build a quotation from your own price list, with your logo, and share it as a link. The couple opens it on their phone — no app, no login.' },
  { icon: Receipt, title: 'Payments you can follow', text: 'Your UPI details on the proposal, what has been received and what is still due — seen only by the people you allow.' },
  { icon: Briefcase, title: 'Weddings, function by function', text: 'Each booked wedding with its functions, the services you are giving, and a to-do list you can hand out.' },
  { icon: Users, title: 'Your team, each with their own sign-in', text: 'Owner, manager, employee. Everyone signs in with their own mobile number and code, sees their own work, and you decide who sees money.' },
  { icon: CalendarClock, title: 'Availability, answered quickly', text: 'Keep your dates up to date and answer Shaadi Shopping’s availability requests without a phone call.' },
  { icon: ListChecks, title: 'What you offer, kept tidy', text: 'Your services and prices in one list, ready to drop into a quotation.' },
  { icon: Smartphone, title: 'Made for the phone in your hand', text: 'Every screen works on a phone — the one you carry on the wedding day.' },
];

const STEPS = [
  { n: '01', title: 'Register your business', text: 'Tell us about your venue or wedding service on the registration form.' },
  { n: '02', title: 'We review it', text: 'The Shaadi Shopping team looks at your registration and gets in touch.' },
  { n: '03', title: 'Sign in and begin', text: 'Once approved, you sign in with your mobile number and a 6-digit code, finish your profile, and add your team.' },
];

const FOR = ['Wedding venues & banquet halls', 'Wedding planners', 'Decorators', 'Caterers', 'Photographers & videographers', 'Makeup & mehndi artists'];

export default function VivahOsPage() {
  const on = festive.enabled;
  return (
    <div className="bg-[#FFFAF5] text-[#2A1F1B]">
      {/* Opening — below the site header (36px announcement + 52 / 64 / 72px nav) */}
      <section className="relative overflow-hidden bg-[#FBF3E4] pt-[88px] sm:pt-[100px] lg:pt-[108px]">
        {on && <MarigoldGarland className="h-9 opacity-90 sm:h-11" />}
        <div aria-hidden className="pointer-events-none absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-[#F2A541]/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-[#8B1A4A]/8 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-24 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:pb-28">
          <div>
            <p className={`flex items-center gap-3 ${eyebrow}`}><span className="h-px w-8 bg-[#C5A46D]" />Introducing Vivah OS</p>
            <h1 className="mt-5 text-[2.5rem] leading-[1.1] sm:text-[56px]" style={serif}>
              Now Is the Time <span className="italic text-[#8B1A4A]">to Revel.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[#5A4A40]">
              Your wedding operating system to plan, organize, coordinate, and celebrate—all in one connected experience.
            </p>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#6B5B4D]">
              Vivah OS is the software Shaadi Shopping runs its own weddings on, opened to the venues, planners and wedding professionals we work with. Less chasing on the phone, more time for the celebration.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Link href="/vendor-onboarding" className={primary}>Register your business <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              <Link href="/vendor/login" className={secondary}>Already registered? Sign in</Link>
            </div>
          </div>
          <div className="pr-3 sm:pr-8"><ProductPreview /></div>
        </div>
      </section>

      {/* What it does */}
      <section aria-labelledby="vivah-os-features" className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className={eyebrow}>What is inside today</p>
            <h2 id="vivah-os-features" className="mt-4 text-3xl leading-tight sm:text-[42px]" style={serif}>One place for the work behind a wedding</h2>
            <OrnamentRule className="mt-6" />
          </div>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-[22px] border border-[#EFE6D8] bg-white p-6 shadow-[0_10px_30px_rgba(42,6,20,0.05)]">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#8B1A4A]/8"><Icon className="h-5 w-5 text-[#8B1A4A]" aria-hidden /></span>
                <h3 className="mt-4 text-lg leading-snug" style={serif}>{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#6B5B4D]">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Who it is for */}
      <section aria-labelledby="vivah-os-for" className="bg-[#FAF5EE] px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className={eyebrow}>Who it is for</p>
            <h2 id="vivah-os-for" className="mt-4 text-3xl leading-tight sm:text-[40px]" style={serif}>For the people who make weddings happen</h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-[#5A4A40]">
              Whether you run a banquet hall with a team of twenty or you are a decorator with two helpers, the work is the same: answer quickly, quote clearly, remember everything, and be paid on time. Vivah OS keeps that work in one place, in plain words.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {FOR.map((who) => (
              <li key={who} className="flex items-center gap-3 rounded-2xl border border-[#EFE6D8] bg-white px-5 py-4 text-[15px] font-medium">
                <span className="h-1.5 w-1.5 flex-shrink-0 rotate-45 bg-[#C5A46D]" />
                {who}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How to begin */}
      <section aria-labelledby="vivah-os-start" className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className={eyebrow}>How to begin</p>
            <h2 id="vivah-os-start" className="mt-4 text-3xl leading-tight sm:text-[42px]" style={serif}>Three steps to your first day on Vivah OS</h2>
          </div>
          <ol className="mt-12 grid gap-5 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-[22px] border border-[#EFE6D8] bg-white p-7">
                <p className="font-cormorant text-4xl italic text-[#C5A46D]">{s.n}</p>
                <h3 className="mt-3 text-xl" style={serif}>{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#6B5B4D]">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing */}
      <section aria-labelledby="vivah-os-cta" className="relative overflow-hidden bg-[#2A0614] px-4 py-16 text-center sm:px-6 sm:py-24">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-72 w-[42rem] max-w-full -translate-x-1/2 rounded-full bg-[#C5A46D]/12 blur-3xl" />
        <div className="relative mx-auto max-w-2xl">
          {on && <div className="mb-6 flex justify-center gap-4"><Diya size={36} /><Diya size={46} /><Diya size={36} /></div>}
          <h2 id="vivah-os-cta" className="text-3xl leading-tight text-white sm:text-[44px]" style={serif}>Bring your wedding business onto Vivah OS</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">Register your venue or wedding service. Our team reviews every registration and gets in touch.</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link href="/vendor-onboarding" className={primary}>Register your business <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            <a href="tel:+917646028228" className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/25 px-7 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10">Talk to our team</a>
          </div>
        </div>
      </section>
    </div>
  );
}
