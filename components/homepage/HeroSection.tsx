'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Phone } from 'lucide-react';

export default function HeroSection() {
  return (
    <section className="relative h-screen min-h-[640px] flex items-center overflow-hidden">
      <div className="absolute inset-0">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          poster="/images/hero-bg.jpg"
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/videos/homepage.mp4" type="video/mp4" />
        </video>
      </div>
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(160deg, rgba(42,31,27,0.78) 0%, rgba(0,0,0,0.12) 55%, rgba(42,31,27,0.85) 100%)' }}
      />
      <div
        className="absolute inset-0 pointer-events-none animate-hero-glow"
        style={{ background: 'radial-gradient(circle at 40% 45%, rgba(179,142,75,0.15), transparent 60%)' }}
      />
      <div
        className="absolute bottom-0 left-1/4 w-1/2 h-[40%] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center bottom, rgba(197,164,109,0.13) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-36 lg:pt-40">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 bg-white/8 backdrop-blur-sm border border-white/15 text-white/80 px-4 py-2 rounded-full text-[0.68rem] sm:text-xs font-medium mb-6 sm:mb-8 tracking-[0.1em] sm:tracking-[0.14em] uppercase"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#C5A46D] flex-shrink-0" />
            India&apos;s Expert Wedding Platform
          </motion.div>

          <h1
            className="text-[2rem] sm:text-4xl md:text-5xl lg:text-[3.75rem] font-semibold text-white leading-[1.14] mb-5 sm:mb-6"
            style={{ fontFamily: 'var(--font-playfair, serif)' }}
          >
            <span className="block">
              <motion.span
                className="inline-block"
                initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 1.2, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                From Venue&nbsp;
              </motion.span>
              <motion.span
                className="inline-block"
                initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 1.2, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                to&nbsp;
              </motion.span>
              <motion.span
                className="inline-block relative"
                initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 1.2, delay: 1.0, ease: [0.22, 1, 0.36, 1] }}
              >
                Vidaai
                <span className="vidaai-shimmer-overlay" aria-hidden="true">Vidaai</span>
              </motion.span>
            </span>
            <span className="hidden sm:block">
              <motion.span
                className="inline-block"
                initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 1.4, delay: 1.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="text-white/50">— </span>
                <span className="hero-highlight-cycle-wrap">
                  <span className="hero-highlight-cycle">We Handle Everything</span>
                </span>
              </motion.span>
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0, delay: 1.85, ease: [0.22, 1, 0.36, 1] }}
            className="text-white/65 text-sm sm:text-lg mb-8 sm:mb-10 max-w-md sm:max-w-xl leading-relaxed"
          >
            Expert consultants. Verified vendors. End-to-end coordination — for your dream Indian wedding.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0, delay: 2.15, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3 sm:gap-4"
          >
            <Link
              href="/plan"
              className="inline-flex items-center justify-center gap-2 bg-[#8B1A4A] text-white px-7 sm:px-9 py-3.5 sm:py-4 rounded-full font-semibold text-sm shadow-xl hover:opacity-90 transition-all"
              style={{ boxShadow: '0 8px 40px rgba(139,26,74,0.45)' }}
            >
              Begin Your Journey <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="tel:+917646028228"
              className="inline-flex items-center justify-center gap-2 bg-white/8 backdrop-blur-sm border border-white/20 text-white/90 px-6 sm:px-7 py-3.5 sm:py-4 rounded-full font-medium text-sm hover:bg-white/14 transition-all"
            >
              <Phone className="w-4 h-4" /> Speak With An Expert
            </a>
          </motion.div>
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 opacity-35 pointer-events-none">
        <div className="w-px h-10 bg-gradient-to-b from-transparent via-white to-transparent animate-pulse" />
      </div>
    </section>
  );
}
