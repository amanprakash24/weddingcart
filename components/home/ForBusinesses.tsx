'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/events';
import { container, serif } from './styles';

// Business sign-ups are secondary on the homepage: one compact band near the end.
// The Growth Partner card follows lib/growthPartner/pageRules.test.ts: it only introduces the program and links
// to href="/growth-partner" (no form, no payout amount), and its clicks are tracked.
const LINKS = [
  { href: '/vendor-onboarding', title: 'List your venue or service', text: 'Register your business. Our team reviews every request and gets in touch.' },
  { href: '/growth-partner', title: 'Become a Growth Partner', text: 'Refer weddings and wedding businesses to ShaadiShopping.' },
  { href: '/vendor/login', title: 'Already with us?', text: 'Sign in with your mobile number and code.' },
];
const onCardClick = (href: string) => {
  if (href === '/growth-partner') trackEvent('growth_partner_cta_click', { location: 'homepage' });
};

export default function ForBusinesses() {
  return (
    <section aria-labelledby="home-business" className="bg-[var(--deep-dark)] px-4 py-14 sm:px-6 sm:py-16">
      <div className={container}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--gold-light)]">For venues and wedding businesses</p>
        <h2 id="home-business" className="mt-3 text-[1.7rem] leading-tight text-white sm:text-[2.1rem]" style={serif}>Grow your wedding business with us</h2>
        <ul className="mt-8 grid gap-3 md:grid-cols-3">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => onCardClick(l.href)}
                className="group flex h-full flex-col rounded-2xl border border-white/12 bg-white/[0.04] p-5 transition-colors hover:border-[var(--gold)]/60 hover:bg-white/[0.07] outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)]"
              >
                <span className="inline-flex items-center gap-2 text-base font-semibold text-white">
                  {l.title} <ArrowRight className="h-4 w-4 text-[var(--gold-light)] transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
                <span className="mt-2 text-sm leading-relaxed text-white/70">{l.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
