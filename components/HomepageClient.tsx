'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ArrowRight, Sparkles, Phone } from 'lucide-react';
import { Vendor } from '@/types';
import VendorCard from './VendorCard';

// ── Animation variants ────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
};

const slideLeft = {
  hidden: { opacity: 0, x: -40 },
  show:   { opacity: 1, x: 0,  transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const } },
};

const slideRight = {
  hidden: { opacity: 0, x: 40 },
  show:   { opacity: 1, x: 0,  transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const } },
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
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 14,
        duration: 12 + Math.random() * 12,
        size: 13 + Math.random() * 15,
        symbol: symbols[Math.floor(Math.random() * symbols.length)],
        drift: (Math.random() - 0.5) * 180,
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

// ── Main component ────────────────────────────────────────────────────────────

export default function HomepageClient() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
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
    howItWorksTimerRef.current = setInterval(() => setActiveStep((s) => (s + 1) % 4), 3000);
    return () => { if (howItWorksTimerRef.current) clearInterval(howItWorksTimerRef.current); };
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
      <section className="relative h-screen min-h-[600px] max-h-[900px] flex items-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <Image
            src="/images/hero-bg.jpg"
            alt="Wedding background"
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        </div>
        <div className="absolute inset-0 hero-overlay pointer-events-none" />
        <FloatingPetals />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32">
          <motion.div
            className="max-w-3xl"
            initial="hidden"
            animate="show"
            variants={stagger(0.18, 0.2)}
          >
            {/* Pill */}
            <motion.div
              variants={fadeUp}
              className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/25 text-white/90 px-5 py-2 rounded-full text-xs font-medium mb-7 tracking-[0.12em] uppercase"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
              India&apos;s Expert Wedding Coordination Platform
            </motion.div>

            {/* Heading */}
            <motion.h1
              variants={fadeUp}
              className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.05] mb-2 font-[Playfair_Display,serif]"
            >
              From Venue to Vidaai
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="text-3xl sm:text-4xl lg:text-5xl text-white/80 italic mb-7 font-light font-[Playfair_Display,serif] whitespace-nowrap"
            >
              — We Handle <span className="shimmer-text not-italic font-semibold">Everything</span>
            </motion.p>

            {/* Subtitle */}
            <motion.p variants={fadeUp} className="text-white/75 text-base sm:text-lg mb-8 max-w-lg leading-relaxed font-dm-sans">
              Expert consultants, verified vendors, and end-to-end coordination — all in one place for your dream Indian wedding.
            </motion.p>

            {/* CTAs */}
            <motion.div variants={fadeUp} className="flex flex-col items-start gap-3">
              <Link
                href="/plan"
                className="inline-flex items-center gap-3 bg-[#8B1A4A] text-white px-10 py-5 rounded-2xl font-bold text-xl shadow-2xl hover:opacity-90 hover:scale-105 transition-all"
                style={{ boxShadow: '0 8px 40px rgba(139,26,74,0.5)' }}
              >
                <Sparkles className="w-6 h-6" />
                Start Planning Your Wedding
                <ArrowRight className="w-6 h-6" />
              </Link>
              <a
                href="tel:+917646028228"
                className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/30 text-white px-6 py-3.5 rounded-2xl font-semibold text-base hover:bg-white/25 transition-all"
              >
                <Phone className="w-5 h-5" />
                Talk To Wedding Expert
              </a>
            </motion.div>

            {/* Stats */}
            <motion.div variants={fadeUp} className="flex flex-wrap gap-px mt-8 bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl overflow-hidden w-fit">
              {[
                { value: '10,000+', label: 'Couples Served' },
                { value: '500+',    label: 'Verified Vendors' },
                { value: '25+',     label: 'Cities Covered' },
              ].map(({ value, label }, i) => (
                <div key={label} className={`flex flex-col items-center px-6 py-3.5 ${i < 2 ? 'border-r border-white/15' : ''}`}>
                  <p className="text-white font-bold text-xl sm:text-2xl font-[Playfair_Display,serif] leading-tight">{value}</p>
                  <p className="text-white/55 text-[10px] tracking-[0.12em] uppercase mt-0.5">{label}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── 2. MARQUEE STRIP ── */}
      <div className="bg-[#1C1208] py-3.5 overflow-hidden border-y border-[#C9A96E]/20">
        <div className="flex animate-marquee whitespace-nowrap">
          {[0, 1].map((idx) => (
            <span key={idx} className="flex items-center">
              {['Venues', 'Photographers', 'Decorators', 'Mehndi Artists', 'Makeup & Bridal', 'Catering', 'DJ & Bands', 'Wedding Planners', 'Jewellery', 'Invitations', 'Pandits'].map((item) => (
                <span key={item} className="flex items-center gap-5 mx-5">
                  <span className="text-[#C9A96E] text-[0.65rem] font-semibold tracking-[0.22em] uppercase">{item}</span>
                  <span className="text-[#C9A96E]/30 text-base">✦</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ── 3. HOW IT WORKS ── */}
      <section className="py-24 sm:py-32 bg-[#FEFBEC]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 lg:mb-20">
            <p className="eyebrow-luxury mb-3">Your Journey With Us</p>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-4">How it works</h2>
            <div className="ornament-line max-w-xs mx-auto mb-4">
              <span className="text-[#C9A96E] text-sm">✦</span>
            </div>
            <p className="text-gray-500 text-sm sm:text-base">4 simple steps to a stress-free, perfectly coordinated wedding</p>
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-24 w-11/12 mx-auto">
            {/* Circle illustration */}
            <div className="relative h-[240px] w-[240px] sm:h-[360px] sm:w-[360px] lg:h-[480px] lg:w-[480px] flex-shrink-0">
              <div
                className="h-full w-full rounded-full p-[2px] shadow-[0px_12px_100px_rgba(255,255,255,0.7)]"
                style={{ background: 'linear-gradient(to top, #FDF6EA, #D4B896)' }}
              >
                <div className="h-full w-full rounded-full bg-[#FCF7C8] overflow-hidden flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    {activeStep === 0 && (
                      <motion.div key="s1" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.35 }} className="flex flex-col items-center justify-center h-full w-full px-6 relative">
                        <div className="relative">
                          <span className="text-[80px] sm:text-[110px] lg:text-[140px] leading-none select-none">📱</span>
                          <div className="absolute -top-4 -right-2 sm:-top-6 sm:-right-3 lg:-top-10 lg:-right-6 bg-white rounded-2xl shadow-lg px-3 py-2 text-[10px] sm:text-xs lg:text-sm font-medium text-gray-700 max-w-[110px] sm:max-w-[140px] lg:max-w-[170px] text-center border border-gray-100 leading-snug">
                            I want my wedding in Goa. My budget is 60 Lakhs
                          </div>
                        </div>
                      </motion.div>
                    )}
                    {activeStep === 1 && (
                      <motion.div key="s2" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.35 }} className="flex items-center justify-center h-full w-full">
                        <div className="bg-white rounded-2xl lg:rounded-3xl shadow-lg px-5 py-5 lg:px-9 lg:py-8 text-center border border-amber-100">
                          <div className="text-[#C9A96E] text-xs lg:text-sm mb-2 tracking-[0.3em]">✦&nbsp;✦&nbsp;✦</div>
                          <p className="font-[Playfair_Display,serif] text-gray-800 text-base sm:text-xl lg:text-3xl font-bold">Rahul</p>
                          <p className="font-[Playfair_Display,serif] text-gray-400 text-sm sm:text-base lg:text-xl">&amp;</p>
                          <p className="font-[Playfair_Display,serif] text-gray-800 text-base sm:text-xl lg:text-3xl font-bold">Kajal</p>
                          <div className="text-[#C9A96E] text-xs lg:text-sm mt-2 tracking-[0.3em]">✦&nbsp;✦&nbsp;✦</div>
                          <div className="flex justify-center gap-2 mt-3 text-xl lg:text-3xl">🌼 🌼</div>
                        </div>
                      </motion.div>
                    )}
                    {activeStep === 2 && (
                      <motion.div key="s3" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.35 }} className="flex items-center justify-center h-full w-full relative">
                        <span className="text-[90px] sm:text-[120px] lg:text-[160px] leading-none select-none">🛕</span>
                        <div className="absolute top-1/4 right-[18%] w-9 h-9 lg:w-14 lg:h-14 rounded-full bg-rose-500 flex items-center justify-center shadow-xl border-2 lg:border-4 border-white">
                          <span className="text-white font-bold text-sm lg:text-xl">✓</span>
                        </div>
                      </motion.div>
                    )}
                    {activeStep === 3 && (
                      <motion.div key="s4" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.35 }} className="flex flex-col items-center justify-center h-full w-full gap-4 px-8">
                        <span className="text-[80px] sm:text-[110px] lg:text-[140px] leading-none select-none">🎊</span>
                        <div className="bg-white rounded-2xl shadow-lg px-4 py-3 text-center border border-green-100 text-sm lg:text-base font-semibold text-green-700">
                          Your wedding, perfectly coordinated ✓
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Steps list */}
            <div className="flex flex-col lg:-order-1 w-full lg:basis-1/2">
              {[
                { num: 1, title: 'Tell Us About Your Wedding',        desc: 'Share your date, city, guest count, budget, and wedding style. It takes under 2 minutes.' },
                { num: 2, title: 'Get Personalized Recommendations',  desc: 'We curate venues, vendors, and packages tailored specifically to your preferences and budget.' },
                { num: 3, title: 'Speak With Your Wedding Consultant', desc: 'Your dedicated consultant reviews your plan and guides you through every decision — for free.' },
                { num: 4, title: 'Relax While We Coordinate Everything', desc: 'We handle vendor coordination, follow-ups, and logistics so you can enjoy your wedding journey.' },
              ].map((step, i) => {
                const isActive = activeStep === i;
                const isLast = i === 3;
                return (
                  <div
                    key={step.num}
                    className={`relative pl-8 lg:pl-14 cursor-pointer ${isLast ? '' : 'pb-10 lg:pb-14'}`}
                    style={!isLast ? {
                      backgroundImage: 'linear-gradient(to bottom, rgba(82,82,82,0.45) 50%, transparent 0%)',
                      backgroundSize: '1px 14px',
                      backgroundPosition: '0 0',
                      backgroundRepeat: 'repeat-y',
                    } : undefined}
                    onClick={() => {
                      setActiveStep(i);
                      if (howItWorksTimerRef.current) clearInterval(howItWorksTimerRef.current);
                      howItWorksTimerRef.current = setInterval(() => setActiveStep((s) => (s + 1) % 4), 3000);
                    }}
                  >
                    <div
                      className={`absolute left-0 top-0 z-10 flex h-7 w-7 lg:h-9 lg:w-9 items-center justify-center rounded-full text-xs lg:text-base font-bold transition-all duration-300 ${isActive ? 'bg-[#8B1A4A] text-white' : 'bg-gray-200 text-gray-400'}`}
                      style={{ transform: 'translateX(-50%)' }}
                    >
                      {step.num}
                    </div>
                    {isActive && (
                      <motion.div
                        className="absolute left-0 top-0 h-7 w-7 lg:h-9 lg:w-9 rounded-full bg-[#8B1A4A]/30 z-0"
                        style={{ transform: 'translateX(-50%)' }}
                        animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ repeat: Infinity, duration: 1.8 }}
                      />
                    )}
                    <p className={`font-[Playfair_Display,serif] leading-tight transition-all duration-300 ${isActive ? 'text-xl sm:text-2xl lg:text-[38px] lg:leading-[1.1] font-semibold text-gray-900' : 'text-sm lg:text-xl font-semibold text-gray-400'}`}>
                      {step.title}
                    </p>
                    <p className={`text-gray-500 text-sm lg:text-base lg:w-3/4 leading-relaxed transition-all duration-300 overflow-hidden ${isActive ? 'max-h-24 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                      {step.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-center mt-14 lg:mt-20">
            <Link href="/plan" className="inline-block bg-[#8B1A4A] text-white font-semibold px-10 py-4 rounded-full hover:opacity-90 transition-all text-sm lg:text-base shadow-lg hover:shadow-xl">
              Start my wedding planning
            </Link>
          </div>
        </div>
      </section>

      {/* ── 4. CURATED VENDORS ── */}
      {!loading && topVendors.length > 0 && (
        <section className="py-24 sm:py-32 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              className="text-center mb-14"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              variants={stagger(0.15)}
            >
              <motion.p variants={fadeUp} className="eyebrow-luxury mb-3">Handpicked For You</motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 font-[Playfair_Display,serif]">
                Selected By Our <span className="gradient-text-maroon">Wedding Experts</span>
              </motion.h2>
              <motion.div variants={fadeUp} className="ornament-line max-w-xs mx-auto my-5">
                <span className="text-[#C9A96E] text-sm">✦</span>
              </motion.div>
              <motion.p variants={fadeUp} className="text-gray-500 text-sm max-w-md mx-auto">
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
              <Link href="/categories/venue" className="inline-flex items-center gap-2 border border-[#C9A96E]/40 text-[#8B1A4A] font-semibold px-8 py-3.5 rounded-full hover:bg-[#8B1A4A] hover:text-white hover:border-[#8B1A4A] transition-all text-sm">
                Explore All Curated Vendors
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── 5. WHY COUPLES CHOOSE US ── */}
      <section className="py-24 sm:py-32 bg-[#FEFBF6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-28 items-start">

            {/* Left: Editorial statement */}
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              variants={stagger(0.15)}
            >
              <motion.p variants={fadeUp} className="eyebrow-luxury mb-4">Why Us</motion.p>
              <motion.h2 variants={fadeUp} className="font-cormorant text-4xl sm:text-5xl lg:text-[3.5rem] italic font-light text-gray-900 mb-6 leading-[1.15]">
                Not just a platform — a partner who cares about every detail of your most important day.
              </motion.h2>
              <motion.div variants={fadeUp} className="ornament-line max-w-[120px] mb-6">
                <span className="text-[#C9A96E] text-sm">✦</span>
              </motion.div>
              <motion.p variants={fadeUp} className="text-gray-500 text-base leading-relaxed mb-8 max-w-md">
                We built ShaadiShopping because weddings deserve more than a listing site. Every couple gets a real human expert coordinating every detail — from first enquiry to final vidaai.
              </motion.p>
              <motion.div variants={fadeUp}>
                <Link href="/plan" className="inline-flex items-center gap-2 bg-[#8B1A4A] text-white px-8 py-4 rounded-full font-semibold hover:opacity-90 transition-all shadow-lg text-sm">
                  <Sparkles className="w-4 h-4" /> Start Planning — Free
                </Link>
              </motion.div>
            </motion.div>

            {/* Right: Minimalist numbered rows — no cards, no boxes */}
            <motion.div
              className="divide-y divide-[#C9A96E]/12"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-40px' }}
              variants={stagger(0.1)}
            >
              {[
                { num: '01', title: 'One Team Managing Everything',     desc: 'A single dedicated team coordinates all your vendors, visits, and logistics end-to-end.' },
                { num: '02', title: 'Personalized Vendor Matching',     desc: 'We match vendors to your style, budget, and city — not random listings.' },
                { num: '03', title: 'Planning Within Your Budget',      desc: 'Your entire plan is built around your budget, with zero hidden surprises.' },
                { num: '04', title: 'Expert Guidance, Start to Finish', desc: 'Your dedicated consultant is with you from first call to the final vidaai.' },
                { num: '05', title: 'Technology + Human Touch',         desc: 'Smart tools combined with real human expertise for a flawless experience.' },
              ].map((point) => (
                <motion.div key={point.num} variants={fadeUp} className="flex items-start gap-7 py-7 group">
                  <span className="font-cormorant text-3xl font-light text-[#C9A96E]/35 leading-none flex-shrink-0 pt-0.5 group-hover:text-[#C9A96E] transition-colors duration-300">{point.num}</span>
                  <div>
                    <p className="font-[Playfair_Display,serif] font-semibold text-gray-900 text-[0.95rem] mb-1.5">{point.title}</p>
                    <p className="text-gray-500 text-sm leading-relaxed">{point.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── 6. TESTIMONIALS ── */}
      <section className="py-24 sm:py-32 bg-[#FFFAF5] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-14"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger(0.15)}
          >
            <motion.p variants={fadeUp} className="eyebrow-luxury text-rose-500 mb-3">Real Weddings</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 font-[Playfair_Display,serif]">
              Trusted By Couples For <span className="gradient-text">Stress-Free Planning</span>
            </motion.h2>
            <motion.div variants={fadeUp} className="ornament-line max-w-xs mx-auto mt-5">
              <span className="text-[#C9A96E] text-sm">✦</span>
            </motion.div>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger(0.15)}
          >
            {[
              {
                name: 'Priya & Rahul', city: 'Delhi', rating: 5,
                text: 'ShaadiShopping made our wedding planning so effortless! We found our dream venue, photographer, and caterer all in one place. The vendors were professional and delivered beyond expectations.',
                image: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=200&q=80',
              },
              {
                name: 'Ananya & Vikram', city: 'Mumbai', rating: 5,
                text: 'Absolutely love ShaadiShopping! The comparison feature helped us find vendors within our budget. The planning wizard saved us weeks of research. Our wedding was a fairy tale!',
                image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=200&q=80',
              },
              {
                name: 'Sneha & Arjun', city: 'Jaipur', rating: 5,
                text: "From mehndi to photography, ShaadiShopping had the perfect vendors for our royal Rajasthani wedding. The team was helpful throughout. Couldn't have asked for a better experience!",
                image: 'https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=200&q=80',
              },
            ].map((t, i) => (
              <motion.div
                key={t.name}
                variants={i % 2 === 0 ? slideLeft : slideRight}
                whileHover={{ y: -6, transition: { duration: 0.3, ease: [0.22,1,0.36,1] } }}
                className="bg-white rounded-3xl p-9 shadow-sm border border-gray-100/80 hover:shadow-md transition-shadow relative overflow-hidden"
              >
                <div className="absolute top-4 right-5 font-cormorant text-8xl text-gray-100 leading-none select-none pointer-events-none">
                  &ldquo;
                </div>
                <div className="flex gap-0.5 mb-5">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="font-cormorant text-[1.25rem] italic leading-relaxed text-gray-700 mb-6 relative z-10">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3.5 pt-4 border-t border-gray-100">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-[#C9A96E]/30">
                    <Image src={t.image} alt={t.name} fill sizes="48px" className="object-cover" />
                  </div>
                  <div>
                    <p className="text-gray-900 font-semibold text-sm font-[Playfair_Display,serif]">{t.name}</p>
                    <p className="text-[#C9A96E] text-xs tracking-wider uppercase mt-0.5">{t.city}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 7. WEDDING JOURNAL ── */}
      <section className="py-24 sm:py-32 bg-[#1C1208]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 lg:mb-20">
            <p className="eyebrow-luxury text-[#C9A96E]/70 mb-3">Wedding Journal</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white font-[Playfair_Display,serif]">
              Weddings We&apos;ve <span className="text-[#C9A96E]">Brought to Life</span>
            </h2>
            <div className="mt-5 h-px max-w-[80px] mx-auto bg-[#C9A96E]/30" />
          </div>

          <div className="divide-y divide-[#C9A96E]/12">
            {[
              {
                num: '001',
                title: 'The Jaipur Palace Ceremony',
                city: 'Jaipur, Rajasthan',
                desc: 'A 600-guest royal celebration across 3 palace venues — venue selection, 8-cuisine catering, décor, and entertainment all managed by our team.',
                tags: ['Venue', 'Catering', 'Décor', 'Entertainment'],
              },
              {
                num: '002',
                title: 'The Goa Beachside Wedding',
                city: 'North Goa',
                desc: 'An intimate 120-guest destination wedding on a private beach. End-to-end coordination including accommodation, custom floral setup, and live music.',
                tags: ['Destination', 'Floral', 'Accommodation', 'Music'],
              },
              {
                num: '003',
                title: 'The Delhi Grand Reception',
                city: 'New Delhi',
                desc: 'A 1,200-guest five-star reception. Coordinated catering, photography, décor, mehndi, bridal makeup, and full-day logistics.',
                tags: ['Full Coordination', 'Photography', 'Makeup', 'Catering'],
              },
            ].map((w, i) => (
              <motion.div
                key={w.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="grid grid-cols-12 gap-4 lg:gap-8 items-start py-10 lg:py-14 group"
              >
                <div className="col-span-2 lg:col-span-1">
                  <span className="font-cormorant text-3xl lg:text-5xl font-light text-[#C9A96E]/20 group-hover:text-[#C9A96E]/50 transition-colors duration-300 leading-none block">{w.num}</span>
                </div>
                <div className="col-span-10 lg:col-span-4">
                  <p className="text-[#C9A96E]/50 text-[0.65rem] tracking-[0.22em] uppercase mb-2">{w.city}</p>
                  <h3 className="font-[Playfair_Display,serif] text-white text-xl lg:text-2xl font-semibold leading-snug">{w.title}</h3>
                </div>
                <div className="col-span-12 lg:col-span-5">
                  <p className="text-gray-400 text-sm leading-relaxed">{w.desc}</p>
                </div>
                <div className="col-span-12 lg:col-span-2 flex flex-wrap lg:flex-col gap-2">
                  {w.tags.map((tag) => (
                    <span key={tag} className="text-[10px] text-[#C9A96E]/60 border border-[#C9A96E]/15 px-2.5 py-1 rounded-full tracking-wide whitespace-nowrap">{tag}</span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-10 pt-10 border-t border-[#C9A96E]/10">
            <p className="text-gray-600 text-sm">Real photography coming soon — we&apos;re documenting every coordinated wedding.</p>
          </div>
        </div>
      </section>

      {/* ── 8. MEET YOUR EXPERT ── */}
      <section className="py-24 sm:py-32 bg-[#FFFAF5]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid lg:grid-cols-2 gap-14 lg:gap-24 items-center"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger(0.18)}
          >
            {/* Avatar — large, editorial */}
            <motion.div variants={slideLeft} className="flex flex-col items-center lg:items-start">
              <div className="w-48 h-48 rounded-full bg-gradient-to-br from-rose-100 to-amber-50 border-[3px] border-[#C9A96E]/25 flex items-center justify-center text-8xl mb-6 shadow-xl">
                👩‍💼
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-600 font-semibold tracking-wide">Available for consultation</span>
              </div>
              <p className="text-gray-400 text-xs">Mon – Sat · 10am to 7pm IST</p>
            </motion.div>

            {/* Content */}
            <motion.div variants={slideRight}>
              <p className="eyebrow-luxury mb-4">Human First</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-4 leading-tight">
                Meet Priya.<br />Your Wedding Expert.
              </h2>
              <div className="w-12 h-px bg-[#C9A96E]/40 mb-5" />
              <p className="font-cormorant text-xl italic text-gray-600 mb-5 leading-relaxed">
                &ldquo;I treat every wedding as if it were my own sister&apos;s. Every call, every vendor visit, every decision — I&apos;m there with you.&rdquo;
              </p>
              <div className="space-y-2 text-sm text-gray-500 mb-8">
                <p><span className="text-[#C9A96E] font-semibold">Role ·</span> Senior Wedding Consultant</p>
                <p><span className="text-[#C9A96E] font-semibold">Coordinated ·</span> 120+ weddings</p>
                <p><span className="text-[#C9A96E] font-semibold">Speciality ·</span> Luxury & Destination</p>
                <p><span className="text-[#C9A96E] font-semibold">Cities ·</span> Patna · Delhi · Jaipur</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/plan" className="inline-flex items-center justify-center gap-2 bg-[#8B1A4A] text-white px-7 py-3.5 rounded-full font-semibold hover:opacity-90 transition-all shadow-lg text-sm">
                  <Sparkles className="w-4 h-4" /> Speak With Priya
                </Link>
                <a href="tel:+917646028228" className="inline-flex items-center justify-center gap-2 border border-gray-200 text-gray-600 px-7 py-3.5 rounded-full font-medium hover:border-[#8B1A4A] hover:text-[#8B1A4A] transition-all text-sm">
                  <Phone className="w-4 h-4" /> Call Now
                </a>
              </div>
              <p className="text-gray-400 text-xs mt-6">
                Priya is one of 5 dedicated consultants on our team — each specializing in different wedding styles and regions across India.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── 9. FINAL CTA ── */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1478146059778-26028b07395a?w=1920&q=80"
            alt="Wedding decoration"
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950/90 to-gray-900/70" />
        </div>

        <motion.div
          className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger(0.14)}
        >
          <div className="max-w-2xl mx-auto">
            <motion.p variants={fadeUp} className="eyebrow-luxury text-[#C9A96E] mb-4">
              Begin Your Journey
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white mb-5 font-[Playfair_Display,serif]">
              Let&apos;s Start Planning<br/><span className="shimmer-text">Your Wedding</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-white/70 text-base mb-10">
              Join thousands of couples who planned their perfect wedding with ShaadiShopping&apos;s expert coordination and trusted vendors.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/plan"
                className="bg-[#8B1A4A] text-white font-bold px-10 py-4 rounded-full hover:opacity-90 transition-all hover:shadow-2xl text-sm"
              >
                Build My Wedding Plan
              </Link>
              <a
                href="tel:+917070486987"
                className="flex items-center justify-center gap-2 bg-white/15 backdrop-blur-sm border border-white/30 text-white font-semibold px-8 py-4 rounded-full hover:bg-white/25 transition-all text-sm"
              >
                <Phone className="w-4 h-4" />
                Talk to an Expert
              </a>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ── STICKY MOBILE CTA ── */}
      {showStickyCTA && (
        <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 shadow-2xl">
          <Link
            href="/plan"
            className="flex-1 flex items-center justify-center gap-2 bg-[#8B1A4A] text-white py-3.5 rounded-xl font-bold text-sm"
            style={{ boxShadow: '0 4px 20px rgba(139,26,74,0.4)' }}
          >
            <Sparkles className="w-4 h-4" /> Start Planning — Free
          </Link>
          <a
            href="tel:+917646028228"
            className="flex items-center justify-center gap-1.5 border border-gray-200 text-gray-700 py-3.5 px-4 rounded-xl font-semibold text-sm"
          >
            <Phone className="w-4 h-4" /> Call
          </a>
        </div>
      )}

    </div>
  );
}
