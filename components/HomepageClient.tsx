'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Phone } from 'lucide-react';
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

// ── Signature wedding styles ──────────────────────────────────────────────────

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

// ── Featured weddings — large images for cinematic sticky panel ───────────────

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

  // Calmer pacing
  useEffect(() => {
    const t = setInterval(() => setActiveTestimonial((s) => (s + 1) % TESTIMONIALS.length), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setActiveStep((s) => (s + 1) % JOURNEY_STEPS.length), 6000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onScroll = () => setShowStickyCTA(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);


  const topVendors = [...vendors].sort((a, b) => b.rating - a.rating).slice(0, 3);

  return (
    <div>

      {/* ── 1. HERO ── */}
      <section className="relative h-screen min-h-[640px] max-h-[940px] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="/videos/homepage.mp4" type="video/mp4" />
          </video>
        </div>
        {/* Cinematic warm overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(160deg, rgba(42,31,27,0.78) 0%, rgba(0,0,0,0.12) 55%, rgba(42,31,27,0.85) 100%)' }}
        />
        {/* Floating atmospheric gold glow — slow 20s parallax */}
        <div
          className="absolute inset-0 pointer-events-none animate-hero-glow"
          style={{ background: 'radial-gradient(circle at 40% 45%, rgba(179,142,75,0.15), transparent 60%)' }}
        />
        {/* Static gold bloom at bottom */}
        <div
          className="absolute bottom-0 left-1/4 w-1/2 h-[40%] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center bottom, rgba(197,164,109,0.13) 0%, transparent 70%)' }}
        />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-36 lg:pt-40" >
          <div className="max-w-3xl">

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 bg-white/8 backdrop-blur-sm border border-white/15 text-white/80 px-4 py-2 rounded-full text-[0.68rem] sm:text-xs font-medium mb-6 sm:mb-8 tracking-[0.1em] sm:tracking-[0.14em] uppercase"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#C5A46D] flex-shrink-0" />
              India&apos;s Expert Wedding Platform
            </motion.div>

            {/* ── Cinematic headline — phrase-by-phrase blur reveal ── */}
            <h1
              className="text-[2rem] sm:text-4xl md:text-5xl lg:text-[3.75rem] font-semibold text-white leading-[1.14] mb-5 sm:mb-6"
              style={{ fontFamily: 'var(--font-playfair, serif)' }}
            >
              {/* Line 1: three phrases, each with its own emotional pause */}
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
                {/* "Vidaai" — soft gold shimmer sweeps through once, 0.8s after it fully appears */}
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
              {/* Line 2: slow, weighted reveal — words cycle colours every 2s */}
              <span className="block">
                <motion.span
                  className="inline-block"
                  initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 1.4, delay: 1.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <span className="text-white/50">— </span>
                  <span className="hero-highlight-cycle">We Handle Everything</span>
                </motion.span>
              </span>
            </h1>

            {/* Subtext */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.0, delay: 1.85, ease: [0.22, 1, 0.36, 1] }}
              className="text-white/65 text-sm sm:text-lg mb-8 sm:mb-10 max-w-md sm:max-w-xl leading-relaxed"
            >
              Expert consultants. Verified vendors. End-to-end coordination — for your dream Indian wedding.
            </motion.p>

            {/* CTAs */}
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
                Start Planning <ArrowRight className="w-4 h-4" />
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

      {/* ── 2. MARQUEE ── */}
      <div className="bg-[#2A1F1B] py-3.5 overflow-hidden border-b border-[#C5A46D]/15">
        <div className="flex animate-marquee whitespace-nowrap">
          {[0, 1].map((idx) => (
            <span key={idx} className="flex items-center">
              {['Venues', 'Photographers', 'Decorators', 'Mehndi Artists', 'Makeup & Bridal', 'Catering', 'DJ & Bands', 'Wedding Planners', 'Jewellery', 'Pandits'].map((item) => (
                <span key={item} className="flex items-center gap-5 mx-6">
                  <span className="text-[#C5A46D] text-[0.65rem] font-semibold tracking-[0.22em] uppercase">{item}</span>
                  <span className="text-[#C5A46D]/25 text-sm">✦</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ── 3. TRUST NUMBERS ── */}
      <div className="bg-[#FFFCF7] border-b border-[#C5A46D]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <motion.div
            className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-0 lg:divide-x lg:divide-[#C5A46D]/12"
            initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger(0.1)}
          >
            {[
              { value: '10,000+', label: 'Couples Served' },
              { value: '500+',   label: 'Verified Vendors' },
              { value: '25+',    label: 'Cities Covered' },
              { value: '5',      label: 'Dedicated Experts' },
            ].map(({ value, label }) => (
              <motion.div key={label} variants={fadeUp} className="text-center lg:px-10">
                <p className="font-cormorant text-4xl sm:text-5xl lg:text-6xl font-light text-[#8B1A4A] leading-none mb-2">{value}</p>
                <p className="text-gray-400 text-[0.58rem] sm:text-[0.7rem] tracking-[0.1em] sm:tracking-[0.2em] uppercase">{label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── 4. YOUR WEDDING JOURNEY ── */}
      <section id="how-it-works" className="bg-[#F8F5EF] py-14 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-10 sm:mb-14"
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
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
            <div className="hidden lg:block lg:w-[48%] flex-shrink-0 self-stretch">
              <div className="sticky top-0 h-screen flex items-center justify-center" style={{ paddingBottom: '15%' }}>
                <div style={{ filter: 'drop-shadow(0 24px 52px rgba(28,18,8,0.24)) drop-shadow(0 4px 12px rgba(28,18,8,0.1))' }} className="w-full">
                  <div
                    className="relative w-full"
                    style={{ aspectRatio: '1 / 1', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', backgroundColor: '#F8F5EF' }}
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
                        <Image src={JOURNEY_STEPS[activeStep].img} alt={JOURNEY_STEPS[activeStep].title} fill sizes="42vw" className="object-contain" style={{ transform: 'scale(1.22)' }} priority />
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(139,26,74,0.06) 0%, rgba(201,169,110,0.10) 100%)' }} />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1">
              <div className="lg:hidden mb-6">
                <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '3/2' }}>
                  <AnimatePresence mode="wait">
                    <motion.div key={activeStep} className="absolute inset-0" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.22 } }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}>
                      <Image src={JOURNEY_STEPS[activeStep].img} alt="" fill className="object-cover" sizes="100vw" />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(139,26,74,0.09), rgba(201,169,110,0.13))' }} />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#2A1F1B]/40 to-transparent" />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

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
                          animate={{ backgroundColor: isActive ? '#8B1A4A' : '#E5DDD5', color: isActive ? '#FFFFFF' : '#9A8A7A' }}
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
                <Link href="/plan" className="inline-flex items-center gap-2 bg-[#8B1A4A] text-white font-semibold px-7 py-3 rounded-full text-sm transition-all shadow-md hover:shadow-[0_6px_24px_rgba(139,26,74,0.4)] hover:scale-[1.02]">
                  Speak With A Wedding Expert <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. SIGNATURE WEDDING STYLES ── */}
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
              <h2 className="font-semibold text-[#2A1F1B] text-2xl sm:text-4xl leading-tight" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
                Every Wedding Style,<br />Beautifully Served
              </h2>
            </motion.div>
          </div>

          <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-3 py-5 pb-7 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:py-6 sm:pb-6 sm:overflow-x-visible">
            {WEDDING_STYLES.map((style, i) => (
              <motion.div
                key={style.label}
                initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.1 }}
                whileHover={{ scale: 1.015 }}
                className={[
                  'group relative overflow-hidden rounded-xl sm:rounded-2xl flex-shrink-0 snap-start w-[78vw] sm:w-auto',
                  style.video ? 'min-h-[260px] sm:min-h-[340px]' : 'px-6 sm:px-10 lg:px-14 py-8 sm:py-12 hover:bg-[#FAF7F2] border border-[#C5A46D]/10 transition-colors duration-500',
                ].join(' ')}
              >
                {style.video ? (
                  /* ── Video card ── */
                  <>
                    <video
                      src={style.video}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-[1800ms] ease-out"
                    />
                    {/* Cinematic dark overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1A0E09]/90 via-[#1A0E09]/45 to-[#1A0E09]/20" />
                    {/* Subtle gold glow at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-1/3 pointer-events-none" style={{ background: 'radial-gradient(ellipse at bottom, rgba(197,164,109,0.12) 0%, transparent 70%)' }} />
                    {/* Content */}
                    <div className="relative z-10 flex flex-col justify-end h-full px-8 sm:px-10 lg:px-14 py-8 sm:py-10">
                      <h3
                        className="mb-2 leading-tight text-white"
                        style={{ fontFamily: 'var(--font-playfair, serif)', fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', fontWeight: 600 }}
                      >
                        {style.label}
                      </h3>
                      <p className="text-white/65 text-xs leading-relaxed max-w-xs mb-5">{style.desc}</p>
                      <Link href="/plan" className="inline-flex items-center gap-2 text-[#C5A46D] text-[0.72rem] font-semibold tracking-[0.14em] uppercase group-hover:gap-4 transition-all duration-300">
                        <span>Plan This Wedding</span>
                        <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
                      </Link>
                    </div>
                  </>
                ) : (
                  /* ── Standard card ── */
                  <>
                    <h3
                      className="mb-4 leading-tight transition-colors duration-300 group-hover:text-[#8B1A4A]"
                      style={{ fontFamily: 'var(--font-playfair, serif)', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 600, color: '#2A1F1B' }}
                    >
                      {style.label}
                    </h3>
                    <p className="text-[#6B5B4D] text-sm leading-relaxed max-w-xs mb-8">{style.desc}</p>
                    <Link href="/plan" className="inline-flex items-center gap-2 text-[#C5A46D] text-[0.72rem] font-semibold tracking-[0.14em] uppercase group-hover:gap-4 transition-all duration-300">
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

      {/* ── 6. WEDDING JOURNAL — Cinematic sticky-scroll storytelling ── */}
      <section className="relative bg-[#2A1F1B] overflow-hidden">

        {/* Atmospheric ambient glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[70%] h-[30%] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top, rgba(197,164,109,0.09) 0%, transparent 65%)' }}
        />

        {/* ── Section header — restrained luxury ── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-18 pb-8 sm:pb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 22, filter: 'blur(6px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="eyebrow-luxury text-[#C5A46D]/70 mb-4">Wedding Journal</p>
            <h2
              className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-white leading-[1.2] mb-5"
              style={{ fontFamily: 'var(--font-playfair, serif)' }}
            >
              Celebrations Curated<br />by <span className="text-[#C5A46D]">ShaadiShopping</span>
            </h2>
            <div className="flex items-center justify-center gap-4">
              <div className="h-px w-10" style={{ background: 'linear-gradient(to right, transparent, rgba(197,164,109,0.45))' }} />
              <p className="font-cormorant italic text-white/40 text-base sm:text-lg">
                Real weddings. Real stories. Real joy.
              </p>
              <div className="h-px w-10" style={{ background: 'linear-gradient(to left, transparent, rgba(197,164,109,0.45))' }} />
            </div>
          </motion.div>
        </div>

        {/* ── Alternating 50/50 wedding sections ── */}
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
              {/* Video side */}
              <div className={`relative w-full lg:w-1/2 min-h-[56vw] sm:min-h-[45vw] lg:min-h-0 overflow-hidden ${flip ? 'lg:order-2' : 'lg:order-1'}`}>
                <motion.div
                  className="absolute inset-0"
                  initial={{ scale: 1.06 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  {w.video ? (
                    <video src={w.video} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <Image src={w.img} fill alt={w.title} sizes="50vw" className="object-cover" />
                  )}
                </motion.div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#2A1F1B]/60 via-[#2A1F1B]/10 to-transparent" />
                <div className="absolute bottom-5 left-6 pointer-events-none">
                  <p className="font-cormorant font-light leading-none select-none" style={{ fontSize: '5rem', color: 'rgba(197,164,109,0.15)' }}>{w.num}</p>
                </div>
              </div>

              {/* Text side — vertically centered */}
              <div className={`w-full lg:w-1/2 flex items-center justify-center px-6 sm:px-10 lg:px-16 py-10 lg:py-16 ${flip ? 'lg:order-1' : 'lg:order-2'}`}>
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
        {/* CTA */}
        <div className="text-center pb-20 sm:pb-28" style={{ paddingTop: '30px' }}>
          <Link
            href="/plan"
            className="inline-flex items-center gap-2 text-[#C5A46D] text-sm font-medium hover:opacity-75 transition-opacity tracking-wide"
          >
            Begin Your Wedding Journey <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </section>

      {/* ── 7. TESTIMONIAL ── */}
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
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="font-cormorant text-[7rem] sm:text-[9rem] leading-none text-[#C5A46D]/15 select-none mb-[-2.5rem]">&ldquo;</div>
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
          <div className="flex justify-center gap-2.5 mt-10">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveTestimonial(i)}
                className={`rounded-full transition-all duration-300 ${i === activeTestimonial ? 'w-6 h-1.5 bg-[#C5A46D]' : 'w-1.5 h-1.5 bg-[#C5A46D]/25 hover:bg-[#C5A46D]/50'}`}
                aria-label={`Testimonial ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. MEET YOUR EXPERT ── */}
      <section className="py-16 sm:py-24 lg:py-32 bg-[#FFFCF7] overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid lg:grid-cols-2 gap-8 lg:gap-28 items-center"
            initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} variants={stagger(0.18)}
          >
            <motion.div variants={slideLeft} className="flex flex-col items-center lg:items-start">
              <div className="w-36 h-36 sm:w-52 sm:h-52 rounded-full bg-gradient-to-br from-[#F5E9D0] to-[#EDD9B0] border-[3px] border-[#C5A46D]/30 flex items-center justify-center mb-5 sm:mb-7 shadow-xl">
                <span className="font-semibold text-5xl sm:text-7xl text-[#8B1A4A]/60 select-none" style={{ fontFamily: 'var(--font-playfair, serif)' }}>P</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-[#C5A46D]/40 animate-ping" style={{ animationDuration: '2.5s' }} />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-[#C5A46D]" />
                </span>
                <span className="text-xs text-[#8B6A3E] font-semibold tracking-wide">Available for consultation</span>
              </div>
              <p className="text-gray-400 text-xs">Mon – Sat · 10am to 7pm IST</p>
            </motion.div>

            <motion.div variants={slideRight}>
              <p className="eyebrow-luxury mb-5">Human First</p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-gray-900 mb-4 leading-tight" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
                Meet Priya.<br />Your Wedding Expert.
              </h2>
              <div className="w-12 h-px bg-[#C5A46D]/35 mb-6" />
              <p className="font-cormorant text-xl italic text-gray-500 mb-6 leading-relaxed">
                &ldquo;I treat every wedding as if it were my own sister&apos;s. Every call, every vendor visit — I&apos;m there with you.&rdquo;
              </p>
              <div className="space-y-2 text-sm text-gray-400 mb-9">
                <p><span className="text-[#C5A46D] font-semibold">Role ·</span> Senior Wedding Consultant</p>
                <p><span className="text-[#C5A46D] font-semibold">Weddings ·</span> 120+ coordinated</p>
                <p><span className="text-[#C5A46D] font-semibold">Speciality ·</span> Luxury & Destination</p>
                <p><span className="text-[#C5A46D] font-semibold">Cities ·</span> Patna · Delhi · Jaipur</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/plan" className="inline-flex items-center justify-center gap-2 bg-[#8B1A4A] text-white px-7 py-3.5 rounded-full font-semibold hover:opacity-90 transition-all shadow-lg text-sm">
                  Speak With Priya
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

      {/* ── 9. CURATED VENDORS ── */}
      {!loading && topVendors.length > 0 && (
        <section className="py-16 sm:py-24 lg:py-32 bg-[#FEFBF6]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              className="text-center mb-14"
              initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} variants={stagger(0.15)}
            >
              <motion.p variants={fadeUp} className="eyebrow-luxury mb-4">Handpicked For You</motion.p>
              <motion.h2 variants={fadeUp} className="text-4xl sm:text-5xl font-semibold text-gray-900" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
                Selected By Our <span className="gradient-text-maroon">Wedding Experts</span>
              </motion.h2>
              <motion.p variants={fadeUp} className="text-gray-400 text-sm mt-5 max-w-sm mx-auto">
                We don&apos;t list every vendor. We curate only those who consistently deliver excellence.
              </motion.p>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 sm:grid-cols-3 gap-6 lg:gap-8"
              initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }} variants={stagger(0.1)}
            >
              {topVendors.map((vendor) => (
                <motion.div key={vendor.id} variants={fadeUp}>
                  <VendorCard vendor={vendor} />
                </motion.div>
              ))}
            </motion.div>

            <div className="text-center mt-10">
              <Link href="/categories/venue" className="inline-flex items-center gap-2 border border-[#C5A46D]/35 text-[#8B1A4A] font-semibold px-8 py-3.5 rounded-full hover:bg-[#8B1A4A] hover:text-white hover:border-[#8B1A4A] transition-all text-sm">
                Explore All Curated Vendors
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── AS SEEN IN ── */}
      <div className="bg-[#FAF5EE] border-y border-[#C5A46D]/8 py-8 overflow-hidden">
        <motion.p
          className="text-center text-[0.58rem] tracking-[0.3em] uppercase text-[#C5A46D]/45 mb-5"
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          Featured In
        </motion.p>
        <motion.div
          className="flex items-center gap-8 sm:gap-14 overflow-x-auto scrollbar-hide px-6 sm:justify-center sm:flex-wrap pb-1"
          initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          {['Vogue India', 'WeddingSutra', 'Brides Today', 'The Wedding Filmer', 'HT Brunch'].map((pub) => (
            <p key={pub} className="font-cormorant text-base sm:text-xl italic text-[#8B5A6A]/28 whitespace-nowrap select-none flex-shrink-0">
              {pub}
            </p>
          ))}
        </motion.div>
      </div>

      {/* ── 10. FINAL CTA ── */}
      <section className="relative py-20 sm:py-28 lg:py-40 overflow-hidden">
        <div className="absolute inset-0">
          <Image src="https://images.unsplash.com/photo-1478146059778-26028b07395a?w=1920&q=80" alt="Wedding" fill sizes="100vw" className="object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(42,31,27,0.94) 0%, rgba(20,10,8,0.72) 100%)' }} />
          <div className="absolute bottom-0 right-0 w-1/2 h-full pointer-events-none" style={{ background: 'radial-gradient(ellipse at bottom right, rgba(197,164,109,0.10) 0%, transparent 60%)' }} />
        </div>

        <motion.div
          className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
          initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} variants={stagger(0.16)}
        >
          <motion.p variants={fadeUp} className="eyebrow-luxury text-[#C5A46D] mb-5">Begin Your Journey</motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-6xl font-semibold text-white mb-5 sm:mb-6 leading-tight" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
            Let&apos;s Create Your<br />Once-in-a-Lifetime<br />Celebration
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/55 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
            Speak with our wedding experts and start planning beautifully.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link href="/plan" className="flex items-center justify-center bg-[#8B1A4A] text-white font-semibold px-8 sm:px-10 py-4 rounded-full hover:opacity-90 transition-all hover:shadow-2xl text-sm tracking-wide">
              Book A Free Consultation
            </Link>
            <a href="tel:+917646028228" className="flex items-center justify-center gap-2 bg-white/8 backdrop-blur-sm border border-white/20 text-white font-medium px-7 sm:px-8 py-4 rounded-full hover:bg-white/14 transition-all text-sm">
              <Phone className="w-4 h-4" /> Speak With An Expert
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* ── STICKY MOBILE CTA ── */}
      {showStickyCTA && (
        <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-white/98 backdrop-blur-md border-t border-gray-100 px-4 py-3 flex items-center gap-3 shadow-2xl">
          <Link
            href="/plan"
            className="flex-1 flex items-center justify-center gap-2 bg-[#8B1A4A] text-white py-3.5 rounded-xl font-semibold text-sm"
            style={{ boxShadow: '0 4px 20px rgba(139,26,74,0.4)' }}
          >
            Start Planning
          </Link>
          <a href="tel:+917646028228" className="flex items-center justify-center gap-1.5 border border-gray-200 text-gray-600 py-3.5 px-4 rounded-xl font-semibold text-sm hover:border-[#C5A46D]/50 transition-colors">
            <Phone className="w-4 h-4" /> Call
          </a>
        </div>
      )}

    </div>
  );
}
