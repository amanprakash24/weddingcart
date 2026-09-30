'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { trackEvent } from '@/lib/analytics/events';

// Homepage entry to the Growth Partner Program (docs/wedding-os/14-growth-partner.md). Introduces the program in the
// homepage's own luxury language and sends visitors to /growth-partner — no form here, so the homepage never reads
// like a recruitment site.
const serif = { fontFamily: 'var(--font-playfair), serif' };
const script = { fontFamily: 'var(--font-cormorant), Georgia, serif' };

export default function GrowthPartnerSection() {
  return (
    <section aria-labelledby="growth-partner-home" className="bg-[#FFFAF5] px-4 py-16 sm:px-6 sm:py-24">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto grid max-w-6xl overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_rgba(42,6,20,0.12)] lg:grid-cols-2"
      >
        <div className="relative min-h-[300px] lg:min-h-[520px]">
          <Image src="/cat-real-weddings.jpg" alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1E0510]/85 via-[#1E0510]/30 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-[#1E0510]/10" />
          <p className="absolute inset-x-6 bottom-6 text-2xl italic leading-snug text-white lg:hidden" style={script}>
            Your network → Shaadi Shopping → shared growth
          </p>
        </div>
        <div className="flex flex-col justify-center p-8 sm:p-12">
          <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#B08D55]">
            <span className="h-px w-8 bg-[#C5A46D]" />
            Have wedding industry contacts?
          </p>
          <h2 id="growth-partner-home" className="mt-5 text-4xl leading-tight text-[#2A1F1B] sm:text-[44px]" style={serif}>
            Become a Shaadi Shopping Growth Partner
          </h2>
          <p className="mt-3 text-3xl italic text-[#8B1A4A]" style={script}>Connect. Refer. Earn.</p>
          <p className="mt-5 text-[15px] leading-relaxed text-[#5A4A40]">
            Refer venues, vendors, clients or events to Shaadi Shopping and earn an agreed referral payout when your referral successfully converts into business.
          </p>
          <span className="mt-6 block h-px w-24 bg-gradient-to-r from-[#C5A46D] to-transparent" />
          <p className="mt-4 text-[12px] font-medium uppercase tracking-[0.18em] text-[#7A6556]">Part-time · Flexible · No joining fee</p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link
              href="/growth-partner"
              onClick={() => trackEvent('growth_partner_cta_click', { location: 'homepage' })}
              className="inline-flex min-h-[52px] items-center rounded-full bg-gradient-to-r from-[#8B1A4A] via-[#9E2A55] to-[#C5A46D] px-8 text-[15px] font-semibold tracking-wide text-white shadow-[0_12px_32px_rgba(139,26,74,0.3)]"
            >
              Become a Growth Partner →
            </Link>
            <Link
              href="/growth-partner#how"
              onClick={() => trackEvent('growth_partner_cta_click', { location: 'homepage-how' })}
              className="text-sm font-medium text-[#8B1A4A] underline decoration-[#C5A46D] underline-offset-4"
            >
              Learn how it works
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
