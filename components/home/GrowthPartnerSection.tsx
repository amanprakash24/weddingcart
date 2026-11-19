'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { trackEvent } from '@/lib/analytics/events';
import HowDepth from './HowDepth';
import s3 from './home3d.module.css';
import { accent, btnOutline, btnPrimary, container, eyebrow, h2, sectionPad, serif } from './styles';

// Introduces the Growth Partner Program (lib/growthPartner/pageRules.test.ts): words from /growth-partner, no form,
// no payout amount, and the click to the program page is tracked.
const LINK = { href: '/growth-partner', label: 'Become a Growth Partner' };
const REFER = [
  { title: 'Venue', text: 'Banquet halls, hotels, resorts and wedding venues.' },
  { title: 'Vendor', text: 'Photographers, decorators, caterers, makeup, DJs, mehendi.' },
  { title: 'Client', text: 'Couples, families, or anyone planning a wedding.' },
  { title: 'Event', text: 'Wedding, engagement, reception, corporate events.' },
];
const STEPS = [
  { title: 'Connect', text: 'Find a genuine wedding opportunity.' },
  { title: 'Refer', text: 'Introduce them to Shaadi Shopping.' },
  { title: 'Business', text: 'We handle the quotation and process.' },
  { title: 'Complete', text: 'The referred business completes.' },
  { title: 'Earn', text: 'You receive the agreed referral payout.' },
];
// In 3D (19 Nov 2026): the four referral cards turn in one by one, and the five steps lie on a board that tilts up while
// each step lifts off it in turn. HowDepth drives it from the scroll position.
const onClick = () => trackEvent('growth_partner_cta_click', { location: 'homepage' });

export default function GrowthPartnerSection() {
  return (
    <section id="growth-partner" aria-labelledby="home-growth" className={`${s3.gp} relative scroll-mt-28 overflow-hidden border-t border-[#E2D3BC] bg-gradient-to-b from-[#F6EBD9] to-[#F1E2C8] ${sectionPad}`}>
      <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute -bottom-36 -left-36 h-[460px] w-[460px] opacity-20">
        <g fill="none" stroke="#B08A4A" strokeWidth=".6"><circle cx="100" cy="100" r="96" /><circle cx="100" cy="100" r="70" /><circle cx="100" cy="100" r="44" /><path d="M100 4v192M4 100h192M32 32l136 136M168 32L32 168" /></g>
      </svg>
      <div className={`${container} relative`}>
        <div className="grid items-end gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className={eyebrow}>Shaadi Shopping Growth Partner</p>
            <h2 id="home-growth" className={h2} style={serif}>Have wedding contacts? <span className={accent}>Connect. Refer. Earn.</span></h2>
            <p className="mt-5 text-base leading-relaxed text-[#4D3E36] sm:text-lg">
              Turn your network into opportunities. You bring the opportunity, we handle the business. When it completes, you receive the agreed referral payout.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {['No joining fee', 'Part-time & flexible', 'Performance-based'].map((t) => (
                <li key={t} className="rounded-full border border-[#C9A86A] bg-white px-3.5 py-1.5 text-[13px] font-bold tracking-wide text-[#8A6A2F]">{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#6B5A4E]">What you can refer</p>
            <ul data-gp-refer className={`${s3.gpRefer} mt-3 grid grid-cols-2 gap-3`}>
              {REFER.map((r, i) => (
                <li key={r.title} className={s3.gpCard} style={{ '--i': i } as CSSProperties}>
                  <div data-tilt className="h-full rounded-[20px] border border-[#E2D3BC] bg-white p-4 shadow-[0_18px_40px_rgba(34,23,20,0.08)] sm:p-5">
                    <h3 className="text-[1.7rem] font-semibold leading-none text-[#7A1238]" style={serif}>{r.title}</h3>
                    <p className="mt-2 text-sm leading-snug text-[#4D3E36]">{r.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div data-gp-board className={`${s3.gpBoard} relative mt-12 rounded-[28px] border border-[#E2D3BC] bg-white/70 px-5 py-8 shadow-[0_40px_80px_rgba(34,23,20,0.12)] sm:px-8`}>
          <div aria-hidden className="absolute left-[12%] right-[12%] top-[59px] hidden h-px bg-[repeating-linear-gradient(90deg,#C9A86A_0_6px,transparent_6px_12px)] sm:block" />
          <ol className={`${s3.gpSteps} relative grid grid-cols-2 gap-6 sm:grid-cols-5 sm:gap-4`}>
            {STEPS.map((s, i) => {
              const last = i === STEPS.length - 1;
              return (
                <li key={s.title} className={`${s3.gpStep} text-center`} style={{ '--i': i } as CSSProperties}>
                  <span className={`mx-auto flex h-[54px] w-[54px] items-center justify-center rounded-full text-2xl font-bold ${last ? 'bg-[#7A1238] text-white' : 'border border-[#C9A86A] bg-white text-[#7A1238]'}`} style={serif}>
                    {i + 1}
                  </span>
                  <h3 className="mt-3 font-bold text-[#221714]">{s.title}</h3>
                  <p className="mt-1 text-sm leading-snug text-[#4D3E36]">{s.text}</p>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link href={LINK.href} onClick={onClick} className={btnPrimary}>{LINK.label}</Link>
          <Link href="/growth-partner#how" onClick={onClick} className={btnOutline}>How it works</Link>
          <span className="text-sm text-[#6B5A4E]">Genuine referrals only. Every referral is verified by our team.</span>
        </div>
      </div>
      <HowDepth
        sectionId="growth-partner"
        vars={[
          { sel: '[data-gp-refer]', name: '--r', start: 0.95, span: 0.5 },
          { sel: '[data-gp-board]', name: '--g', start: 1, span: 0.4 },
        ]}
      />
    </section>
  );
}
