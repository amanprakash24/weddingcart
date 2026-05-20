'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles, Phone } from 'lucide-react';
import { Vendor } from '@/types';
import VendorCard from './VendorCard';

// ── Animation variants ────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] as const } },
};

const fadeIn = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.8 } },
};

const slideLeft = {
  hidden: { opacity: 0, x: -50 },
  show:   { opacity: 1, x: 0,  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
};

const slideRight = {
  hidden: { opacity: 0, x: 50 },
  show:   { opacity: 1, x: 0,  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
};

function stagger(children = 0.1, delay = 0) {
  return { hidden: {}, show: { transition: { staggerChildren: children, delayChildren: delay } } };
}

// ── Floating petals ───────────────────────────────────────────────────────────

interface PetalData {
  id: number; left: number; delay: number; duration: number;
  size: number; symbol: string; drift: number;
}

function FloatingPetals() {
  const [petals, setPetals] = useState<PetalData[]>([]);

  useEffect(() => {
    const symbols = ['🌸', '🌺', '🌹', '✿', '❀', '🪷'];
    setPetals(
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 14,
        duration: 14 + Math.random() * 10,
        size: 12 + Math.random() * 14,
        symbol: symbols[Math.floor(Math.random() * symbols.length)],
        drift: (Math.random() - 0.5) * 160,
      }))
    );
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]">
      {petals.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 select-none"
          style={{
            left: `${p.left}%`,
            fontSize: `${p.size}px`,
            animationName: 'petalFall',
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
            animationFillMode: 'both',
            '--drift': `${p.drift}px`,
          } as React.CSSProperties}
        >
          {p.symbol}
        </span>
      ))}
    </div>
  );
}

// ── Testimonial data ──────────────────────────────────────────────────────────

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

// ── Main component ────────────────────────────────────────────────────────────

export default function HomepageClient() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [showStickyCTA, setShowStickyCTA] = useState(false);
  const howItWorksTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/vendors?limit=20');
      const data = await res.json();
      if (data.success) setVendors(data.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    howItWorksTimerRef.current = setInterval(() => setActiveStep((s) => (s + 1) % 4), 3500);
    return () => { if (howItWorksTimerRef.current) clearInterval(howItWorksTimerRef.current); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setActiveTestimonial((s) => (s + 1) % TESTIMONIALS.length), 6000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onScroll = () => setShowStickyCTA(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const topVendors = [...vendors].sort((a, b) => b.rating - a.rating).slice(0, 4);

  return (
    <div>

      {/* ── 1. HERO ── */}
      <section className="relative h-screen min-h-[620px] max-h-[940px] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/images/hero-bg.jpg" alt="Wedding" fill className="object-cover" sizes="100vw" priority />
        </div>
        <div className="absolute inset-0 hero-overlay" />
        <FloatingPetals />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 sm:pt-40">
          <motion.div className="max-w-3xl" initial="hidden" animate="show" variants={stagger(0.2, 0.15)}>

            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white/85 px-5 py-2 rounded-full text-xs font-medium mb-8 tracking-[0.14em] uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C9A96E] animate-pulse" />
              India&apos;s Expert Wedding Coordination Platform
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.05] mb-2 font-[Playfair_Display,serif]">
              From Venue to Vidaai
            </motion.h1>
            <motion.p variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl text-white/80 italic mb-8 font-light font-[Playfair_Display,serif] whitespace-nowrap">
              — We Handle <span className="shimmer-text not-italic font-semibold">Everything</span>
            </motion.p>

            <motion.p variants={fadeUp} className="text-white/70 text-lg mb-10 max-w-xl leading-relaxed">
              Expert consultants. Verified vendors. End-to-end coordination — for your dream Indian wedding.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-start gap-4">
              <Link
                href="/plan"
                className="inline-flex items-center gap-3 bg-[#8B1A4A] text-white px-9 py-5 rounded-2xl font-bold text-lg shadow-2xl hover:opacity-90 hover:scale-[1.02] transition-all"
                style={{ boxShadow: '0 8px 40px rgba(139,26,74,0.5)' }}
              >
                <Sparkles className="w-5 h-5" />
                Start Planning Free
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="tel:+917646028228"
                className="inline-flex items-center gap-2 bg-white/12 backdrop-blur-sm border border-white/25 text-white px-6 py-4 rounded-2xl font-semibold text-base hover:bg-white/20 transition-all"
              >
                <Phone className="w-5 h-5" />
                Talk to an Expert
              </a>
            </motion.div>

          </motion.div>
        </div>
      </section>

      {/* ── 2. MARQUEE ── */}
      <div className="bg-[#1C1208] py-3.5 overflow-hidden border-b border-[#C9A96E]/15">
        <div className="flex animate-marquee whitespace-nowrap">
          {[0, 1].map((idx) => (
            <span key={idx} className="flex items-center">
              {['Venues', 'Photographers', 'Decorators', 'Mehndi Artists', 'Makeup & Bridal', 'Catering', 'DJ & Bands', 'Wedding Planners', 'Jewellery', 'Pandits'].map((item) => (
                <span key={item} className="flex items-center gap-5 mx-6">
                  <span className="text-[#C9A96E] text-[0.65rem] font-semibold tracking-[0.22em] uppercase">{item}</span>
                  <span className="text-[#C9A96E]/25 text-sm">✦</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ── 3. TRUST NUMBERS ── */}
      <div className="bg-[#FFFAF5] border-b border-[#C9A96E]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <motion.div
            className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-0 lg:divide-x lg:divide-[#C9A96E]/12"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger(0.1)}
          >
            {[
              { value: '10,000+', label: 'Couples Served' },
              { value: '500+',   label: 'Verified Vendors' },
              { value: '25+',    label: 'Cities Covered' },
              { value: '5',      label: 'Dedicated Experts' },
            ].map(({ value, label }) => (
              <motion.div key={label} variants={fadeUp} className="text-center lg:px-10">
                <p className="font-cormorant text-5xl sm:text-6xl font-light text-[#8B1A4A] leading-none mb-2">{value}</p>
                <p className="text-gray-400 text-[0.7rem] tracking-[0.2em] uppercase">{label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── 4. HOW IT WORKS ── */}
      <section className="py-28 sm:py-36 bg-[#FEFBEC]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center mb-20">
            <p className="eyebrow-luxury mb-4">Your Journey</p>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-5">How It Works</h2>
            <p className="text-gray-400 text-base max-w-sm mx-auto">Four steps. One expert team. Zero stress.</p>
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-28 w-11/12 mx-auto">

            {/* Circle */}
            <div className="relative h-[260px] w-[260px] sm:h-[380px] sm:w-[380px] lg:h-[500px] lg:w-[500px] flex-shrink-0">
              <div className="h-full w-full rounded-full p-[2px]" style={{ background: 'linear-gradient(to top, #FDF6EA, #D4B896)' }}>
                <div className="h-full w-full rounded-full bg-[#FCF7C8] overflow-hidden flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    {activeStep === 0 && (
                      <motion.div key="s1" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.4 }} className="flex flex-col items-center justify-center h-full w-full px-8 relative">
                        <span className="text-[90px] sm:text-[120px] lg:text-[150px] leading-none select-none">📱</span>
                        <div className="absolute -top-4 right-[10%] bg-white rounded-2xl shadow-lg px-3 py-2 text-xs font-medium text-gray-700 max-w-[140px] sm:max-w-[160px] text-center border border-gray-100 leading-snug">
                          My wedding — Goa, 60 Lakhs
                        </div>
                      </motion.div>
                    )}
                    {activeStep === 1 && (
                      <motion.div key="s2" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.4 }} className="flex items-center justify-center h-full w-full">
                        <div className="bg-white rounded-3xl shadow-lg px-6 py-6 lg:px-10 lg:py-8 text-center border border-amber-100">
                          <div className="text-[#C9A96E] text-xs mb-3 tracking-[0.3em]">✦&nbsp;✦&nbsp;✦</div>
                          <p className="font-[Playfair_Display,serif] text-gray-800 text-xl lg:text-3xl font-bold">Rahul</p>
                          <p className="font-[Playfair_Display,serif] text-gray-400 text-base lg:text-xl">&amp;</p>
                          <p className="font-[Playfair_Display,serif] text-gray-800 text-xl lg:text-3xl font-bold">Kajal</p>
                          <div className="text-[#C9A96E] text-xs mt-3 tracking-[0.3em]">✦&nbsp;✦&nbsp;✦</div>
                        </div>
                      </motion.div>
                    )}
                    {activeStep === 2 && (
                      <motion.div key="s3" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.4 }} className="flex items-center justify-center h-full w-full relative">
                        <span className="text-[100px] sm:text-[130px] lg:text-[170px] leading-none select-none">🛕</span>
                        <div className="absolute top-1/4 right-[18%] w-10 h-10 lg:w-14 lg:h-14 rounded-full bg-rose-500 flex items-center justify-center shadow-xl border-4 border-white">
                          <span className="text-white font-bold text-base lg:text-xl">✓</span>
                        </div>
                      </motion.div>
                    )}
                    {activeStep === 3 && (
                      <motion.div key="s4" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.4 }} className="flex flex-col items-center justify-center h-full w-full gap-5 px-8">
                        <span className="text-[90px] sm:text-[120px] lg:text-[150px] leading-none select-none">🎊</span>
                        <div className="bg-white rounded-2xl shadow-lg px-5 py-3 text-center border border-green-100 text-sm lg:text-base font-semibold text-green-700">
                          Your wedding, perfectly coordinated ✓
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Steps */}
            <div className="flex flex-col lg:-order-1 w-full lg:basis-1/2">
              {[
                { num: 1, title: 'Tell Us About Your Wedding',         desc: 'Date, city, guests, budget — under 2 minutes.' },
                { num: 2, title: 'Get Personalised Recommendations',   desc: 'We curate venues and vendors tailored to you.' },
                { num: 3, title: 'Speak With Your Consultant',         desc: 'A dedicated expert reviews and guides your plan.' },
                { num: 4, title: 'Relax — We Handle Everything',       desc: 'We coordinate vendors and logistics end-to-end.' },
              ].map((step, i) => {
                const isActive = activeStep === i;
                const isLast = i === 3;
                return (
                  <div
                    key={step.num}
                    className={`relative pl-10 lg:pl-14 cursor-pointer ${isLast ? '' : 'pb-10 lg:pb-14'}`}
                    style={!isLast ? {
                      backgroundImage: 'linear-gradient(to bottom, rgba(82,82,82,0.3) 50%, transparent 0%)',
                      backgroundSize: '1px 12px',
                      backgroundPosition: '0 0',
                      backgroundRepeat: 'repeat-y',
                    } : undefined}
                    onClick={() => {
                      setActiveStep(i);
                      if (howItWorksTimerRef.current) clearInterval(howItWorksTimerRef.current);
                      howItWorksTimerRef.current = setInterval(() => setActiveStep((s) => (s + 1) % 4), 3500);
                    }}
                  >
                    <div
                      className={`absolute left-0 top-0 z-10 flex h-7 w-7 lg:h-9 lg:w-9 items-center justify-center rounded-full text-xs lg:text-sm font-bold transition-all duration-300 ${isActive ? 'bg-[#8B1A4A] text-white' : 'bg-gray-200 text-gray-400'}`}
                      style={{ transform: 'translateX(-50%)' }}
                    >
                      {step.num}
                    </div>
                    {isActive && (
                      <motion.div
                        className="absolute left-0 top-0 h-7 w-7 lg:h-9 lg:w-9 rounded-full bg-[#8B1A4A]/25 z-0"
                        style={{ transform: 'translateX(-50%)' }}
                        animate={{ scale: [1, 1.9, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      />
                    )}
                    <p className={`font-[Playfair_Display,serif] leading-tight transition-all duration-300 ${isActive ? 'text-2xl sm:text-3xl lg:text-[42px] lg:leading-[1.1] font-semibold text-gray-900' : 'text-base lg:text-xl font-semibold text-gray-400'}`}>
                      {step.title}
                    </p>
                    <p className={`text-gray-400 text-sm lg:text-base leading-relaxed transition-all duration-300 overflow-hidden ${isActive ? 'max-h-12 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                      {step.desc}
                    </p>
                  </div>
                );
              })}
            </div>

          </div>

          <div className="text-center mt-16 lg:mt-24">
            <Link href="/plan" className="inline-block bg-[#8B1A4A] text-white font-semibold px-10 py-4 rounded-full hover:opacity-90 transition-all text-sm shadow-lg hover:shadow-xl">
              Begin Your Wedding Journey
            </Link>
          </div>
        </div>
      </section>

      {/* ── 5. WEDDING JOURNAL ── */}
      <section className="py-28 sm:py-36 bg-[#1C1208]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center mb-20">
            <p className="eyebrow-luxury text-[#C9A96E]/70 mb-4">Wedding Journal</p>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white font-[Playfair_Display,serif]">
              Weddings We&apos;ve <span className="text-[#C9A96E]">Brought to Life</span>
            </h2>
          </div>

          <div className="divide-y divide-[#C9A96E]/10">
            {[
              {
                num: '001',
                title: 'The Jaipur Palace Ceremony',
                city: 'Jaipur, Rajasthan',
                desc: 'A 600-guest royal celebration. Three palace venues, eight cuisine catering, décor, and entertainment — all coordinated by our team.',
                tags: ['Venue', 'Catering', 'Décor', 'Entertainment'],
              },
              {
                num: '002',
                title: 'The Goa Beachside Wedding',
                city: 'North Goa',
                desc: 'An intimate 120-guest destination wedding on a private beach. Accommodation, custom florals, live music, and seamless logistics.',
                tags: ['Destination', 'Floral', 'Accommodation', 'Music'],
              },
              {
                num: '003',
                title: 'The Delhi Grand Reception',
                city: 'New Delhi',
                desc: '1,200 guests. Five-star hotel. Catering, photography, décor, mehndi, bridal makeup — fully coordinated, zero stress.',
                tags: ['Full Coordination', 'Photography', 'Makeup', 'Catering'],
              },
            ].map((w, i) => (
              <motion.div
                key={w.num}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.12 }}
                className="grid grid-cols-12 gap-4 lg:gap-10 items-start py-12 lg:py-16 group"
              >
                <div className="col-span-2 lg:col-span-1">
                  <span className="font-cormorant text-3xl lg:text-5xl font-light text-[#C9A96E]/18 group-hover:text-[#C9A96E]/45 transition-colors duration-400 leading-none block">{w.num}</span>
                </div>
                <div className="col-span-10 lg:col-span-4">
                  <p className="text-[#C9A96E]/45 text-[0.62rem] tracking-[0.24em] uppercase mb-2">{w.city}</p>
                  <h3 className="font-[Playfair_Display,serif] text-white text-xl lg:text-2xl font-semibold leading-snug">{w.title}</h3>
                </div>
                <div className="col-span-12 lg:col-span-5">
                  <p className="text-gray-500 text-sm leading-relaxed">{w.desc}</p>
                </div>
                <div className="col-span-12 lg:col-span-2 flex flex-wrap lg:flex-col gap-2">
                  {w.tags.map((tag) => (
                    <span key={tag} className="text-[10px] text-[#C9A96E]/55 border border-[#C9A96E]/12 px-2.5 py-1 rounded-full tracking-wide whitespace-nowrap">{tag}</span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-10 pt-10 border-t border-[#C9A96E]/8">
            <p className="text-gray-600 text-sm">Real photography coming soon — we&apos;re documenting every coordinated wedding.</p>
          </div>
        </div>
      </section>

      {/* ── 6. TESTIMONIAL ── */}
      <section className="py-28 sm:py-36 bg-[#FAF5EE] overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

          <p className="eyebrow-luxury text-[#C9A96E] mb-6">What Couples Say</p>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTestimonial}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="font-cormorant text-[7rem] sm:text-[9rem] leading-none text-[#C9A96E]/15 select-none mb-[-2.5rem]">&ldquo;</div>
              <p className="font-cormorant text-2xl sm:text-3xl lg:text-4xl italic font-light text-gray-800 leading-[1.55] mb-10">
                {TESTIMONIALS[activeTestimonial].quote}
              </p>
              <div className="flex items-center justify-center gap-5">
                <div className="w-16 h-px bg-[#C9A96E]/30" />
                <div>
                  <p className="font-[Playfair_Display,serif] font-semibold text-gray-900">{TESTIMONIALS[activeTestimonial].name}</p>
                  <p className="text-[#C9A96E] text-xs tracking-[0.2em] uppercase mt-1">
                    {TESTIMONIALS[activeTestimonial].city} · {TESTIMONIALS[activeTestimonial].year}
                  </p>
                </div>
                <div className="w-16 h-px bg-[#C9A96E]/30" />
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-center gap-2.5 mt-10">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveTestimonial(i)}
                className={`rounded-full transition-all duration-300 ${i === activeTestimonial ? 'w-6 h-1.5 bg-[#C9A96E]' : 'w-1.5 h-1.5 bg-[#C9A96E]/25 hover:bg-[#C9A96E]/50'}`}
                aria-label={`Testimonial ${i + 1}`}
              />
            ))}
          </div>

        </div>
      </section>

      {/* ── 7. MEET YOUR EXPERT ── */}
      <section className="py-28 sm:py-36 bg-[#FFFAF5]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid lg:grid-cols-2 gap-16 lg:gap-28 items-center"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger(0.18)}
          >
            <motion.div variants={slideLeft} className="flex flex-col items-center lg:items-start">
              <div className="w-52 h-52 rounded-full bg-gradient-to-br from-rose-100 to-amber-50 border-[3px] border-[#C9A96E]/20 flex items-center justify-center text-8xl mb-7 shadow-xl">
                👩‍💼
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-600 font-semibold tracking-wide">Available for consultation</span>
              </div>
              <p className="text-gray-400 text-xs">Mon – Sat · 10am to 7pm IST</p>
            </motion.div>

            <motion.div variants={slideRight}>
              <p className="eyebrow-luxury mb-5">Human First</p>
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-4 leading-tight">
                Meet Priya.<br />Your Wedding Expert.
              </h2>
              <div className="w-12 h-px bg-[#C9A96E]/35 mb-6" />
              <p className="font-cormorant text-xl italic text-gray-500 mb-6 leading-relaxed">
                &ldquo;I treat every wedding as if it were my own sister&apos;s. Every call, every vendor visit — I&apos;m there with you.&rdquo;
              </p>
              <div className="space-y-2 text-sm text-gray-400 mb-9">
                <p><span className="text-[#C9A96E] font-semibold">Role ·</span> Senior Wedding Consultant</p>
                <p><span className="text-[#C9A96E] font-semibold">Weddings ·</span> 120+ coordinated</p>
                <p><span className="text-[#C9A96E] font-semibold">Speciality ·</span> Luxury & Destination</p>
                <p><span className="text-[#C9A96E] font-semibold">Cities ·</span> Patna · Delhi · Jaipur</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/plan" className="inline-flex items-center justify-center gap-2 bg-[#8B1A4A] text-white px-7 py-3.5 rounded-full font-semibold hover:opacity-90 transition-all shadow-lg text-sm">
                  <Sparkles className="w-4 h-4" /> Speak With Priya
                </Link>
                <a href="tel:+917646028228" className="inline-flex items-center justify-center gap-2 border border-gray-200 text-gray-500 px-7 py-3.5 rounded-full font-medium hover:border-[#8B1A4A] hover:text-[#8B1A4A] transition-all text-sm">
                  <Phone className="w-4 h-4" /> Call Now
                </a>
              </div>
              <p className="text-gray-300 text-xs mt-6">
                Priya is one of 5 dedicated consultants — each specializing in different wedding styles and regions across India.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── 8. CURATED VENDORS ── */}
      {!loading && topVendors.length > 0 && (
        <section className="py-28 sm:py-36 bg-[#FEFBF6]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              className="text-center mb-16"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              variants={stagger(0.15)}
            >
              <motion.p variants={fadeUp} className="eyebrow-luxury mb-4">Handpicked For You</motion.p>
              <motion.h2 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 font-[Playfair_Display,serif]">
                Selected By Our <span className="gradient-text-maroon">Wedding Experts</span>
              </motion.h2>
              <motion.p variants={fadeUp} className="text-gray-400 text-sm mt-5 max-w-sm mx-auto">
                We don&apos;t list every vendor. We curate only those who consistently deliver excellence.
              </motion.p>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-40px' }}
              variants={stagger(0.1)}
            >
              {topVendors.map((vendor) => (
                <motion.div key={vendor.id} variants={fadeUp}>
                  <VendorCard vendor={vendor} />
                </motion.div>
              ))}
            </motion.div>

            <div className="text-center mt-12">
              <Link href="/categories/venue" className="inline-flex items-center gap-2 border border-[#C9A96E]/35 text-[#8B1A4A] font-semibold px-8 py-3.5 rounded-full hover:bg-[#8B1A4A] hover:text-white hover:border-[#8B1A4A] transition-all text-sm">
                Explore All Curated Vendors
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── 9. FINAL CTA ── */}
      <section className="relative py-28 sm:py-36 overflow-hidden">
        <div className="absolute inset-0">
          <Image src="https://images.unsplash.com/photo-1478146059778-26028b07395a?w=1920&q=80" alt="Wedding" fill sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950/92 to-gray-900/72" />
        </div>

        <motion.div
          className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger(0.16)}
        >
          <motion.p variants={fadeUp} className="eyebrow-luxury text-[#C9A96E] mb-5">Begin Your Journey</motion.p>
          <motion.h2 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-5 font-[Playfair_Display,serif] leading-tight">
            Your Dream Wedding<br /><span className="shimmer-text">Starts Here</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/60 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
            Join thousands of couples who trusted ShaadiShopping with their most important day.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/plan" className="bg-[#8B1A4A] text-white font-bold px-10 py-4 rounded-full hover:opacity-90 transition-all hover:shadow-2xl">
              Build My Wedding Plan
            </Link>
            <a href="tel:+917070486987" className="flex items-center justify-center gap-2 bg-white/12 backdrop-blur-sm border border-white/25 text-white font-semibold px-8 py-4 rounded-full hover:bg-white/22 transition-all">
              <Phone className="w-4 h-4" />
              Talk to an Expert
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* ── STICKY MOBILE CTA ── */}
      {showStickyCTA && (
        <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-white border-t border-gray-100 px-4 py-3 flex items-center gap-3 shadow-2xl">
          <Link
            href="/plan"
            className="flex-1 flex items-center justify-center gap-2 bg-[#8B1A4A] text-white py-3.5 rounded-xl font-bold text-sm"
            style={{ boxShadow: '0 4px 20px rgba(139,26,74,0.4)' }}
          >
            <Sparkles className="w-4 h-4" /> Start Planning — Free
          </Link>
          <a href="tel:+917646028228" className="flex items-center justify-center gap-1.5 border border-gray-200 text-gray-600 py-3.5 px-4 rounded-xl font-semibold text-sm">
            <Phone className="w-4 h-4" /> Call
          </a>
        </div>
      )}

    </div>
  );
}
