'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, MotionConfig } from 'framer-motion';
import { Phone } from 'lucide-react';
import HeroSection from './homepage/HeroSection';
import TrustStats from './homepage/TrustStats';
import JourneySection from './homepage/JourneySection';
import WeddingStylesSection from './homepage/WeddingStylesSection';
import WeddingJournalSection from './homepage/WeddingJournalSection';
import TestimonialsSection from './homepage/TestimonialsSection';
import CitiesSection from './homepage/CitiesSection';
import ExpertSection from './homepage/ExpertSection';
import FeaturedVendorsSection from './homepage/FeaturedVendorsSection';
import FinalCtaSection from './homepage/FinalCtaSection';

const MARQUEE_ITEMS = [
  'Venues', 'Photographers', 'Decorators', 'Mehndi Artists',
  'Makeup & Bridal', 'Catering', 'DJ & Bands', 'Wedding Planners',
  'Jewellery', 'Pandits',
];

const AS_SEEN_IN = ['Vogue India', 'WeddingSutra', 'Brides Today', 'The Wedding Filmer', 'HT Brunch'];

export default function HomepageClient() {
  const [showStickyCTA, setShowStickyCTA] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setShowStickyCTA(window.scrollY > 500);
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(total > 0 ? (window.scrollY / total) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div>
        {/* Scroll progress bar */}
        <div className="fixed top-0 left-0 z-[9999] h-[2px] w-full pointer-events-none">
          <div
            className="h-full"
            style={{
              width: `${scrollProgress}%`,
              background: 'linear-gradient(90deg, #8B1A4A, #C5A46D)',
              transition: 'width 80ms linear',
            }}
          />
        </div>

        <HeroSection />

        {/* Marquee */}
        <div className="bg-[#2A1F1B] py-3.5 overflow-hidden border-b border-[#C5A46D]/15">
          <div className="flex animate-marquee whitespace-nowrap">
            {[0, 1].map((idx) => (
              <span key={idx} className="flex items-center">
                {MARQUEE_ITEMS.map((item) => (
                  <span key={item} className="flex items-center gap-5 mx-6">
                    <span className="text-[#C5A46D] text-[0.65rem] font-semibold tracking-[0.22em] uppercase">{item}</span>
                    <span className="text-[#C5A46D]/25 text-sm">✦</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>

        <TrustStats />
        <JourneySection />
        <WeddingStylesSection />
        <WeddingJournalSection />
        <TestimonialsSection />
        <CitiesSection />
        <ExpertSection />
        <FeaturedVendorsSection />

        {/* As Seen In */}
        <div className="bg-[#FAF5EE] border-y border-[#C5A46D]/8 py-8 overflow-hidden">
          <motion.p
            className="text-center text-[0.58rem] tracking-[0.3em] uppercase text-[#C5A46D]/45 mb-5"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            Featured In
          </motion.p>
          <motion.div
            className="flex items-center gap-8 sm:gap-14 overflow-x-auto scrollbar-hide px-6 sm:justify-center sm:flex-wrap pb-1"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            {AS_SEEN_IN.map((pub) => (
              <p
                key={pub}
                className="font-cormorant text-base sm:text-xl italic text-[#8B5A6A]/28 whitespace-nowrap select-none flex-shrink-0"
              >
                {pub}
              </p>
            ))}
          </motion.div>
        </div>

        <FinalCtaSection />

        {/* Sticky Mobile CTA */}
        {showStickyCTA && (
          <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-white/98 backdrop-blur-md border-t border-gray-100 px-4 py-3 flex items-center gap-3 shadow-2xl">
            <Link
              href="/plan"
              className="flex-1 flex items-center justify-center gap-2 bg-[#8B1A4A] text-white py-3.5 rounded-xl font-semibold text-sm"
              style={{ boxShadow: '0 4px 20px rgba(139,26,74,0.4)' }}
            >
              Begin Your Journey
            </Link>
            <a
              href="tel:+917646028228"
              className="flex items-center justify-center gap-1.5 border border-gray-200 text-gray-600 py-3.5 px-4 rounded-xl font-semibold text-sm hover:border-[#C5A46D]/50 transition-colors"
            >
              <Phone className="w-4 h-4" /> Call
            </a>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
