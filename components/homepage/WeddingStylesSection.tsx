'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import LazyVideo from './LazyVideo';

const WEDDING_STYLES = [
  {
    num: '01',
    label: 'Royal',
    desc: 'Grand palatial ceremonies — lavish decor, multi-cuisine catering, and complete coordination for 300+ guests.',
    video: '/videos/royal-wedding.mp4',
  },
  {
    num: '02',
    label: 'Minimal',
    desc: 'Where restraint becomes luxury. Refined gatherings where every curated detail quietly speaks of quality.',
    video: '/videos/minimal-wedding.mp4',
  },
  {
    num: '03',
    label: 'Destination',
    desc: 'Immersive celebrations in Goa, Rajasthan, Kerala — wherever your story begins, we handle every detail.',
    video: '/videos/destination-wedding.mp4',
  },
  {
    num: '04',
    label: 'Intimate',
    desc: 'Soulful ceremonies of 50 guests or fewer, where every emotion is felt and every moment is personal.',
    video: '/videos/intimate-wedding.mp4',
  },
];

export default function WeddingStylesSection() {
  return (
    <section className="bg-[#FFFCF7] overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-10 sm:py-14 border-b border-[#C5A46D]/10">
          <motion.div
            className="max-w-lg"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="eyebrow-luxury mb-3">Our Speciality</p>
            <h2
              className="font-semibold text-[#2A1F1B] text-2xl sm:text-4xl leading-tight"
              style={{ fontFamily: 'var(--font-playfair, serif)' }}
            >
              Every Wedding Style,<br />Beautifully Served
            </h2>
          </motion.div>
        </div>

        <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-3 py-5 pb-7 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:py-6 sm:pb-6 sm:overflow-x-visible">
          {WEDDING_STYLES.map((style, i) => (
            <motion.div
              key={style.label}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.1 }}
              whileHover={{ scale: 1.015 }}
              className={[
                'group relative overflow-hidden rounded-xl sm:rounded-2xl flex-shrink-0 snap-start w-[78vw] sm:w-auto',
                style.video
                  ? 'min-h-[260px] sm:min-h-[340px]'
                  : 'px-6 sm:px-10 lg:px-14 py-8 sm:py-12 hover:bg-[#FAF7F2] border border-[#C5A46D]/10 transition-colors duration-500',
              ].join(' ')}
            >
              {style.video ? (
                <>
                  <LazyVideo
                    src={style.video}
                    className="absolute inset-0 w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-[1800ms] ease-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1A0E09]/90 via-[#1A0E09]/45 to-[#1A0E09]/20" />
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1/3 pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse at bottom, rgba(197,164,109,0.12) 0%, transparent 70%)' }}
                  />
                  <div className="relative z-10 flex flex-col justify-end h-full px-8 sm:px-10 lg:px-14 py-8 sm:py-10">
                    <h3
                      className="mb-2 leading-tight text-white"
                      style={{ fontFamily: 'var(--font-playfair, serif)', fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', fontWeight: 600 }}
                    >
                      {style.label}
                    </h3>
                    <p className="text-white/65 text-xs leading-relaxed max-w-xs mb-5">{style.desc}</p>
                    <Link
                      href="/plan"
                      className="inline-flex items-center gap-2 text-[#C5A46D] text-[0.72rem] font-semibold tracking-[0.14em] uppercase group-hover:gap-4 transition-all duration-300"
                    >
                      <span>Plan This Wedding</span>
                      <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h3
                    className="mb-4 leading-tight transition-colors duration-300 group-hover:text-[#8B1A4A]"
                    style={{
                      fontFamily: 'var(--font-playfair, serif)',
                      fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
                      fontWeight: 600,
                      color: '#2A1F1B',
                    }}
                  >
                    {style.label}
                  </h3>
                  <p className="text-[#6B5B4D] text-sm leading-relaxed max-w-xs mb-8">{style.desc}</p>
                  <Link
                    href="/plan"
                    className="inline-flex items-center gap-2 text-[#C5A46D] text-[0.72rem] font-semibold tracking-[0.14em] uppercase group-hover:gap-4 transition-all duration-300"
                  >
                    <span>Plan This Wedding</span>
                    <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
                  </Link>
                </>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
