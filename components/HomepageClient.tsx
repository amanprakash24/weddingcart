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
  show:   { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] as const } },
};

const slideLeft = {
  hidden: { opacity: 0, x: -50 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
};

const slideRight = {
  hidden: { opacity: 0, x: 50 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
};

function stagger(children = 0.1, delay = 0) {
  return { hidden: {}, show: { transition: { staggerChildren: children, delayChildren: delay } } };
}

// ── Journey steps ─────────────────────────────────────────────────────────────

const JOURNEY_STEPS = [
  {
    num: '01',
    title: 'Tell Us Your Wedding Style',
    desc: 'Share your wedding city, guest count, budget, and celebration preferences.',
    img: '/images/journey-01.png',
  },
  {
    num: '02',
    title: 'Explore Curated Wedding Services',
    desc: 'Discover handpicked venues, decor, catering, entertainment, and planning solutions.',
    img: '/images/journey-02.png',
  },
  {
    num: '03',
    title: 'Connect With Our Wedding Experts',
    desc: 'Our team helps you choose the perfect services tailored to your vision.',
    img: '/images/journey-03.png',
  },
  {
    num: '04',
    title: 'Relax — We Handle Everything',
    desc: 'From vendor coordination to event logistics, we manage every detail seamlessly so you can enjoy your celebration stress-free.',
    img: '/images/journey-04.png',
  },
];

// ── Testimonials ──────────────────────────────────────────────────────────────

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

  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

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
    const t = setInterval(() => setActiveTestimonial((s) => (s + 1) % TESTIMONIALS.length), 6000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setActiveStep((s) => (s + 1) % JOURNEY_STEPS.length), 2000);
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

      {/* ── 4. YOUR WEDDING JOURNEY ── */}
      <section className="bg-[#F8F5EF] py-14 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <motion.div
            className="text-center mb-10 sm:mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="eyebrow-luxury mb-2.5">The Journey</p>
            <h2 className="font-[Playfair_Display,serif] font-semibold text-[#1C1208] text-[1.85rem] sm:text-[2.2rem] tracking-tight leading-tight mb-2">
              Your Wedding Journey
            </h2>
            <p className="font-cormorant italic text-[#8A7A6A] text-[1.05rem] max-w-[240px] mx-auto leading-relaxed">
              From first conversation to final celebration — every detail, handled with care.
            </p>
          </motion.div>

          {/* Layout: sticky left image + scrolling right steps */}
          <div className="flex flex-col lg:flex-row lg:gap-10 lg:items-start">

            {/* Left — sticky hexagon image panel, desktop only */}
            <div className="hidden lg:block lg:w-[48%] flex-shrink-0 self-stretch">
              <div className="sticky top-0 h-screen flex items-center justify-center">
                {/* Outer wrapper: drop-shadow follows the hexagon contour */}
                <div
                  className="w-full"
                  style={{
                    filter: 'drop-shadow(0 24px 52px rgba(28,18,8,0.24)) drop-shadow(0 4px 12px rgba(28,18,8,0.1))',
                  }}
                >
                  {/* Hexagon clip */}
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

            {/* Right — scrolling steps */}
            <div className="flex-1">

              {/* Mobile image — rounded rectangle */}
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
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(139,26,74,0.09), rgba(201,169,110,0.13))' }} />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1C1208]/40 to-transparent" />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* Timeline */}
              <div className="relative">

                {/* Gold gradient vertical line */}
                <div className="absolute left-3.5 top-3.5 bottom-3.5 w-px bg-[#C9A96E]/15">
                  <motion.div
                    className="absolute top-0 left-0 w-full"
                    animate={{ height: `${((activeStep + 1) / JOURNEY_STEPS.length) * 100}%` }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    style={{ background: 'linear-gradient(to bottom, #C9A96E, #E8D4A0)' }}
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
                      {/* Numbered circle on the line */}
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

                      {/* Step content */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <motion.h3
                          className="font-[Playfair_Display,serif] font-semibold text-[#1C1208] leading-tight"
                          animate={{ fontSize: isActive ? '2rem' : '0.95rem' }}
                          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        >
                          {step.title}
                        </motion.h3>
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

              {/* CTA */}
              <div className="mt-8 pl-11">
                <Link
                  href="/plan"
                  className="inline-flex items-center gap-2 bg-[#8B1A4A] text-white font-semibold px-7 py-3 rounded-full text-sm transition-all shadow-md hover:shadow-[0_6px_24px_rgba(139,26,74,0.4)] hover:scale-[1.02]"
                >
                  Speak With A Wedding Expert
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

            </div>
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
              {/* Elegant avatar — initial-based, no emoji */}
              <div className="w-52 h-52 rounded-full bg-gradient-to-br from-[#F5E9D0] to-[#EDD9B0] border-[3px] border-[#C9A96E]/30 flex items-center justify-center mb-7 shadow-xl">
                <span className="font-[Playfair_Display,serif] text-7xl font-semibold text-[#8B1A4A]/60 select-none">P</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                {/* Gold availability indicator — no bright green */}
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-[#C9A96E]/40 animate-ping" style={{ animationDuration: '2.5s' }} />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-[#C9A96E]" />
                </span>
                <span className="text-xs text-[#8B6A3E] font-semibold tracking-wide">Available for consultation</span>
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
