'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Phone } from 'lucide-react';
import { festive } from '@/lib/festive';
import { Diya, MarigoldGarland } from '@/components/festive/Decor';

// The wedding-season hero (14 Oct 2026, founder: "richer & more royal — deep maroon and gold, bigger real wedding photos, more
// festive detail"). A maroon ground with a faint gold pattern and a rangoli behind the words; a marigold toran and a string of
// lights across the top; three real wedding photographs from our own library set in palace arches; diyas by the buttons.
// The photographs illustrate weddings in general — none is captioned as a particular venue or couple.
// Shown only while lib/festive.ts says the season is on; otherwise HeroSection shows the everyday hero.
const ease = [0.22, 1, 0.36, 1] as const;
const serif = { fontFamily: 'var(--font-playfair, serif)' };
const ring = 'outline-none focus-visible:ring-2 focus-visible:ring-[#F3E3C3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#3A0A1F]';

// A rangoli drawn in code — petals in rings, gold on maroon. Decoration only.
function Rangoli({ className = '' }: { className?: string }) {
  const ring1 = Array.from({ length: 12 }, (_, i) => i * 30);
  const ring2 = Array.from({ length: 24 }, (_, i) => i * 15);
  return (
    <svg aria-hidden viewBox="-100 -100 200 200" className={`pointer-events-none ${className}`}>
      <g fill="none" stroke="#C5A46D">
        <circle r="96" strokeWidth="0.6" strokeDasharray="2 4" />
        <circle r="78" strokeWidth="0.5" />
        <circle r="30" strokeWidth="0.8" />
        <circle r="12" strokeWidth="0.8" />
      </g>
      {ring2.map((a) => (
        <path key={`o${a}`} d="M0 -76 C 6 -66 6 -58 0 -50 C -6 -58 -6 -66 0 -76 Z" transform={`rotate(${a})`} fill="#C5A46D" opacity="0.55" />
      ))}
      {ring1.map((a) => (
        <path key={`i${a}`} d="M0 -48 C 12 -38 12 -26 0 -16 C -12 -26 -12 -38 0 -48 Z" transform={`rotate(${a})`} fill="none" stroke="#E9C98A" strokeWidth="1" />
      ))}
      {ring1.map((a) => (
        <circle key={`d${a}`} cx="0" cy="-88" r="2.2" transform={`rotate(${a + 15})`} fill="#F2A541" />
      ))}
      <circle r="5" fill="#F2A541" />
    </svg>
  );
}

// A string of small lights that sways across the top; the bulbs glow in turn (still for reduced motion — app/globals.css).
function StringLights({ className = '' }: { className?: string }) {
  const bulbs = Array.from({ length: 28 }, (_, i) => i);
  return (
    <svg aria-hidden viewBox="0 0 1400 60" preserveAspectRatio="none" className={`pointer-events-none block w-full ${className}`}>
      <path d="M0 8 Q 175 46 350 12 T 700 12 T 1050 12 T 1400 8" fill="none" stroke="#C5A46D" strokeWidth="1" opacity="0.6" />
      {bulbs.map((i) => {
        const x = 25 + i * 50;
        const y = 12 + Math.abs(Math.sin((x / 350) * Math.PI)) * 22;
        return (
          <g key={i}>
            <circle cx={x} cy={y + 6} r="9" fill="#FBD277" opacity="0.18" className="festive-glow" style={{ animationDelay: `${(i % 7) * 0.4}s` }} />
            <circle cx={x} cy={y + 6} r="3.2" fill={i % 3 === 0 ? '#FFE9A8' : '#F6B955'} />
          </g>
        );
      })}
    </svg>
  );
}

// A photograph in a palace-arch frame: gold outer line, a thin inner line, warm light over the picture.
function Arch({ src, alt, sizes, priority = false, className = '' }: { src: string; alt: string; sizes: string; priority?: boolean; className?: string }) {
  return (
    <div className={`relative rounded-t-[999px] rounded-b-[18px] border-[3px] border-[#C5A46D] bg-[#2A0614] p-[6px] shadow-[0_30px_70px_rgba(0,0,0,0.45)] ${className}`}>
      <div className="relative h-full w-full overflow-hidden rounded-t-[999px] rounded-b-[12px] ring-1 ring-[#E9C98A]/60">
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#3A0A1F]/45 via-transparent to-[#F2A541]/10" />
      </div>
    </div>
  );
}

export default function FestiveHero() {
  const { eyebrow, headline, supporting } = festive.hero;
  return (
    <section className="relative overflow-hidden bg-[#3A0A1F] text-[#F8F1E4]">
      {/* Ground: deep maroon, a warm glow, and a faint gold lattice. */}
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,#6E1438_0%,#3A0A1F_55%,#22050F_100%)]" />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #E9C98A 1.2px, transparent 0)', backgroundSize: '22px 22px' }}
      />
      <div aria-hidden className="pointer-events-none absolute -right-40 top-1/4 h-[520px] w-[520px] rounded-full bg-[#F2A541]/10 blur-3xl" />

      {/* Toran: marigolds and lights, just under the site header (36px strip + 52 / 64 / 72px menu). */}
      <div className="absolute inset-x-0 top-[88px] z-[5] sm:top-[100px] lg:top-[108px]">
        <MarigoldGarland className="h-10 sm:h-12 lg:h-14" />
        <StringLights className="-mt-3 h-8 opacity-90 sm:h-10" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-[168px] sm:px-6 sm:pt-[196px] lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:px-8 lg:pb-24 lg:pt-[210px]">
        {/* Words */}
        <div className="relative">
          <Rangoli className="absolute -left-24 -top-20 h-[420px] w-[420px] opacity-[0.12] sm:-left-16" />
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="relative flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#E9C98A] sm:text-xs sm:tracking-[0.32em]"
          >
            <span aria-hidden className="h-px w-10 bg-gradient-to-r from-transparent to-[#E9C98A]" />
            {eyebrow}
            <span aria-hidden className="hidden h-1.5 w-1.5 rotate-45 bg-[#E9C98A] sm:block" />
          </motion.p>

          <h1 className="relative mt-6 text-[2.6rem] font-semibold leading-[1.06] sm:text-6xl lg:text-[4.4rem]" style={serif}>
            {headline.map((part, i) => (
              <motion.span
                key={part}
                className="block"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 + i * 0.15, ease }}
              >
                {i === headline.length - 1 ? (
                  <span className="bg-gradient-to-r from-[#F6DFA6] via-[#E0B76A] to-[#C99A4E] bg-clip-text text-transparent">{part}</span>
                ) : (
                  part
                )}
              </motion.span>
            ))}
          </h1>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.45 }} className="relative mt-6 flex items-center gap-3">
            <span aria-hidden className="h-px w-16 bg-[#C5A46D]/70" />
            <span aria-hidden className="text-[#E9C98A]">❁</span>
            <span aria-hidden className="h-px w-16 bg-[#C5A46D]/70" />
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease }}
            className="relative mt-5 font-cormorant text-xl italic text-[#E9C98A] sm:text-2xl"
          >
            One dedicated wedding expert from planning to Vidai.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6, ease }}
            className="relative mt-3 max-w-xl text-[15px] leading-relaxed text-[#F8F1E4]/85 sm:text-lg"
          >
            {supporting}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7, ease }}
            className="relative mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
          >
            <Link
              href="/cities/patna/venue"
              className={`inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#F3D896] via-[#E2B865] to-[#C99A4E] px-8 text-[15px] font-semibold text-[#3A0A1F] shadow-[0_12px_36px_rgba(226,184,101,0.35)] transition hover:brightness-105 ${ring}`}
            >
              Explore Wedding Venues <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <a
              href="tel:+917646028228"
              className={`inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full border border-[#E9C98A]/60 px-7 text-[15px] font-medium text-[#F8F1E4] transition hover:bg-[#E9C98A]/10 ${ring}`}
            >
              <Phone className="h-4 w-4" aria-hidden /> Talk to a Wedding Expert
            </a>
          </motion.div>

          <div aria-hidden className="relative mt-8 hidden items-end gap-4 sm:flex">
            <Diya size={34} />
            <Diya size={44} />
            <Diya size={34} />
          </div>
        </div>

        {/* Photographs in palace arches: one large, two smaller beside it. */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2, ease }}
          className="relative mx-auto grid w-full max-w-[560px] grid-cols-[1.5fr_1fr] items-end gap-3 sm:gap-4"
        >
          <Arch src="/cat-venue-guides.jpg" alt="A wedding mandap under warm lights at night" sizes="(min-width: 1024px) 330px, 58vw" priority className="aspect-[3/4.2]" />
          <div className="grid gap-3 sm:gap-4">
            <Arch src="/guide-bridal.jpg" alt="A bride in an embroidered lehenga" sizes="(min-width: 1024px) 220px, 38vw" className="aspect-[3/4]" />
            <Arch src="/cat-photography.jpg" alt="A couple's hands with jasmine garlands during the wedding rituals" sizes="(min-width: 1024px) 220px, 38vw" className="aspect-[3/3.4]" />
          </div>
        </motion.div>
      </div>

      {/* A gold rule to close the hero. */}
      <div aria-hidden className="relative h-[3px] bg-gradient-to-r from-transparent via-[#C5A46D] to-transparent" />
    </section>
  );
}
