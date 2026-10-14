'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Phone } from 'lucide-react';
import { festive } from '@/lib/festive';
import { Diya, MarigoldGarland } from '@/components/festive/Decor';

const ease = [0.22, 1, 0.36, 1] as const;

// The everyday hero, and — while the festive season is on (lib/festive.ts) — the same hero dressed for it: the same film and
// photograph, a warmer light, a marigold garland and diyas, and the season's own words. Switching the season off brings back
// exactly the everyday hero below.
const EVERYDAY = {
  eyebrow: "Shaadi Shopping — Patna's Wedding Planning Platform",
  headline: ['Plan Your Wedding', 'in Patna', 'With Confidence'],
  tagline: 'One dedicated wedding expert from planning to Vidai.',
  supporting: 'Find the right venue, decorator, caterer, photographer, makeup artist and more — based on your date, budget and guest count.',
};

export default function HeroSection() {
  const on = festive.enabled;
  const copy = on
    ? { eyebrow: festive.hero.eyebrow, headline: festive.hero.headline, tagline: 'One dedicated wedding expert from planning to Vidai.', supporting: festive.hero.supporting }
    : EVERYDAY;

  return (
    <section className="relative h-screen min-h-[640px] flex items-center overflow-hidden">
      <div className="absolute inset-0">
        <video autoPlay muted loop playsInline preload="none" poster="/images/hero-bg.jpg" className="absolute inset-0 w-full h-full object-cover">
          <source src="/videos/homepage.mp4" type="video/mp4" />
        </video>
      </div>
      <div
        className="absolute inset-0"
        style={{
          background: on
            ? 'linear-gradient(160deg, rgba(58,16,28,0.86) 0%, rgba(60,28,8,0.30) 55%, rgba(42,20,14,0.90) 100%)'
            : 'linear-gradient(160deg, rgba(42,31,27,0.84) 0%, rgba(0,0,0,0.22) 55%, rgba(42,31,27,0.88) 100%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none animate-hero-glow"
        style={{ background: on ? 'radial-gradient(circle at 40% 45%, rgba(242,165,65,0.20), transparent 60%)' : 'radial-gradient(circle at 40% 45%, rgba(179,142,75,0.15), transparent 60%)' }}
      />
      <div
        className="absolute bottom-0 left-1/4 w-1/2 h-[40%] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center bottom, rgba(197,164,109,0.13) 0%, transparent 70%)' }}
      />

      {on && (
        <>
          {/* Hangs just under the site header (36px announcement + 52 / 64 / 72px nav). */}
          <MarigoldGarland className="absolute inset-x-0 top-[88px] z-[5] h-10 opacity-95 sm:top-[100px] sm:h-12 lg:top-[108px] lg:h-14" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-6 z-[5] hidden items-end justify-between px-8 sm:flex lg:px-16">
            <span className="flex items-end gap-3"><Diya size={46} /><Diya size={34} className="opacity-90" /></span>
            <span className="flex items-end gap-3"><Diya size={34} className="opacity-90" /><Diya size={46} /></span>
          </div>
        </>
      )}

      <div className={`relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${on ? 'pt-28 sm:pt-40 lg:pt-44' : 'pt-24 sm:pt-36 lg:pt-40'}`}>
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0, ease }}
            className={`inline-flex items-center gap-2 backdrop-blur-sm border px-4 py-2 rounded-full text-[0.68rem] sm:text-xs font-medium mb-6 sm:mb-8 uppercase ${
              on ? 'bg-[#C5A46D]/12 border-[#C5A46D]/40 text-[#F3E3C3] tracking-[0.2em] sm:tracking-[0.28em]' : 'bg-white/8 border-white/15 text-white/80 tracking-[0.1em] sm:tracking-[0.14em]'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#C5A46D] flex-shrink-0" />
            {copy.eyebrow}
          </motion.div>

          <h1
            className={`font-semibold text-white leading-[1.14] mb-5 sm:mb-6 ${on ? 'text-[2.25rem] sm:text-5xl md:text-6xl lg:text-[4rem]' : 'text-[2rem] sm:text-4xl md:text-5xl lg:text-[3.75rem]'}`}
            style={{ fontFamily: 'var(--font-playfair, serif)' }}
          >
            <span className="block">
              {copy.headline.map((part, i) => (
                <motion.span
                  key={part}
                  className={on ? 'block' : 'inline-block'}
                  initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.7, delay: 0.05 + i * 0.15, ease }}
                >
                  {on && i === copy.headline.length - 1 ? <span className="text-[#E9C98A]">{part}</span> : part}
                  {!on && i < copy.headline.length - 1 ? ' ' : ''}
                </motion.span>
              ))}
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease }}
            className="font-cormorant italic text-[#C5A46D] text-lg sm:text-xl mb-3 sm:mb-4"
          >
            {copy.tagline}
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65, ease }}
            className={`${on ? 'text-white/80' : 'text-white/65'} text-sm sm:text-lg mb-8 sm:mb-10 max-w-md sm:max-w-xl leading-relaxed`}
          >
            {copy.supporting}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.75, ease }}
            className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3 sm:gap-4"
          >
            {on ? (
              <>
                <Link
                  href="/cities/patna/venue"
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 bg-[#8B1A4A] text-white px-7 sm:px-9 py-3.5 sm:py-4 rounded-full font-semibold text-sm shadow-xl hover:opacity-90 transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#F3E3C3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2A1F1B]"
                  style={{ boxShadow: '0 8px 40px rgba(139,26,74,0.45)' }}
                >
                  Explore Wedding Venues <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="tel:+917646028228"
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 bg-[#C5A46D]/14 backdrop-blur-sm border border-[#C5A46D]/55 text-[#F3E3C3] px-6 sm:px-7 py-3.5 sm:py-4 rounded-full font-medium text-sm hover:bg-[#C5A46D]/22 transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#F3E3C3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2A1F1B]"
                >
                  <Phone className="w-4 h-4" /> Talk to a Wedding Expert
                </a>
              </>
            ) : (
              <>
                <Link
                  href="/plan"
                  className="inline-flex items-center justify-center gap-2 bg-[#8B1A4A] text-white px-7 sm:px-9 py-3.5 sm:py-4 rounded-full font-semibold text-sm shadow-xl hover:opacity-90 transition-all"
                  style={{ boxShadow: '0 8px 40px rgba(139,26,74,0.45)' }}
                >
                  Begin Your Wedding Journey <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="tel:+917646028228"
                  className="inline-flex items-center justify-center gap-2 bg-white/8 backdrop-blur-sm border border-white/20 text-white/90 px-6 sm:px-7 py-3.5 sm:py-4 rounded-full font-medium text-sm hover:bg-white/14 transition-all"
                >
                  <Phone className="w-4 h-4" /> Talk to an Expert
                </a>
              </>
            )}
          </motion.div>
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 opacity-35 pointer-events-none">
        <div className="w-px h-10 bg-gradient-to-b from-transparent via-white to-transparent animate-pulse" />
      </div>
    </section>
  );
}
