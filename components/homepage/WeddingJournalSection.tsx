'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import LazyVideo from './LazyVideo';

const WEDDINGS = [
  {
    num: '001',
    title: 'The Jaipur Palace Ceremony',
    city: 'Jaipur, Rajasthan',
    desc: 'A 600-guest royal celebration across three palace venues. Eight-cuisine catering, hand-crafted décor, and live entertainment — all coordinated by our team.',
    tags: ['Venue', 'Catering', 'Décor', 'Entertainment'],
    img: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=1200&q=85',
    video: '/videos/jaipur-wedding.mp4',
  },
  {
    num: '002',
    title: 'The Goa Beachside Wedding',
    city: 'North Goa',
    desc: 'An intimate 120-guest destination wedding on a private beach. Custom florals, live music, seaside accommodation, and seamless logistics.',
    tags: ['Destination', 'Floral', 'Accommodation', 'Music'],
    img: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=1200&q=85',
    video: '/videos/goa-wedding.mp4',
  },
  {
    num: '003',
    title: 'The Delhi Grand Reception',
    city: 'New Delhi',
    desc: '1,200 guests. Five-star hotel. Catering, photography, décor, mehndi, bridal makeup — fully coordinated end-to-end, zero stress.',
    tags: ['Full Coordination', 'Photography', 'Makeup', 'Catering'],
    img: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&q=85',
  },
];

export default function WeddingJournalSection() {
  return (
    <section className="relative bg-[#2A1F1B] overflow-hidden">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[70%] h-[30%] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top, rgba(197,164,109,0.09) 0%, transparent 65%)' }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-22 pb-10 sm:pb-14 text-center">
        <motion.div
          initial={{ opacity: 0, y: 22, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="h-px w-12" style={{ background: 'linear-gradient(to right, transparent, rgba(197,164,109,0.5))' }} />
            <span className="text-[#C5A46D]/60 text-[0.55rem] tracking-[0.4em] uppercase font-medium">Wedding Journal</span>
            <div className="h-px w-12" style={{ background: 'linear-gradient(to left, transparent, rgba(197,164,109,0.5))' }} />
          </div>

          <h2 className="leading-[1.15] mb-6" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
            <span className="block text-[2rem] sm:text-[2.6rem] lg:text-[3.4rem] font-light text-white/80 tracking-wide">
              Celebrations Curated
            </span>
            <span
              className="block text-[2.6rem] sm:text-[3.4rem] lg:text-[4.4rem] font-semibold"
              style={{
                background: 'linear-gradient(135deg, #e8d5b0 0%, #C5A46D 45%, #a07c45 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              by ShaadiShopping
            </span>
          </h2>

          <div className="flex items-center justify-center gap-4 mb-1">
            <div className="h-px w-16" style={{ background: 'linear-gradient(to right, transparent, rgba(197,164,109,0.35))' }} />
            <span className="text-[#C5A46D]/30 text-[0.5rem]">◆</span>
            <p className="font-cormorant italic text-white/35 text-base sm:text-lg tracking-wide">
              Real weddings. Real stories. Real joy.
            </p>
            <span className="text-[#C5A46D]/30 text-[0.5rem]">◆</span>
            <div className="h-px w-16" style={{ background: 'linear-gradient(to left, transparent, rgba(197,164,109,0.35))' }} />
          </div>
        </motion.div>
      </div>

      {WEDDINGS.map((w, i) => {
        const flip = i % 2 === 1;
        return (
          <motion.div
            key={w.num}
            className="relative z-10 flex flex-col lg:flex-row"
            style={{ minHeight: '70vh' }}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8 }}
          >
            <div
              className={`relative w-full lg:w-1/2 min-h-[56vw] sm:min-h-[45vw] lg:min-h-0 overflow-hidden ${flip ? 'lg:order-2' : 'lg:order-1'}`}
            >
              <motion.div
                className="absolute inset-0"
                initial={{ scale: 1.06 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
              >
                {w.video ? (
                  <LazyVideo src={w.video} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <Image src={w.img} fill alt={w.title} sizes="50vw" className="object-cover" />
                )}
              </motion.div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#2A1F1B]/60 via-[#2A1F1B]/10 to-transparent" />
              <div className="absolute bottom-5 left-6 pointer-events-none">
                <p
                  className="font-cormorant font-light leading-none select-none"
                  style={{ fontSize: '5rem', color: 'rgba(197,164,109,0.15)' }}
                >
                  {w.num}
                </p>
              </div>
            </div>

            <div
              className={`w-full lg:w-1/2 flex items-center justify-center px-6 sm:px-10 lg:px-16 py-10 lg:py-16 ${flip ? 'lg:order-1' : 'lg:order-2'}`}
            >
              <motion.div
                className="max-w-md w-full text-center lg:text-left"
                initial={{ opacity: 0, y: 28, filter: 'blur(6px)' }}
                whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.85, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="text-[0.6rem] tracking-[0.32em] uppercase text-[#C5A46D]/70 mb-3">{w.city}</p>
                <h3
                  className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white leading-tight mb-5"
                  style={{ fontFamily: 'var(--font-playfair, serif)' }}
                >
                  {w.title}
                </h3>
                <motion.div
                  className="h-px mb-6 mx-auto lg:mx-0"
                  style={{ background: 'linear-gradient(to right, #C5A46D, transparent)' }}
                  initial={{ width: 0 }}
                  whileInView={{ width: 48 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                />
                <p className="text-[#8A7A6A] text-sm sm:text-base leading-relaxed mb-7">{w.desc}</p>
                <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                  {w.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] text-[#C5A46D]/70 px-3 py-1.5 rounded-full tracking-wide"
                      style={{
                        background: 'rgba(197,164,109,0.07)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        border: '1px solid rgba(197,164,109,0.14)',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>
        );
      })}

      <motion.div
        className="text-center pb-24 sm:pb-32 pt-10 sm:pt-14"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center justify-center gap-4 mb-10">
          <div className="h-px w-20" style={{ background: 'linear-gradient(to right, transparent, rgba(197,164,109,0.25))' }} />
          <span className="text-[#C5A46D]/25 text-[0.45rem]">◆ ◆ ◆</span>
          <div className="h-px w-20" style={{ background: 'linear-gradient(to left, transparent, rgba(197,164,109,0.25))' }} />
        </div>

        <Link
          href="/plan"
          className="inline-flex items-center gap-3 relative overflow-hidden group rounded-full px-10 py-4 transition-all duration-500 hover:scale-[1.04]"
          style={{
            background: 'linear-gradient(135deg, rgba(197,164,109,0.08) 0%, rgba(197,164,109,0.04) 100%)',
            border: '1px solid rgba(197,164,109,0.35)',
            boxShadow: '0 0 0 0 rgba(197,164,109,0)',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.boxShadow = '0 0 40px rgba(197,164,109,0.15), inset 0 0 30px rgba(197,164,109,0.05)';
            el.style.borderColor = 'rgba(197,164,109,0.6)';
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.boxShadow = '0 0 0 0 rgba(197,164,109,0)';
            el.style.borderColor = 'rgba(197,164,109,0.35)';
          }}
        >
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[#C5A46D]/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
          <Sparkles className="w-4 h-4 text-[#C5A46D]/70 relative z-10 flex-shrink-0" />
          <span
            className="relative z-10 text-sm sm:text-base font-medium tracking-[0.12em] uppercase"
            style={{
              background: 'linear-gradient(135deg, #e8d5b0 0%, #C5A46D 50%, #d4aa6a 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Begin Your Wedding Journey
          </span>
          <ArrowRight className="w-4 h-4 text-[#C5A46D]/60 relative z-10 flex-shrink-0 group-hover:translate-x-1 transition-transform duration-300" />
        </Link>

        <p className="mt-5 text-[0.65rem] text-white/20 tracking-[0.22em] uppercase">Handcrafted for every love story</p>
      </motion.div>
    </section>
  );
}
