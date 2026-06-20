'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Phone } from 'lucide-react';
import { fadeUp, stagger } from './animations';

export default function FinalCtaSection() {
  return (
    <section className="relative py-20 sm:py-28 lg:py-40 overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="https://images.unsplash.com/photo-1478146059778-26028b07395a?w=1920&q=80"
          alt="Wedding"
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, rgba(42,31,27,0.94) 0%, rgba(20,10,8,0.72) 100%)' }}
        />
        <div
          className="absolute bottom-0 right-0 w-1/2 h-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at bottom right, rgba(197,164,109,0.10) 0%, transparent 60%)' }}
        />
      </div>

      <motion.div
        className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        variants={stagger(0.16)}
      >
        <motion.p variants={fadeUp} className="eyebrow-luxury text-[#C5A46D] mb-5">Begin Your Journey</motion.p>
        <motion.h2
          variants={fadeUp}
          className="text-3xl sm:text-4xl lg:text-6xl font-semibold text-white mb-5 sm:mb-6 leading-tight"
          style={{ fontFamily: 'var(--font-playfair, serif)' }}
        >
          Let&apos;s Create Your<br />Once-in-a-Lifetime<br />Celebration
        </motion.h2>
        <motion.p variants={fadeUp} className="text-white/55 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
          Speak with our wedding experts and start planning beautifully.
        </motion.p>
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <Link
            href="/plan"
            className="flex items-center justify-center bg-[#8B1A4A] text-white font-semibold px-8 sm:px-10 py-4 rounded-full hover:opacity-90 transition-all hover:shadow-2xl text-sm tracking-wide"
          >
            Book A Free Consultation
          </Link>
          <a
            href="tel:+917646028228"
            className="flex items-center justify-center gap-2 bg-white/8 backdrop-blur-sm border border-white/20 text-white font-medium px-7 sm:px-8 py-4 rounded-full hover:bg-white/14 transition-all text-sm"
          >
            <Phone className="w-4 h-4" /> Speak With An Expert
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
