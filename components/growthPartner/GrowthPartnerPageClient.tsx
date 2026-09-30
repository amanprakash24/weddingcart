'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, MotionConfig } from 'framer-motion';
import { IndianRupee, Clock, Handshake, BadgeCheck, Phone, MessageCircle, Plus, Minus } from 'lucide-react';
import GrowthPartnerForms from './GrowthPartnerForms';
import { trackEvent } from '@/lib/analytics/events';
import { SHAADI_PHONE, SHAADI_PHONE_DISPLAY, shaadiWhatsAppLink } from '@/lib/shaadiContact';

// Growth Partner Program page (docs/wedding-os/14-growth-partner.md), in the same luxury language as the homepage:
// cinematic imagery with deep maroon overlays, Playfair headlines, gold Cormorant italics, gold hairlines, generous
// space. Our own wedding photography only. No fixed payout amounts anywhere — payout depends on agreed terms.

const serif = { fontFamily: 'var(--font-playfair), serif' };
const script = { fontFamily: 'var(--font-cormorant), Georgia, serif' };

const WHO = [
  'Event Planners & Coordinators', 'Wedding Professionals', 'Photographers', 'Decorators', 'Caterers', 'Makeup Artists',
  'DJs & Entertainment', 'Banquet, Hotel & Resort Staff', 'Venue Managers & Sales Executives', 'Freelancers', 'Students',
  'Part-time Workers', 'Local Networkers', 'Anyone with genuine wedding contacts',
];
const REFER = [
  { title: 'Venue', text: 'Banquet halls, hotels, resorts and wedding venues.', img: '/cat-venue-guides.jpg', pos: 'object-center' },
  { title: 'Vendor', text: 'Photographers, decorators, caterers, makeup artists, DJs, mehendi and other wedding services.', img: '/guide-photography.jpg', pos: 'object-center' },
  { title: 'Client', text: 'Couples, families, bride/groom or anyone planning a wedding.', img: '/cat-real-weddings.jpg', pos: 'object-center' },
  { title: 'Event', text: 'Wedding, engagement, reception, corporate or other events.', img: '/cat-destination.jpg', pos: 'object-center' },
];
const STEPS = [
  { title: 'Connect', text: 'Find a genuine wedding-related opportunity.' },
  { title: 'Refer', text: 'Introduce the person, business or client to Shaadi Shopping.' },
  { title: 'Business', text: 'We handle the requirement, discussion, quotation and business process.' },
  { title: 'Complete', text: 'The referred business successfully converts and completes.' },
  { title: 'Earn', text: 'You receive the agreed referral payout.' },
];
const WHY = [
  { icon: IndianRupee, title: 'No joining fee', text: 'No investment, ever.' },
  { icon: Clock, title: 'Part-time & flexible', text: 'Refer whenever an opportunity comes your way.' },
  { icon: Handshake, title: 'You introduce, we deliver', text: 'Our team handles the entire business process.' },
  { icon: BadgeCheck, title: 'Performance-based', text: 'Payout after successful business completion.' },
];
const FAQ = [
  ['Who can become a Growth Partner?', 'Anyone with genuine wedding-related contacts or a useful network.'],
  ['Is this a full-time job?', 'No. It is a part-time, flexible referral opportunity.'],
  ['Is there a joining fee?', 'No.'],
  ['What can I refer?', 'Venues, vendors, clients and events.'],
  ['Do I need to close the deal?', 'No. Your primary role is to make a genuine introduction. Shaadi Shopping handles the business process.'],
  ['Can I submit multiple referrals?', 'Yes.'],
  ['When will I receive payment?', 'After successful business completion, according to the agreed referral terms.'],
  ['How much can I earn?', 'The referral payout depends on the category and the deal, and will be communicated according to the applicable referral terms.'],
  ['What if two people refer the same business?', 'Referral ownership is decided by the verified referral / first valid introduction rules.'],
];

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] ${light ? 'text-[#E9C98E]' : 'text-[#B08D55]'}`}>
      <span className={`h-px w-8 ${light ? 'bg-[#E9C98E]/70' : 'bg-[#C5A46D]'}`} />
      {children}
    </p>
  );
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

const primaryBtn =
  'inline-flex min-h-[54px] items-center justify-center rounded-full bg-gradient-to-r from-[#8B1A4A] via-[#9E2A55] to-[#C5A46D] px-8 text-[15px] font-semibold tracking-wide text-white shadow-[0_12px_32px_rgba(139,26,74,0.35)] transition hover:shadow-[0_16px_40px_rgba(139,26,74,0.45)]';
const ghostBtn = 'inline-flex min-h-[54px] items-center justify-center rounded-full border border-white/40 px-7 text-[15px] font-medium text-white backdrop-blur-sm transition hover:bg-white/10';

export default function GrowthPartnerPageClient() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <MotionConfig reducedMotion="user">
      <div className="bg-[#FFFAF5] text-[#2A1F1B]">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="relative flex min-h-[100svh] items-center overflow-hidden bg-[#1E0510]">
          <motion.div className="absolute inset-0" initial={{ scale: 1.12 }} animate={{ scale: 1 }} transition={{ duration: 14, ease: 'easeOut' }}>
            <Image src="/images/hero-bg.jpg" alt="" fill priority sizes="100vw" className="object-cover object-center" />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#1E0510]/95 via-[#3A0A1E]/80 to-[#3A0A1E]/35" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#1E0510]/80 to-transparent" />

          <div className="relative mx-auto w-full max-w-6xl px-5 pb-20 pt-40 sm:px-8">
            <Reveal>
              <Eyebrow light>Shaadi Shopping</Eyebrow>
              <h1 className="mt-6 max-w-3xl text-[44px] leading-[1.05] text-white sm:text-6xl lg:text-7xl" style={serif}>
                Growth Partner
                <br />
                Program
              </h1>
              <p className="mt-4 text-3xl italic text-[#E9C98E] sm:text-4xl" style={script}>
                Connect. Refer. Earn.
              </p>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/90">Have wedding-related contacts? Turn your network into opportunities with Shaadi Shopping.</p>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/70">
                Refer venues, vendors, clients or events. We handle the business process. Successful business completion earns you an agreed referral payout.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a href="#register" onClick={() => trackEvent('growth_partner_cta_click', { location: 'hero' })} className={primaryBtn}>
                  Become a Growth Partner
                </a>
                <a href="#how" className={ghostBtn}>How it works ↓</a>
              </div>
              <div className="mt-10 flex max-w-xl items-center gap-4">
                <span className="h-px flex-1 bg-gradient-to-r from-[#E9C98E]/70 to-transparent" />
              </div>
              <p className="mt-4 text-[13px] tracking-[0.12em] text-white/75">NO JOINING FEE · PART-TIME · FLEXIBLE · PERFORMANCE-BASED</p>
            </Reveal>
          </div>
        </section>

        {/* ── Who can join ─────────────────────────────────────────────────── */}
        <section className="px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
            <Reveal>
              <Eyebrow>Who can join</Eyebrow>
              <h2 className="mt-5 text-4xl leading-tight sm:text-5xl" style={serif}>
                For people who know
                <br />
                the wedding world
              </h2>
              <p className="mt-8 border-l-2 border-[#C5A46D] pl-5 text-2xl italic leading-snug text-[#8B1A4A]" style={script}>
                “You don’t need to be a wedding expert. You need a genuine network and the ability to make introductions.”
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <ul className="grid gap-x-8 sm:grid-cols-2">
                {WHO.map((w) => (
                  <li key={w} className="flex items-center gap-3 border-b border-[#E8DCC8] py-3.5 text-[15px] text-[#3D322B]">
                    <span className="h-1.5 w-1.5 shrink-0 rotate-45 bg-[#C5A46D]" />
                    {w}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* ── What you can refer ───────────────────────────────────────────── */}
        <section className="bg-white px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <Reveal className="text-center">
              <div className="flex justify-center"><Eyebrow>Four ways to refer</Eyebrow></div>
              <h2 className="mt-5 text-4xl sm:text-5xl" style={serif}>What can you refer?</h2>
            </Reveal>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {REFER.map((r, i) => (
                <Reveal key={r.title} delay={i * 0.08}>
                  <article className="group relative aspect-[4/5] overflow-hidden rounded-[22px] shadow-[0_18px_40px_rgba(42,6,20,0.12)] sm:aspect-[3/4]">
                    <Image src={r.img} alt="" fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className={`object-cover ${r.pos} transition duration-700 group-hover:scale-105`} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1E0510]/95 via-[#1E0510]/45 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-6">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#E9C98E]">Refer a</p>
                      <h3 className="mt-1 text-3xl text-white" style={serif}>{r.title}</h3>
                      <span className="mt-3 block h-px w-10 bg-[#E9C98E] transition-all duration-500 group-hover:w-20" />
                      <p className="mt-3 text-sm leading-relaxed text-white/85">{r.text}</p>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <section id="how" className="scroll-mt-32 px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <Reveal className="text-center">
              <div className="flex justify-center"><Eyebrow>How it works</Eyebrow></div>
              <h2 className="mt-5 text-4xl sm:text-5xl" style={serif}>Five simple steps</h2>
              <p className="mt-4 text-2xl italic text-[#8B1A4A]" style={script}>You bring the opportunity. We handle the business.</p>
            </Reveal>
            <ol className="relative mt-16 grid gap-10 lg:grid-cols-5 lg:gap-6">
              <span aria-hidden="true" className="absolute left-[27px] top-2 h-[calc(100%-1rem)] w-px bg-gradient-to-b from-[#C5A46D] via-[#C5A46D]/60 to-transparent lg:left-[10%] lg:right-[10%] lg:top-[27px] lg:h-px lg:w-auto lg:bg-gradient-to-r lg:from-transparent lg:via-[#C5A46D] lg:to-transparent" />
              {STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 0.1}>
                  <li className="relative flex gap-5 lg:flex-col lg:items-center lg:text-center">
                    <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#C5A46D] bg-[#FFFAF5] text-xl italic text-[#8B1A4A] shadow-[0_0_0_6px_#FFFAF5]" style={script}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-[#2A1F1B] lg:mt-5">{s.title}</h3>
                      <p className="mt-2 text-[15px] leading-relaxed text-[#5A4A40]">{s.text}</p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Why partner + how payment works ──────────────────────────────── */}
        <section className="relative overflow-hidden bg-[#2A0614] px-5 py-20 text-white sm:px-8 sm:py-28">
          <div aria-hidden="true" className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#C5A46D]/10 blur-3xl" />
          <div aria-hidden="true" className="absolute -bottom-48 -left-40 h-[520px] w-[520px] rounded-full bg-[#8B1A4A]/40 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1.15fr_1fr] lg:items-center">
            <Reveal>
              <Eyebrow light>Why partner with us</Eyebrow>
              <h2 className="mt-5 text-4xl leading-tight sm:text-5xl" style={serif}>
                Your network,
                <br />
                <span className="italic text-[#E9C98E]" style={script}>shared growth</span>
              </h2>
              <ul className="mt-10 grid gap-7 sm:grid-cols-2">
                {WHY.map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#E9C98E]/50">
                      <Icon className="h-5 w-5 text-[#E9C98E]" />
                    </span>
                    <div>
                      <p className="font-semibold">{title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-white/70">{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="rounded-[26px] border border-[#E9C98E]/30 bg-white/[0.04] p-8 backdrop-blur-sm sm:p-10">
                <Eyebrow light>How payment works</Eyebrow>
                <p className="mt-6 text-2xl italic leading-snug text-white" style={script}>
                  Referral payout is based on the referral category, business value and agreed terms. Payment is made after successful business completion.
                </p>
                <span className="mt-8 block h-px bg-gradient-to-r from-[#E9C98E]/70 to-transparent" />
                <p className="mt-6 text-sm leading-relaxed text-white/70">Genuine referrals only — every referral is verified by our team before any business begins.</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Join / refer ─────────────────────────────────────────────────── */}
        <section id="register" className="scroll-mt-32 px-5 py-20 sm:px-8 sm:py-28">
          <span id="refer" className="block scroll-mt-32" />
          <div className="mx-auto max-w-3xl">
            <Reveal className="text-center">
              <div className="flex justify-center"><Eyebrow>Join the circle</Eyebrow></div>
              <h2 className="mt-5 text-4xl sm:text-5xl" style={serif}>Become a Growth Partner</h2>
              <p className="mt-4 text-2xl italic text-[#8B1A4A]" style={script}>A minute to join. A lifetime of introductions.</p>
            </Reveal>
            <Reveal delay={0.1} className="mt-12">
              <GrowthPartnerForms />
            </Reveal>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section className="bg-white px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <Reveal>
              <Eyebrow>Questions</Eyebrow>
              <h2 className="mt-5 text-4xl leading-tight sm:text-5xl" style={serif}>Everything you’d like to know</h2>
              <p className="mt-6 text-[15px] leading-relaxed text-[#5A4A40]">Still have a question? Our team is happy to help.</p>
              <div className="mt-6 flex flex-col gap-3 text-[15px]">
                <a href={`tel:${SHAADI_PHONE}`} className="inline-flex items-center gap-2 text-[#8B1A4A]"><Phone className="h-4 w-4" />{SHAADI_PHONE_DISPLAY}</a>
                <a href={shaadiWhatsAppLink('Hi, I want to know more about the Shaadi Shopping Growth Partner Program.')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[#8B1A4A]">
                  <MessageCircle className="h-4 w-4" />WhatsApp us
                </a>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="border-t border-[#E8DCC8]">
                {FAQ.map(([q, a], i) => (
                  <div key={q} className="border-b border-[#E8DCC8]">
                    <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-6 py-5 text-left">
                      <span className="text-lg text-[#2A1F1B]" style={serif}>{q}</span>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#C5A46D]/60 text-[#B08D55]">
                        {open === i ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </span>
                    </button>
                    {open === i && <p className="-mt-1 pb-6 pr-12 text-[15px] leading-relaxed text-[#5A4A40]">{a}</p>}
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden px-5 py-28 text-center sm:px-8 sm:py-36">
          <Image src="/cat-decor-flowers.jpg" alt="" fill sizes="100vw" className="object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1E0510]/85 via-[#2A0614]/80 to-[#1E0510]/90" />
          <Reveal className="relative mx-auto max-w-3xl text-white">
            <div className="flex justify-center"><Eyebrow light>Grow with us</Eyebrow></div>
            <h2 className="mt-6 text-5xl leading-tight sm:text-6xl" style={serif}>Have the network?</h2>
            <p className="mt-3 text-3xl italic text-[#E9C98E]" style={script}>Grow with Shaadi Shopping.</p>
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.35em] text-white/85">Connect. Refer. Earn.</p>
            <div className="mt-10">
              <a href="#register" onClick={() => trackEvent('growth_partner_cta_click', { location: 'final' })} className={primaryBtn}>
                Become a Growth Partner
              </a>
            </div>
            <p className="mt-6 text-[13px] tracking-[0.12em] text-white/70">NO JOINING FEE · PART-TIME · FLEXIBLE · PERFORMANCE-BASED</p>
          </Reveal>
        </section>
      </div>
    </MotionConfig>
  );
}
