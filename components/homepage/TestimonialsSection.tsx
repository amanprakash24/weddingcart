'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const TESTIMONIALS = [
  {
    quote: 'ShaadiShopping made our wedding so effortless. Our consultant guided every step — venue, photographer, catering — without a single moment of stress.',
    name: 'Priya & Rahul',
    city: 'Delhi',
    year: '2024',
  },
  {
    quote: 'We had no idea where to start. ShaadiShopping handed us a dedicated expert who turned our vision into reality within our budget. An absolute dream.',
    name: 'Ananya & Vikram',
    city: 'Mumbai',
    year: '2024',
  },
  {
    quote: 'From mehndi to the final vidaai, every vendor was perfect. The coordination was seamless. I cannot imagine doing it any other way.',
    name: 'Sneha & Arjun',
    city: 'Jaipur',
    year: '2024',
  },
];

export default function TestimonialsSection() {
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setActiveTestimonial((s) => (s + 1) % TESTIMONIALS.length),
      10000,
    );
    return () => clearInterval(t);
  }, []);

  return (
    <section className="py-10 sm:py-14 lg:py-16 bg-[#FAF5EE] overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-[#C5A46D] text-[11px] font-bold uppercase tracking-[0.28em] mb-3">Kind Words</p>
        <h2
          className="font-bold text-3xl sm:text-4xl lg:text-5xl text-[#1C0A12] mb-8"
          style={{ fontFamily: 'Playfair Display, serif', letterSpacing: '-0.01em' }}
        >
          What Couples Say
        </h2>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTestimonial}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="font-cormorant text-[7rem] sm:text-[9rem] leading-none text-[#C5A46D]/15 select-none mb-[-2.5rem]">
              &ldquo;
            </div>
            <p className="font-cormorant text-2xl sm:text-3xl lg:text-4xl italic font-light text-gray-800 leading-[1.55] mb-10">
              {TESTIMONIALS[activeTestimonial].quote}
            </p>
            <div className="flex items-center justify-center gap-5">
              <div className="w-16 h-px bg-[#C5A46D]/30" />
              <div>
                <p className="font-semibold text-gray-900" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
                  {TESTIMONIALS[activeTestimonial].name}
                </p>
                <p className="text-[#C5A46D] text-xs tracking-[0.2em] uppercase mt-1">
                  {TESTIMONIALS[activeTestimonial].city} · {TESTIMONIALS[activeTestimonial].year}
                </p>
              </div>
              <div className="w-16 h-px bg-[#C5A46D]/30" />
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-center items-center gap-4 mt-10">
          <button
            onClick={() =>
              setActiveTestimonial((s) => (s - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)
            }
            className="w-9 h-9 rounded-full border border-[#C5A46D]/30 flex items-center justify-center hover:bg-[#C5A46D]/10 active:scale-95 transition-all"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="w-4 h-4 text-[#C5A46D]" />
          </button>
          <div className="flex gap-2.5">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveTestimonial(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === activeTestimonial
                    ? 'w-6 h-1.5 bg-[#C5A46D]'
                    : 'w-1.5 h-1.5 bg-[#C5A46D]/25 hover:bg-[#C5A46D]/50'
                }`}
                aria-label={`Testimonial ${i + 1}`}
              />
            ))}
          </div>
          <button
            onClick={() => setActiveTestimonial((s) => (s + 1) % TESTIMONIALS.length)}
            className="w-9 h-9 rounded-full border border-[#C5A46D]/30 flex items-center justify-center hover:bg-[#C5A46D]/10 active:scale-95 transition-all"
            aria-label="Next testimonial"
          >
            <ChevronRight className="w-4 h-4 text-[#C5A46D]" />
          </button>
        </div>
      </div>
    </section>
  );
}
