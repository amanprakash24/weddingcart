'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { festive } from '@/lib/festive';
import { MarigoldGarland } from '@/components/festive/Decor';
import ConnectedWedding from '@/components/vivah-os/ConnectedWedding';

// The homepage's introduction of Vivah OS (14 Oct 2026) — the next chapter, told in plain words, after the venue and vendor
// sections so it never competes with finding a venue. It makes no claim about what is finished: it is "in early access", and each
// audience gets its own way in (/vivah-os#couples, /vivah-os#business), where what exists today is set apart from what is planned.
// The drawing is an illustration of the idea, not a screenshot. The garland appears only in the festive season (lib/festive.ts).
const serif = { fontFamily: 'var(--font-playfair), serif' };

export default function VivahOsSection() {
  return (
    <section aria-labelledby="vivah-os-home" className="relative overflow-hidden bg-[#F8F3EA]">
      {festive.enabled && <MarigoldGarland className="h-9 opacity-90 sm:h-11" />}
      <div aria-hidden className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-[#C5A46D]/14 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-[#8B1A4A]/8 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#8A6A2F]">
            <span className="h-px w-8 bg-[#C5A46D]" />
            Introducing Vivah OS
            <span className="rounded-full border border-[#C5A46D]/60 px-2.5 py-1 text-[10px] tracking-[0.18em] text-[#8B1A4A]">Early access</span>
          </p>
          <h2 id="vivah-os-home" className="mt-5 text-[2.1rem] leading-[1.14] text-[#2A1F1B] sm:text-[46px]" style={serif}>
            A New Chapter in <span className="italic text-[#8B1A4A]">Connected</span> Wedding Planning.
          </h2>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-[#5A4A40]">
            Shaadi Shopping helps you discover the right wedding services. Vivah OS is our next step toward bringing the wedding journey into a more connected, organized experience for couples, venues, and wedding businesses.
          </p>
          <p className="mt-5 max-w-xl font-cormorant text-[1.35rem] italic leading-snug text-[#8B1A4A]">
            One wedding. One Wedding ID. One connected workspace.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Link
              href="/vivah-os#couples"
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#8B1A4A] px-8 text-[15px] font-semibold tracking-wide text-white shadow-[0_12px_32px_rgba(139,26,74,0.28)] transition-opacity hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-[#8B1A4A] focus-visible:ring-offset-2"
            >
              For Couples <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/vivah-os#business"
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-[#8B1A4A]/35 bg-white/60 px-8 text-[15px] font-semibold tracking-wide text-[#8B1A4A] transition-colors hover:bg-[#8B1A4A] hover:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#8B1A4A] focus-visible:ring-offset-2"
            >
              For Venues &amp; Vendors <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <ConnectedWedding />
        </motion.div>
      </div>
    </section>
  );
}
