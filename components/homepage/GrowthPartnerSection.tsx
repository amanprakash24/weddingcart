'use client';

import Link from 'next/link';
import { Building2, Camera, Heart, PartyPopper, Handshake } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/events';

// Homepage entry to the Growth Partner Program (docs/wedding-os/14-growth-partner.md). Introduces the program and
// sends visitors to /growth-partner — no form here, so the homepage doesn't read like a recruitment site.
const MAROON = '#8B1A4A';
const serif = { fontFamily: 'var(--font-playfair), serif' };

export default function GrowthPartnerSection() {
  return (
    <section aria-labelledby="growth-partner-home" className="bg-[#FFFAF5] px-4 py-14 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-8 overflow-hidden rounded-3xl border border-[#C5A46D]/25 bg-white p-6 sm:p-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#C5A46D]">Have wedding industry contacts?</p>
          <h2 id="growth-partner-home" className="mt-2 text-3xl font-semibold text-[#2A1F1B] sm:text-4xl" style={serif}>
            Become a Shaadi Shopping Growth Partner
          </h2>
          <p className="mt-2 text-xl font-semibold" style={{ ...serif, color: MAROON }}>Connect. Refer. Earn.</p>
          <p className="mt-3 max-w-xl text-[#4A3F38]">
            Refer venues, vendors, clients or events to Shaadi Shopping and earn an agreed referral payout when your referral successfully converts into business.
          </p>
          <p className="mt-3 text-sm font-medium text-[#6B5B4D]">Part-time • Flexible • No joining fee</p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              href="/growth-partner"
              onClick={() => trackEvent('growth_partner_cta_click', { location: 'homepage' })}
              className="inline-flex min-h-[48px] items-center rounded-xl px-6 text-base font-semibold text-white shadow-md"
              style={{ background: MAROON }}
            >
              Become a Growth Partner →
            </Link>
            <Link href="/growth-partner#how" onClick={() => trackEvent('growth_partner_cta_click', { location: 'homepage-how' })} className="text-sm font-medium underline underline-offset-4" style={{ color: MAROON }}>
              Learn how it works
            </Link>
          </div>
        </div>

        {/* A simple "network" illustration: the partner in the middle, connecting the four kinds of referral. */}
        <div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-[320px]">
          <div className="absolute inset-[18%] rounded-full border-2 border-dashed border-[#C5A46D]/50" />
          <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-lg" style={{ background: MAROON }}>
            <Handshake className="h-10 w-10" />
          </div>
          {[
            { Icon: Building2, pos: 'left-1/2 top-0 -translate-x-1/2', label: 'Venues' },
            { Icon: Camera, pos: 'right-0 top-1/2 -translate-y-1/2', label: 'Vendors' },
            { Icon: Heart, pos: 'left-1/2 bottom-0 -translate-x-1/2', label: 'Clients' },
            { Icon: PartyPopper, pos: 'left-0 top-1/2 -translate-y-1/2', label: 'Events' },
          ].map(({ Icon, pos, label }) => (
            <div key={label} className={`absolute ${pos} flex flex-col items-center`}>
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#C5A46D]/40 bg-[#FFF3E6]">
                <Icon className="h-7 w-7" style={{ color: MAROON }} />
              </span>
              <span className="mt-1 text-xs font-medium text-[#6B5B4D]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
