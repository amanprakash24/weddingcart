'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/events';
import { festive } from '@/lib/festive';
import { Diya, MarigoldGarland } from '@/components/festive/Decor';
import ProductPreview from '@/components/vivah-os/ProductPreview';

// The homepage's introduction of Vivah OS (14 Oct 2026) — the software behind Shaadi Shopping's weddings, now shown in public.
// It says what it is in one breath and sends people to /vivah-os; the preview beside it is a drawing with sample entries
// (components/vivah-os/ProductPreview.tsx), never a real dashboard. The garland and diyas appear only in the festive season.
const serif = { fontFamily: 'var(--font-playfair), serif' };

export default function VivahOsSection() {
  const on = festive.enabled;
  return (
    <section aria-labelledby="vivah-os-home" className="relative overflow-hidden bg-[#FBF3E4]">
      {on && <MarigoldGarland className="h-9 opacity-90 sm:h-11" />}
      <div aria-hidden className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-[#F2A541]/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-[#8B1A4A]/8 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#B08D55]">
            <span className="h-px w-8 bg-[#C5A46D]" />
            Introducing Vivah OS
          </p>
          <h2 id="vivah-os-home" className="mt-5 text-4xl leading-[1.12] text-[#2A1F1B] sm:text-[52px]" style={serif}>
            Now Is the Time <span className="italic text-[#8B1A4A]">to Revel.</span>
          </h2>
          <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-[#5A4A40]">
            Your wedding operating system to plan, organize, coordinate, and celebrate—all in one connected experience.
          </p>
          <ul className="mt-6 grid max-w-lg gap-2.5 text-sm text-[#4A3B32]">
            {['Enquiries, quotations and bookings in one place', 'Your team, each with their own sign-in and their own work', 'Built for the phone in your hand on the wedding day'].map((line) => (
              <li key={line} className="flex items-start gap-3">
                <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rotate-45 bg-[#C5A46D]" />
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-9 flex flex-wrap items-center gap-5">
            <Link
              href="/vivah-os"
              onClick={() => trackEvent('vivah_os_cta_click', { location: 'homepage' })}
              className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-gradient-to-r from-[#8B1A4A] via-[#9E2A55] to-[#C5A46D] px-8 text-[15px] font-semibold tracking-wide text-white shadow-[0_12px_32px_rgba(139,26,74,0.3)]"
            >
              Discover Vivah OS <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            {on && <Diya size={38} className="hidden sm:block" />}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 36 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="pr-3 sm:pr-8"
        >
          <ProductPreview />
        </motion.div>
      </div>
    </section>
  );
}
