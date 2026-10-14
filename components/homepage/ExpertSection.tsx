'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Phone } from 'lucide-react';
import { slideLeft, slideRight, stagger } from './animations';

// 14 Oct 2026 claim audit: this section used to introduce "Priya", a named consultant with "120+ weddings coordinated" across
// "Patna · Delhi · Jaipur" and "one of 5 consultants" — none of it had a source. It now describes the service without a persona.
// When a real team member is to be shown, put their real name and photo here.
export default function ExpertSection() {
  return (
    <section className="py-16 sm:py-24 lg:py-32 bg-[#FFFCF7] overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="grid lg:grid-cols-2 gap-8 lg:gap-28 items-center"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger(0.18)}
        >
          <motion.div variants={slideLeft} className="flex flex-col items-center lg:items-start">
            <div className="w-36 h-36 sm:w-52 sm:h-52 rounded-full bg-gradient-to-br from-[#F5E9D0] to-[#EDD9B0] border-[3px] border-[#C5A46D]/30 flex items-center justify-center mb-5 sm:mb-7 shadow-xl">
              <span
                className="font-semibold text-5xl sm:text-7xl text-[#8B1A4A]/60 select-none"
                style={{ fontFamily: 'var(--font-playfair, serif)' }}
              >
                1
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex w-2 h-2">
                <span
                  className="absolute inline-flex w-full h-full rounded-full bg-[#C5A46D]/40 animate-ping"
                  style={{ animationDuration: '2.5s' }}
                />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-[#C5A46D]" />
              </span>
              <span className="text-xs text-[#8B6A3E] font-semibold tracking-wide">Available for consultation</span>
            </div>
            <p className="text-gray-400 text-xs">Mon – Sat · 10am to 7pm IST</p>
          </motion.div>

          <motion.div variants={slideRight}>
            <p className="eyebrow-luxury mb-5">Human First</p>
            <h2
              className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-gray-900 mb-4 leading-tight"
              style={{ fontFamily: 'var(--font-playfair, serif)' }}
            >
              One Person.<br />Your Wedding Expert.
            </h2>
            <div className="w-12 h-px bg-[#C5A46D]/35 mb-6" />
            <p className="font-cormorant text-xl italic text-gray-500 mb-6 leading-relaxed">
              One person plans your wedding with you — every call, every vendor visit — from the first conversation to Vidai.
            </p>
            <div className="space-y-2 text-sm text-gray-400 mb-9">
              <p><span className="text-[#C5A46D] font-semibold">Based in ·</span> Patna</p>
              <p><span className="text-[#C5A46D] font-semibold">Helps with ·</span> Venue, vendors, budget and the wedding day</p>
              <p><span className="text-[#C5A46D] font-semibold">First consultation ·</span> Free</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/plan"
                className="inline-flex items-center justify-center gap-2 bg-[#8B1A4A] text-white px-7 py-3.5 rounded-full font-semibold hover:opacity-90 transition-all shadow-lg text-sm"
              >
                Speak With an Expert
              </Link>
              <a
                href="tel:+917646028228"
                className="inline-flex items-center justify-center gap-2 border border-gray-200 text-gray-500 px-7 py-3.5 rounded-full font-medium hover:border-[#8B1A4A] hover:text-[#8B1A4A] transition-all text-sm"
              >
                <Phone className="w-4 h-4" /> Call Now
              </a>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
