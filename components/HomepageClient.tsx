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
  },
  {
    num: '002',
    title: 'The Goa Beachside Wedding',
    city: 'North Goa',
    desc: 'An intimate 120-guest destination wedding on a private beach. Custom florals, live music, seaside accommodation, and seamless logistics.',
    tags: ['Destination', 'Floral', 'Accommodation', 'Music'],
    img: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=1200&q=85',
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
  const [activeWedding, setActiveWedding] = useState(0);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [showStickyCTA, setShowStickyCTA] = useState(false);

  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const weddingRefs = useRef<(HTMLDivElement | null)[]>([]);

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

  // IntersectionObserver — activates wedding story when it occupies viewport center
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = weddingRefs.current.findIndex((ref) => ref === entry.target);
            if (idx !== -1) setActiveWedding(idx);
          }
        });
      },
      { threshold: 0.55, rootMargin: '-10% 0px -10% 0px' },
    );
    weddingRefs.current.forEach((ref) => { if (ref) observer.observe(ref); });
    return () => observer.disconnect();
  }, []);

  const topVendors = [...vendors].sort((a, b) => b.rating - a.rating).slice(0, 3);

  return (
    <div>

      {/* ── 1. HERO ── */}
      <section className="relative h-screen min-h-[620px] max-h-[940px] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/images/hero-bg.jpg" alt="Wedding" fill className="object-cover" sizes="100vw" priority />
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

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 sm:pt-40">
          <div className="max-w-3xl">

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 bg-white/8 backdrop-blur-sm border border-white/15 text-white/80 px-5 py-2 rounded-full text-xs font-medium mb-8 tracking-[0.14em] uppercase"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#C5A46D]" />
              India&apos;s Expert Wedding Coordination Platform
            </motion.div>

            {/* ── Cinematic headline — phrase-by-phrase blur reveal ── */}
            <h1
              className="text-4xl sm:text-5xl lg:text-[3.75rem] font-semibold text-white leading-[1.12] mb-6"
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
              {/* Line 2: slow, weighted reveal */}
              <span className="block">
                <motion.span
                  className="inline-block"
                  initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 1.4, delay: 1.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  — We Handle Everything
                </motion.span>
              </span>
            </h1>

            {/* Subtext */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.0, delay: 1.85, ease: [0.22, 1, 0.36, 1] }}
              className="text-white/65 text-lg mb-10 max-w-xl leading-relaxed"
            >
              Expert consultants. Verified vendors. End-to-end coordination — for your dream Indian wedding.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.0, delay: 2.15, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col sm:flex-row items-start gap-4"
            >
              <Link
                href="/plan"
                className="inline-flex items-center gap-2 bg-[#8B1A4A] text-white px-9 py-4 rounded-full font-semibold text-sm shadow-xl hover:opacity-90 transition-all"
                style={{ boxShadow: '0 8px 40px rgba(139,26,74,0.45)' }}
              >
                Start Planning <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="tel:+917646028228"
                className="inline-flex items-center gap-2 bg-white/8 backdrop-blur-sm border border-white/20 text-white/90 px-7 py-4 rounded-full font-medium text-sm hover:bg-white/14 transition-all"
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
                <p className="font-cormorant text-5xl sm:text-6xl font-light text-[#8B1A4A] leading-none mb-2">{value}</p>
                <p className="text-gray-400 text-[0.7rem] tracking-[0.2em] uppercase">{label}</p>
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
              <div className="sticky top-0 h-screen flex items-center justify-center">
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
      <section className="bg-[#FFFCF7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-16 sm:py-20 border-b border-[#C5A46D]/10">
            <div className="max-w-lg">
              <p className="eyebrow-luxury mb-4">Our Speciality</p>
              <h2 className="font-semibold text-[#2A1F1B] text-4xl sm:text-5xl leading-tight" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
                Every Wedding Style,<br />Beautifully Served
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y divide-[#C5A46D]/10">
            {WEDDING_STYLES.map((style, i) => (
              <motion.div
                key={style.label}
                initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.1 }}
                className={[
                  'group relative overflow-hidden',
                  style.video ? 'min-h-[420px] sm:min-h-[480px]' : 'px-8 sm:px-10 lg:px-14 py-12 sm:py-16 hover:bg-[#FAF7F2] transition-colors duration-500',
                  i >= 2 ? 'border-t border-[#C5A46D]/10' : '',
                  i % 2 === 0 ? 'sm:border-r border-[#C5A46D]/10' : '',
                ].join(' ')}
              >
                {style.video ? (
                  /* ── Video card (Royal) ── */
                  <>
                    <video
                      src={style.video}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {/* Cinematic dark overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1A0E09]/90 via-[#1A0E09]/45 to-[#1A0E09]/20" />
                    {/* Subtle gold glow at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-1/3 pointer-events-none" style={{ background: 'radial-gradient(ellipse at bottom, rgba(197,164,109,0.12) 0%, transparent 70%)' }} />
                    {/* Content */}
                    <div className="relative z-10 flex flex-col justify-end h-full px-8 sm:px-10 lg:px-14 py-12 sm:py-14">
                      <p className="eyebrow-luxury text-[#C5A46D]/80 mb-3">{style.num}</p>
                      <h3
                        className="mb-3 leading-tight text-white"
                        style={{ fontFamily: 'var(--font-playfair, serif)', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 600 }}
                      >
                        {style.label}
                      </h3>
                      <p className="text-white/65 text-sm leading-relaxed max-w-xs mb-8">{style.desc}</p>
                      <Link href="/plan" className="inline-flex items-center gap-2 text-[#C5A46D] text-[0.72rem] font-semibold tracking-[0.14em] uppercase group-hover:gap-4 transition-all duration-300">
                        <span>Plan This Wedding</span>
                        <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
                      </Link>
                    </div>
                  </>
                ) : (
                  /* ── Standard card ── */
                  <>
                    <span
                      aria-hidden="true"
                      className="absolute right-6 -top-2 font-cormorant font-light leading-none select-none pointer-events-none"
                      style={{ fontSize: 'clamp(6rem, 10vw, 10rem)', color: 'rgba(197,164,109,0.07)' }}
                    >
                      {style.num}
                    </span>
                    <p className="eyebrow-luxury text-[#C5A46D]/80 mb-4">{style.num}</p>
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

        {/* Section header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-32 pb-14 sm:pb-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.7 }}
          >
            <p className="eyebrow-luxury text-[#C5A46D]/70 mb-4">Wedding Journal</p>
            <h2
              className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-white"
              style={{ fontFamily: 'var(--font-playfair, serif)' }}
            >
              Celebrations Curated<br />by <span className="text-[#C5A46D]">ShaadiShopping</span>
            </h2>
            <p className="font-cormorant italic text-[#6B5B4D] text-xl mt-5">
              Real weddings. Real stories. Real joy.
            </p>
          </motion.div>
        </div>

        {/* ── DESKTOP — sticky left image + scrolling right stories ── */}
        <div className="hidden lg:grid lg:grid-cols-2 max-w-7xl mx-auto">

          {/* LEFT — sticky cinematic image panel */}
          <div className="sticky top-0 h-screen overflow-hidden">

            {/* Warm radial glow behind image */}
            <div
              className="absolute inset-0 z-10 pointer-events-none"
              style={{ background: 'radial-gradient(circle at center, rgba(197,164,109,0.07) 0%, transparent 60%)' }}
            />

            {/* Cross-fade image with slow cinematic zoom on enter */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeWedding}
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 1.06 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.03, transition: { duration: 0.65 } }}
                transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <Image
                  src={WEDDINGS[activeWedding].img}
                  alt={WEDDINGS[activeWedding].title}
                  fill sizes="50vw"
                  className="object-cover"
                  priority
                />
                {/* Directional cinematic vignette */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#2A1F1B]/55 via-transparent to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#2A1F1B]/70 via-transparent to-[#2A1F1B]/25" />
              </motion.div>
            </AnimatePresence>

            {/* Large editorial number — overlaid on image, very dim */}
            <div className="absolute bottom-10 left-8 z-20 pointer-events-none overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.p
                  key={activeWedding}
                  className="font-cormorant font-light leading-none select-none"
                  style={{ fontSize: '9rem', color: 'rgba(197,164,109,0.14)' }}
                  initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -20, transition: { duration: 0.4 } }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                >
                  {WEDDINGS[activeWedding].num}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Vertical progress dots — right edge of image */}
            <div className="absolute right-5 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-20">
              {WEDDINGS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => weddingRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  aria-label={`Wedding story ${i + 1}`}
                  className={`rounded-full transition-all duration-500 ${
                    i === activeWedding
                      ? 'h-6 w-1.5 bg-[#C5A46D]'
                      : 'h-1.5 w-1.5 bg-white/20 hover:bg-white/45'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* RIGHT — scrolling story panels */}
          <div className="relative">

            {/* Animated gold progress line */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-[#C5A46D]/10">
              <motion.div
                className="absolute top-0 left-0 w-full"
                animate={{ height: `${((activeWedding + 1) / WEDDINGS.length) * 100}%` }}
                transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                style={{ background: 'linear-gradient(to bottom, #C5A46D, #E8D4A0)' }}
              />
            </div>

            {WEDDINGS.map((w, i) => {
              const isActive = activeWedding === i;
              return (
                <div
                  key={w.num}
                  ref={(el) => { weddingRefs.current[i] = el; }}
                  className="min-h-[80vh] flex items-center pl-14 pr-8 lg:pr-12 py-20 cursor-pointer"
                  onClick={() => weddingRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  style={{ transition: 'opacity 0.7s ease', opacity: isActive ? 1 : 0.22 }}
                >
                  <div className="w-full max-w-md">

                    {/* Story number — dims elegantly when inactive */}
                    <motion.p
                      className="font-cormorant font-light leading-none mb-5 select-none"
                      style={{ fontSize: '5.5rem' }}
                      animate={{ color: isActive ? 'rgba(197,164,109,0.38)' : 'rgba(197,164,109,0.09)' }}
                      transition={{ duration: 0.55 }}
                    >
                      {w.num}
                    </motion.p>

                    {/* City — blur reveal */}
                    <motion.p
                      className="text-[0.65rem] tracking-[0.32em] uppercase mb-3"
                      animate={{
                        color: isActive ? 'rgba(197,164,109,0.78)' : 'rgba(197,164,109,0.22)',
                        filter: isActive ? 'blur(0px)' : 'blur(2px)',
                        y: isActive ? 0 : 6,
                      }}
                      transition={{ duration: 0.6, delay: isActive ? 0.07 : 0 }}
                    >
                      {w.city}
                    </motion.p>

                    {/* Title — blur-to-clear reveal, no font-size animation */}
                    <motion.h3
                      className="font-semibold leading-tight mb-5 text-3xl sm:text-4xl"
                      style={{ fontFamily: 'var(--font-playfair, serif)' }}
                      animate={{
                        color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.28)',
                        filter: isActive ? 'blur(0px)' : 'blur(1.5px)',
                        y: isActive ? 0 : 10,
                      }}
                      transition={{ duration: 0.65, delay: isActive ? 0.14 : 0, ease: [0.16, 1, 0.3, 1] }}
                    >
                      {w.title}
                    </motion.h3>

                    {/* Gold divider line — animates width */}
                    <motion.div
                      className="h-px mb-6"
                      style={{ background: 'linear-gradient(to right, #C5A46D, transparent)' }}
                      animate={{ width: isActive ? '60px' : '18px', opacity: isActive ? 1 : 0.15 }}
                      transition={{ duration: 0.55, delay: isActive ? 0.22 : 0 }}
                    />

                    {/* Description — blur-up reveal */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.p
                          className="text-[#8A7A6A] text-sm leading-relaxed mb-8"
                          initial={{ opacity: 0, filter: 'blur(8px)', y: 18 }}
                          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                          exit={{ opacity: 0, y: -8, transition: { duration: 0.28 } }}
                          transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        >
                          {w.desc}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {/* Tags — staggered individual reveal */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          className="flex flex-wrap gap-2"
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, transition: { duration: 0.22 } }}
                          transition={{ duration: 0.5, delay: 0.42 }}
                        >
                          {w.tags.map((tag, ti) => (
                            <motion.span
                              key={tag}
                              className="text-[10px] text-[#C5A46D]/55 border border-[#C5A46D]/15 px-3 py-1.5 rounded-full tracking-wide"
                              initial={{ opacity: 0, scale: 0.88 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.4, delay: 0.44 + ti * 0.07 }}
                            >
                              {tag}
                            </motion.span>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </div>
                </div>
              );
            })}

          </div>
        </div>

        {/* ── MOBILE — cinematic card stack (no sticky layout on small screens) ── */}
        <div className="lg:hidden max-w-7xl mx-auto px-4 pb-16">
          {WEDDINGS.map((w, i) => (
            <motion.div
              key={w.num}
              className="mb-14 last:mb-0"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, delay: i * 0.1 }}
            >
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden mb-6 img-zoom">
                <Image src={w.img} fill className="object-cover" alt={w.title} sizes="100vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#2A1F1B]/70 via-[#2A1F1B]/10 to-transparent" />
                <div className="absolute bottom-5 left-5">
                  <p className="text-[#C5A46D]/60 text-[0.6rem] tracking-[0.25em] uppercase mb-1">{w.city}</p>
                  <p className="font-cormorant text-5xl font-light text-white/12 leading-none">{w.num}</p>
                </div>
              </div>
              <h3
                className="text-white text-2xl font-semibold mb-3 leading-snug"
                style={{ fontFamily: 'var(--font-playfair, serif)' }}
              >
                {w.title}
              </h3>
              <div className="w-10 h-px mb-4" style={{ background: 'linear-gradient(to right, #C5A46D, transparent)' }} />
              <p className="text-[#6B5B4D] text-sm leading-relaxed mb-5">{w.desc}</p>
              <div className="flex flex-wrap gap-2">
                {w.tags.map((tag) => (
                  <span key={tag} className="text-[10px] text-[#C5A46D]/50 border border-[#C5A46D]/12 px-3 py-1.5 rounded-full tracking-wide">
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center pb-20 sm:pb-28">
          <Link
            href="/plan"
            className="inline-flex items-center gap-2 text-[#C5A46D] text-sm font-medium hover:opacity-75 transition-opacity tracking-wide"
          >
            Begin Your Wedding Journey <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </section>

      {/* ── 7. TESTIMONIAL ── */}
      <section className="py-24 sm:py-32 bg-[#FAF5EE] overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="eyebrow-luxury text-[#C5A46D] mb-6">What Couples Say</p>
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
      <section className="py-24 sm:py-32 bg-[#FFFCF7] overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid lg:grid-cols-2 gap-16 lg:gap-28 items-center"
            initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} variants={stagger(0.18)}
          >
            <motion.div variants={slideLeft} className="flex flex-col items-center lg:items-start">
              <div className="w-52 h-52 rounded-full bg-gradient-to-br from-[#F5E9D0] to-[#EDD9B0] border-[3px] border-[#C5A46D]/30 flex items-center justify-center mb-7 shadow-xl">
                <span className="font-semibold text-7xl text-[#8B1A4A]/60 select-none" style={{ fontFamily: 'var(--font-playfair, serif)' }}>P</span>
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
              <h2 className="text-4xl sm:text-5xl font-semibold text-gray-900 mb-4 leading-tight" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
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
        <section className="py-24 sm:py-32 bg-[#FEFBF6]">
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

      {/* ── 10. FINAL CTA ── */}
      <section className="relative py-28 sm:py-40 overflow-hidden">
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
          <motion.h2 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-white mb-6 leading-tight" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
            Let&apos;s Create Your<br />Once-in-a-Lifetime<br />Celebration
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/55 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
            Speak with our wedding experts and start planning beautifully.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/plan" className="bg-[#8B1A4A] text-white font-semibold px-10 py-4 rounded-full hover:opacity-90 transition-all hover:shadow-2xl text-sm tracking-wide">
              Book A Free Consultation
            </Link>
            <a href="tel:+917070486987" className="flex items-center justify-center gap-2 bg-white/8 backdrop-blur-sm border border-white/20 text-white font-medium px-8 py-4 rounded-full hover:bg-white/14 transition-all text-sm">
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
