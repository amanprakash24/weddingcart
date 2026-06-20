'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const JOURNEY_STEPS = [
  {
    num: '01',
    title: 'Share Your Vision',
    desc: 'Tell us your wedding city, guest count, budget, and celebration preferences.',
    img: '/images/journey-01.png',
  },
  {
    num: '02',
    title: 'Receive Curated Recommendations',
    desc: 'Handpicked venues, decor, catering, and entertainment tailored to your style.',
    img: '/images/journey-02.png',
  },
  {
    num: '03',
    title: 'Consult With Our Wedding Experts',
    desc: 'A dedicated ShaadiShopping expert personally guides your wedding journey.',
    img: '/images/journey-03.png',
  },
  {
    num: '04',
    title: 'Relax — We Handle Everything',
    desc: 'From vendor coordination to final execution, we manage every detail seamlessly.',
    img: '/images/journey-04.png',
  },
];

export default function JourneySection() {
  const [activeStep, setActiveStep] = useState(0);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const t = setInterval(() => setActiveStep((s) => (s + 1) % JOURNEY_STEPS.length), 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <section id="how-it-works" className="bg-[#F8F5EF] py-14 sm:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-10 sm:mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="eyebrow-luxury mb-2.5">The Journey</p>
          <h2
            className="font-semibold text-[#2A1F1B] text-[1.85rem] sm:text-[2.2rem] tracking-tight leading-tight mb-2"
            style={{ fontFamily: 'var(--font-playfair, serif)' }}
          >
            Your Wedding Journey
          </h2>
          <p className="font-cormorant italic text-[#8A7A6A] text-[1.05rem] max-w-[240px] mx-auto leading-relaxed">
            Simple. Personal. Stress-free.
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row lg:gap-10 lg:items-start">
          {/* Desktop sticky image */}
          <div className="hidden lg:block lg:w-[48%] flex-shrink-0 self-stretch">
            <div className="sticky top-0 h-screen flex items-center justify-center" style={{ paddingBottom: '15%' }}>
              <div
                style={{ filter: 'drop-shadow(0 24px 52px rgba(28,18,8,0.24)) drop-shadow(0 4px 12px rgba(28,18,8,0.1))' }}
                className="w-full"
              >
                <div
                  className="relative w-full"
                  style={{
                    aspectRatio: '1 / 1',
                    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                    backgroundColor: '#F8F5EF',
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeStep}
                      className="absolute inset-0 flex items-center justify-center"
                      initial={{ opacity: 0, filter: 'blur(10px)' }}
                      animate={{ opacity: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, transition: { duration: 0.25 } }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <Image
                        src={JOURNEY_STEPS[activeStep].img}
                        alt={JOURNEY_STEPS[activeStep].title}
                        fill
                        sizes="42vw"
                        className="object-contain"
                        style={{ transform: 'scale(1.22)' }}
                        priority
                      />
                      <div
                        className="absolute inset-0"
                        style={{ background: 'linear-gradient(135deg, rgba(139,26,74,0.06) 0%, rgba(201,169,110,0.10) 100%)' }}
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1">
            {/* Mobile image */}
            <div className="lg:hidden mb-6">
              <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '3/2' }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep}
                    className="absolute inset-0"
                    initial={{ opacity: 0, scale: 1.04 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.22 } }}
                    transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Image src={JOURNEY_STEPS[activeStep].img} alt="" fill className="object-cover" sizes="100vw" />
                    <div
                      className="absolute inset-0"
                      style={{ background: 'linear-gradient(135deg, rgba(139,26,74,0.09), rgba(201,169,110,0.13))' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#2A1F1B]/40 to-transparent" />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Steps */}
            <div className="relative">
              <div className="absolute left-3.5 top-3.5 bottom-3.5 w-px bg-[#C5A46D]/15">
                <motion.div
                  className="absolute top-0 left-0 w-full"
                  animate={{ height: `${((activeStep + 1) / JOURNEY_STEPS.length) * 100}%` }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  style={{ background: 'linear-gradient(to bottom, #C5A46D, #E8D4A0)' }}
                />
              </div>

              {JOURNEY_STEPS.map((step, i) => {
                const isActive = activeStep === i;
                return (
                  <motion.div
                    key={step.num}
                    ref={(el) => { stepRefs.current[i] = el; }}
                    onClick={() => setActiveStep(i)}
                    className="relative flex items-start gap-4 pb-10 last:pb-0 cursor-pointer"
                    animate={{ opacity: isActive ? 1 : 0.38 }}
                    transition={{ duration: 0.45 }}
                  >
                    <div className="relative flex-shrink-0 z-10 w-7 h-7 flex items-center justify-center">
                      {isActive && (
                        <motion.div
                          className="absolute -inset-2 rounded-full"
                          style={{ backgroundColor: 'rgba(139,26,74,0.18)' }}
                          initial={{ scale: 1, opacity: 0.8 }}
                          animate={{ scale: 1.9, opacity: 0 }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut', repeatDelay: 0.3 }}
                        />
                      )}
                      <motion.div
                        className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[0.7rem] relative z-10"
                        animate={{
                          backgroundColor: isActive ? '#8B1A4A' : '#E5DDD5',
                          color: isActive ? '#FFFFFF' : '#9A8A7A',
                        }}
                        transition={{ duration: 0.35 }}
                      >
                        {i + 1}
                      </motion.div>
                    </div>

                    <div className="flex-1 min-w-0 pt-0.5">
                      <h3
                        style={{
                          fontFamily: 'var(--font-playfair, serif)',
                          fontSize: isActive ? '1.6rem' : '0.95rem',
                          color: isActive ? '#8B1A4A' : '#2A1F1B',
                          transition: 'font-size 0.5s cubic-bezier(0.16,1,0.3,1), color 0.4s ease',
                          fontWeight: 600,
                          lineHeight: 1.25,
                        }}
                      >
                        {step.title}
                      </h3>
                      <AnimatePresence>
                        {isActive && (
                          <motion.p
                            className="text-neutral-500 text-sm leading-relaxed mt-2"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.35, ease: 'easeOut' }}
                          >
                            {step.desc}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-8 pl-11">
              <Link
                href="/plan"
                className="inline-flex items-center gap-2 bg-[#8B1A4A] text-white font-semibold px-7 py-3 rounded-full text-sm transition-all shadow-md hover:shadow-[0_6px_24px_rgba(139,26,74,0.4)] hover:scale-[1.02]"
              >
                Speak With A Wedding Expert <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
