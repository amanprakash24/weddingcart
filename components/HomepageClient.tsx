'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Star, ChevronLeft, ChevronRight, Users, Award, ArrowRight, Sparkles, Phone } from 'lucide-react';
import { Vendor, Category } from '@/types';
import VendorCard from './VendorCard';
import CategoryCard from './CategoryCard';

// ── Animation variants ────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
};

const fadeIn = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.6 } },
};

const scaleUp = {
  hidden: { opacity: 0, scale: 0.88, y: 20 },
  show:   { opacity: 1, scale: 1,    y: 0,  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
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

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ eyebrow, eyebrowColor = 'text-amber-600', title, subtitle }: {
  eyebrow: string; eyebrowColor?: string; title: React.ReactNode; subtitle?: string;
}) {
  return (
    <motion.div
      className="text-center mb-10"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      variants={stagger(0.15)}
    >
      <motion.p variants={fadeUp} className={`${eyebrowColor} text-sm font-semibold uppercase tracking-wider mb-2`}>
        {eyebrow}
      </motion.p>
      <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-gray-900 font-[Playfair_Display,serif]">
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p variants={fadeUp} className="text-gray-500 mt-2 text-sm">
          {subtitle}
        </motion.p>
      )}
    </motion.div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

// ── Vendor directory data ─────────────────────────────────────────────────────

const VENDOR_CATEGORIES = [
  {
    heading: 'Wedding Venues',
    items: [
      { label: 'Banquet Halls', href: '/categories/venue' },
      { label: 'Hotels', href: '/categories/venue' },
      { label: 'Marriage Garden', href: '/categories/venue' },
      { label: 'Kalyana Mandapams', href: '/categories/venue' },
      { label: 'Wedding Resorts', href: '/categories/venue' },
      { label: 'Wedding Lawns & Farmhouses', href: '/categories/venue' },
    ],
  },
  {
    heading: 'Wedding Vendors',
    items: [
      { label: 'Caterers', href: '/categories/catering' },
      { label: 'Wedding Invitations', href: '/categories/invitations' },
      { label: 'Wedding Gifts', href: '/categories/gifts' },
      { label: 'Wedding Photographers', href: '/categories/photo-video' },
      { label: 'Wedding Music', href: '/categories/band' },
      { label: 'Wedding Transportation', href: '/categories/transport' },
      { label: 'Tent House', href: '/categories/decorator' },
      { label: 'Wedding Entertainment', href: '/categories/band' },
      { label: 'Florists', href: '/categories/decorator' },
      { label: 'Wedding Planners', href: '/categories/planning' },
      { label: 'Wedding Videography', href: '/categories/photo-video' },
      { label: 'Honeymoon', href: '/categories/venue' },
      { label: 'Wedding Decorators', href: '/categories/decorator' },
      { label: 'Wedding Cakes', href: '/categories/catering' },
      { label: 'Wedding DJ', href: '/categories/dj' },
      { label: 'Pandits', href: '/categories/planning' },
      { label: 'Photobooth', href: '/categories/photo-video' },
      { label: 'Astrologers', href: '/categories/planning' },
      { label: 'Party Places', href: '/categories/venue' },
      { label: 'Wedding Choreographers', href: '/categories/band' },
    ],
  },
  {
    heading: 'Brides',
    items: [
      { label: 'Mehndi Artists', href: '/categories/mehndi' },
      { label: 'Bridal Makeup Artists', href: '/categories/makeup' },
      { label: 'Makeup Salon', href: '/categories/makeup' },
      { label: 'Bridal Jewellery', href: '/categories/makeup' },
      { label: 'Bridal Lehenga', href: '/categories/makeup' },
      { label: 'Trousseau Packing', href: '/categories/makeup' },
    ],
  },
  {
    heading: 'Grooms',
    items: [
      { label: 'Sherwani / Groom Wear', href: '/categories/makeup' },
    ],
  },
];

const LOCATIONS = [
  { state: 'Bihar', cities: ['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur'] },
  { state: 'West Bengal', cities: ['Kolkata', 'Darjeeling', 'Howrah'] },
  { state: 'Goa', cities: ['North Goa', 'South Goa'] },
  { state: 'Maharashtra', cities: ['Mumbai', 'Pune', 'Nashik', 'Nagpur', 'Raigad'] },
  { state: 'Delhi NCR', cities: ['Gurgaon', 'South Delhi', 'West Delhi', 'Noida', 'Faridabad', 'Dwarka', 'Greater Noida'] },
  { state: 'Uttar Pradesh', cities: ['Lucknow', 'Agra', 'Varanasi', 'Kanpur', 'Allahabad'] },
  { state: 'Rajasthan', cities: ['Jaipur', 'Udaipur', 'Jodhpur', 'Ajmer', 'Alwar'] },
  { state: 'Karnataka', cities: ['Bangalore', 'Mysore', 'Belgaum'] },
  { state: 'Tamil Nadu', cities: ['Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Vellore'] },
  { state: 'Telangana', cities: ['Hyderabad', 'Warangal', 'Medchal'] },
  { state: 'Gujarat', cities: ['Ahmedabad', 'Vadodara', 'Surat', 'Gandhinagar', 'Rajkot'] },
  { state: 'Uttarakhand', cities: ['Dehradun', 'Nainital', 'Haridwar'] },
  { state: 'Punjab', cities: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala'] },
  { state: 'Chandigarh', cities: ['Chandigarh City', 'Mohali', 'Panchkula', 'Zirakpur'] },
  { state: 'Madhya Pradesh', cities: ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain'] },
  { state: 'Kerala', cities: ['Kochi', 'Thiruvananthapuram', 'Alappuzha', 'Thrissur'] },
  { state: 'Himachal Pradesh', cities: ['Shimla', 'Solan', 'Kangra', 'Kullu', 'Chamba'] },
  { state: 'Andhra Pradesh', cities: ['Visakhapatnam', 'Vijayawada', 'Kurnool'] },
  { state: 'Odisha', cities: ['Bhubaneswar', 'Puri', 'Khordha'] },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function HomepageClient() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [specialServices, setSpecialServices] = useState<Category[]>([]);
  const [featuredVendors, setFeaturedVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);
  const featuredCarouselRef = useRef<HTMLDivElement>(null);
  const carousel1Timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const carousel2Timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const howItWorksTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [catRes, specialRes, vendorRes] = await Promise.all([
        fetch('/api/categories?isSpecial=false'),
        fetch('/api/categories?isSpecial=true'),
        fetch('/api/vendors?limit=50'),
      ]);
      const [catData, specialData, vendorData] = await Promise.all([catRes.json(), specialRes.json(), vendorRes.json()]);

      if (catData.success) {
        const sorted = [...catData.data].sort((a: Category, b: Category) => {
          if (a.id === 'venue') return -1;
          if (b.id === 'venue') return 1;
          return 0;
        });
        setCategories(sorted);
      }
      if (specialData.success) {
        const PRIORITY = ['legal', 'pandit', 'pandits'];
        const sorted = [...specialData.data].sort((a: Category, b: Category) => {
          const aIdx = PRIORITY.findIndex((p) => a.id?.toLowerCase().includes(p) || a.name?.toLowerCase().includes(p));
          const bIdx = PRIORITY.findIndex((p) => b.id?.toLowerCase().includes(p) || b.name?.toLowerCase().includes(p));
          const aRank = aIdx === -1 ? 999 : aIdx;
          const bRank = bIdx === -1 ? 999 : bIdx;
          return aRank - bRank;
        });
        setSpecialServices(sorted);
      }
      if (vendorData.success) {
        setVendors(vendorData.data);
        setFeaturedVendors(vendorData.data.filter((v: Vendor) => v.isFeatured).slice(0, 6));
      }
    } catch {
      // Use empty arrays if API fails
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    howItWorksTimerRef.current = setInterval(() => setActiveStep((s) => (s + 1) % 4), 3000);
    return () => { if (howItWorksTimerRef.current) clearInterval(howItWorksTimerRef.current); };
  }, []);

  const topVendors = [...vendors].sort((a, b) => b.rating - a.rating).slice(0, 6);

  const scrollCarousel = (dir: 'left' | 'right') => {
    const el = carouselRef.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement;
    const amount = card ? card.offsetWidth + 14 : el.clientWidth / 4;
    if (dir === 'left' && el.scrollLeft < amount) {
      el.scrollLeft = el.scrollWidth / 2;
    }
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  const scrollFeatured = (dir: 'left' | 'right') => {
    const el = featuredCarouselRef.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement;
    const amount = card ? card.offsetWidth + 14 : el.clientWidth / 4;
    if (dir === 'left' && el.scrollLeft < amount) {
      el.scrollLeft = el.scrollWidth / 2;
    }
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  const onCarousel1Scroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    if (el.scrollLeft >= el.scrollWidth / 2) {
      el.scrollLeft -= el.scrollWidth / 2;
    }
  };

  const onCarousel2Scroll = () => {
    const el = featuredCarouselRef.current;
    if (!el) return;
    if (el.scrollLeft >= el.scrollWidth / 2) {
      el.scrollLeft -= el.scrollWidth / 2;
    }
  };

  const resetCarousel1Timer = () => {
    if (carousel1Timer.current) clearInterval(carousel1Timer.current);
    carousel1Timer.current = setInterval(() => scrollCarousel('right'), 5000);
  };

  const resetCarousel2Timer = () => {
    if (carousel2Timer.current) clearInterval(carousel2Timer.current);
    carousel2Timer.current = setInterval(() => scrollFeatured('right'), 5000);
  };

  const pauseCarousel1 = () => {
    if (carousel1Timer.current) clearInterval(carousel1Timer.current);
  };

  const pauseCarousel2 = () => {
    if (carousel2Timer.current) clearInterval(carousel2Timer.current);
  };

  const handleCarousel1 = (dir: 'left' | 'right') => {
    scrollCarousel(dir);
    resetCarousel1Timer();
  };

  const handleCarousel2 = (dir: 'left' | 'right') => {
    scrollFeatured(dir);
    resetCarousel2Timer();
  };

  // Auto-scroll both carousels every 3s (featured offset by 1.5s)
  useEffect(() => {
    if (loading) return;
    carousel1Timer.current = setInterval(() => scrollCarousel('right'), 5000);
    const timeout = setTimeout(() => {
      carousel2Timer.current = setInterval(() => scrollFeatured('right'), 5000);
    }, 1500);
    return () => {
      if (carousel1Timer.current) clearInterval(carousel1Timer.current);
      if (carousel2Timer.current) clearInterval(carousel2Timer.current);
      clearTimeout(timeout);
    };
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      {/* ── HERO ── */}
      <section className="relative h-screen min-h-[600px] max-h-[900px] flex items-center overflow-hidden">
        {/* Background image */}
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

        {/* Floating petals */}
        <FloatingPetals />

        {/* Hero content */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
          <motion.div
            className="max-w-3xl"
            initial="hidden"
            animate="show"
            variants={stagger(0.18, 0.2)}
          >
            {/* Pill badge */}
            <motion.div
              variants={fadeUp}
              className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/30 text-white px-4 py-1.5 rounded-full text-sm font-medium mb-6"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              India&apos;s Most Trusted Wedding Marketplace
            </motion.div>

            {/* Heading */}
            <motion.h1
              variants={fadeUp}
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-[1.1] mb-6 font-[Playfair_Display,serif]"
            >
              From Venue to Vidaai —{' '}
              <span className="shimmer-text">We Handle Everything</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p variants={fadeUp} className="text-white/80 text-lg sm:text-xl mb-8 max-w-xl">
              ShaadiShopping helps couples plan, coordinate, and manage their complete wedding journey with expert guidance and trusted vendors.
            </motion.p>

            {/* CTA */}
            <motion.div variants={fadeUp} className="flex flex-col items-start gap-3">
              <Link
                href="/plan"
                className="inline-flex items-center gap-3 bg-[#8B1A4A] text-white px-8 py-4 rounded-2xl font-semibold text-lg shadow-2xl hover:opacity-90 hover:scale-105 transition-all"
              >
                <Sparkles className="w-5 h-5" />
                Start Planning Your Wedding
                <ArrowRight className="w-5 h-5" />
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
            <motion.div variants={fadeUp} className="flex flex-wrap gap-6 mt-8">
              {[
                { icon: Users,  label: '10,000+ Couples', sub: 'Trust Us' },
                { icon: Award,  label: '500+ Vendors',    sub: 'Verified' },
                { icon: MapPin, label: '25+ Cities',      sub: 'Covered' },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-white/15 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{label}</p>
                    <p className="text-white/60 text-xs">{sub}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-16 sm:py-24 bg-[#FEFBEC]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Title */}
          <div className="text-center mb-12 lg:mb-16">
            <div className="flex items-center justify-center gap-3 sm:gap-6 mb-3">
              <span className="hidden sm:block text-[#C9A96E] text-base tracking-widest select-none">←———→</span>
              <h2 className="text-3xl sm:text-5xl font-bold text-gray-900 font-[Playfair_Display,serif]">How it works</h2>
              <span className="hidden sm:block text-[#C9A96E] text-base tracking-widest select-none">←———→</span>
            </div>
            <p className="text-gray-500 text-sm sm:text-base">4 simple steps to a stress-free, perfectly coordinated wedding</p>
          </div>

          {/* Steps + Image */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-24 w-11/12 mx-auto">

            {/* Circular illustration — right on desktop */}
            <div className="relative h-[240px] w-[240px] sm:h-[360px] sm:w-[360px] lg:h-[480px] lg:w-[480px] flex-shrink-0">
              <div
                className="h-full w-full rounded-full p-[2px] shadow-[0px_12px_100px_rgba(255,255,255,0.7)]"
                style={{ background: 'linear-gradient(to top, #FDF6EA, #D4B896)' }}
              >
                <div className="h-full w-full rounded-full bg-[#FCF7C8] overflow-hidden flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    {activeStep === 0 && (
                      <motion.div
                        key="s1"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.35 }}
                        className="flex flex-col items-center justify-center h-full w-full px-6 relative"
                      >
                        <div className="relative">
                          <span className="text-[80px] sm:text-[110px] lg:text-[140px] leading-none select-none">📱</span>
                          <div className="absolute -top-4 -right-2 sm:-top-6 sm:-right-3 lg:-top-10 lg:-right-6 bg-white rounded-2xl shadow-lg px-3 py-2 text-[10px] sm:text-xs lg:text-sm font-medium text-gray-700 max-w-[110px] sm:max-w-[140px] lg:max-w-[170px] text-center border border-gray-100 leading-snug">
                            I want my wedding in Goa. My budget is 60 Lakhs
                          </div>
                        </div>
                      </motion.div>
                    )}
                    {activeStep === 1 && (
                      <motion.div
                        key="s2"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.35 }}
                        className="flex items-center justify-center h-full w-full"
                      >
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
                      <motion.div
                        key="s3"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.35 }}
                        className="flex items-center justify-center h-full w-full relative"
                      >
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

            {/* Steps list — left on desktop */}
            <div className="flex flex-col lg:-order-1 w-full lg:basis-1/2">
              {[
                { num: 1, title: 'Tell Us About Your Wedding',       desc: 'Share your date, city, guest count, budget, and wedding style. It takes under 2 minutes.' },
                { num: 2, title: 'Get Personalized Recommendations', desc: 'We curate venues, vendors, and packages tailored specifically to your preferences and budget.' },
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
                    {/* Number circle */}
                    <div
                      className={`absolute left-0 top-0 z-10 flex h-7 w-7 lg:h-9 lg:w-9 items-center justify-center rounded-full text-xs lg:text-base font-bold transition-all duration-300 ${
                        isActive ? 'bg-[#8B1A4A] text-white' : 'bg-gray-200 text-gray-400'
                      }`}
                      style={{ transform: 'translateX(-50%)' }}
                    >
                      {step.num}
                    </div>
                    {/* Pulse ring */}
                    {isActive && (
                      <motion.div
                        className="absolute left-0 top-0 h-7 w-7 lg:h-9 lg:w-9 rounded-full bg-[#8B1A4A]/30 z-0"
                        style={{ transform: 'translateX(-50%)' }}
                        animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ repeat: Infinity, duration: 1.8 }}
                      />
                    )}
                    {/* Step title */}
                    <p
                      className={`font-[Playfair_Display,serif] leading-tight transition-all duration-300 ${
                        isActive
                          ? 'text-xl sm:text-2xl lg:text-[38px] lg:leading-[1.1] font-semibold text-gray-900'
                          : 'text-sm lg:text-xl font-semibold text-gray-400'
                      }`}
                    >
                      {step.title}
                    </p>
                    {/* Step description */}
                    <p
                      className={`text-gray-500 text-sm lg:text-base lg:w-3/4 leading-relaxed transition-all duration-300 overflow-hidden ${
                        isActive ? 'max-h-24 opacity-100 mt-2' : 'max-h-0 opacity-0'
                      }`}
                    >
                      {step.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-12 lg:mt-16">
            <Link
              href="/plan"
              className="inline-block bg-[#8B1A4A] text-white font-semibold px-10 py-4 rounded-full hover:opacity-90 transition-all text-sm lg:text-base shadow-lg hover:shadow-xl"
            >
              Start my wedding planning
            </Link>
          </div>
        </div>
      </section>

      {/* ── GROUPED SERVICES ── */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-amber-600 text-sm font-semibold uppercase tracking-wider mb-2">Everything In One Place</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 font-[Playfair_Display,serif]">
              Complete Wedding Services,<br/><span className="gradient-text">Curated For You</span>
            </h2>
            <p className="text-gray-500 mt-3 text-sm max-w-xl mx-auto">We don&apos;t just list vendors — we coordinate your entire wedding across every service category.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {[
              { icon: '📋', label: 'Planning & Coordination', color: 'from-violet-50 to-violet-100 border-violet-200', text: 'text-violet-700', items: ['Wedding Planning', 'Hospitality', 'Legal Documentation'] },
              { icon: '🏛️', label: 'Venue & Experience', color: 'from-blue-50 to-blue-100 border-blue-200', text: 'text-blue-700', items: ['Wedding Venues', 'Accommodation', 'Transportation'] },
              { icon: '🍽️', label: 'Food & Entertainment', color: 'from-orange-50 to-orange-100 border-orange-200', text: 'text-orange-700', items: ['Catering', 'DJ', 'Band & Music'] },
              { icon: '💄', label: 'Beauty & Fashion', color: 'from-pink-50 to-pink-100 border-pink-200', text: 'text-pink-700', items: ['Makeup Artists', 'Bridal Lehenga', 'Jewellery', 'Sherwani'] },
              { icon: '📸', label: 'Decor & Media', color: 'from-teal-50 to-teal-100 border-teal-200', text: 'text-teal-700', items: ['Photography', 'Decorators', 'Invitations'] },
            ].map((group) => (
              <motion.div
                key={group.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className={`bg-gradient-to-br ${group.color} border rounded-2xl p-5`}
              >
                <div className="text-3xl mb-3">{group.icon}</div>
                <p className={`font-bold text-sm mb-3 ${group.text}`}>{group.label}</p>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item} className="text-xs text-gray-600 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/plan" className="inline-flex items-center gap-2 bg-[#8B1A4A] text-white px-8 py-3.5 rounded-full font-semibold hover:opacity-90 transition-all text-sm shadow-lg">
              <Sparkles className="w-4 h-4" /> Start Planning — It&apos;s Free
            </Link>
          </div>
        </div>
      </section>

      {/* ── WHY SHAADISHOPPING ── */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-rose-50 to-amber-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-rose-500 text-sm font-semibold uppercase tracking-wider mb-2">Why Us</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 font-[Playfair_Display,serif]">
              Why Couples Choose <span className="gradient-text">ShaadiShopping</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {[
              { icon: '🤝', title: 'One Team Managing Everything', desc: 'A single dedicated team coordinates all your vendors, vendors visits, and logistics end-to-end.' },
              { icon: '🎯', title: 'Personalized Vendor Coordination', desc: 'We match vendors to your specific style, budget, and city — not just random listings.' },
              { icon: '💰', title: 'Planning Within Your Budget', desc: 'We build your entire wedding plan around your budget preferences, with no hidden surprises.' },
              { icon: '⭐', title: 'Expert Guidance Start to Finish', desc: 'Your consultant is available throughout the journey — from first call to your wedding day.' },
              { icon: '⚡', title: 'Technology + Human Coordination', desc: 'Smart onboarding tools combined with real human expertise for a seamless experience.' },
            ].map((point, i) => (
              <motion.div
                key={point.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-white/50 text-center"
              >
                <div className="text-4xl mb-3">{point.icon}</div>
                <p className="font-bold text-gray-900 text-sm mb-2 font-[Playfair_Display,serif]">{point.title}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{point.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-16 sm:py-20 bg-[#FFFAF5] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Real Weddings"
            eyebrowColor="text-rose-500"
            title={<>Trusted By Couples For <span className="gradient-text">Stress-Free Planning</span></>}
          />

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
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
                whileHover={{ y: -6, transition: { duration: 0.25 } }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-5 italic">&quot;{t.text}&quot;</p>
                <div className="flex items-center gap-3">
                  <div className="relative w-11 h-11 rounded-full overflow-hidden flex-shrink-0">
                    <Image src={t.image} alt={t.name} fill sizes="44px" className="object-cover" />
                  </div>
                  <div>
                    <p className="text-gray-900 font-semibold text-sm">{t.name}</p>
                    <p className="text-gray-400 text-xs">{t.city}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── REAL WEDDING EXPERIENCES ── */}
      <section className="py-16 sm:py-20 bg-[#FFFAF5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-[#8B1A4A] text-sm font-semibold uppercase tracking-wider mb-2">Real Weddings</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 font-[Playfair_Display,serif]">
              Weddings We&apos;ve <span className="gradient-text">Coordinated</span>
            </h2>
            <p className="text-gray-500 text-sm sm:text-base mt-3 max-w-xl mx-auto">Behind every beautiful wedding is months of expert coordination. Here&apos;s a glimpse into weddings we&apos;ve helped bring to life.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { label: 'Royal Palace Wedding', city: 'Jaipur', tag: 'Venue Setup', emoji: '🏰', bg: 'from-rose-100 to-amber-100' },
              { label: 'Garden Ceremony', city: 'Patna', tag: 'Decor & Floral', emoji: '🌸', bg: 'from-green-100 to-teal-100' },
              { label: 'Beachside Reception', city: 'Goa', tag: 'Coordination', emoji: '🏖️', bg: 'from-sky-100 to-blue-100' },
              { label: 'Grand Banquet', city: 'Delhi', tag: 'Catering', emoji: '🍽️', bg: 'from-amber-100 to-yellow-100' },
              { label: 'Intimate Mehendi', city: 'Mumbai', tag: 'Pre-Events', emoji: '🌿', bg: 'from-lime-100 to-green-100' },
              { label: 'Destination Wedding', city: 'Udaipur', tag: 'Full Coordination', emoji: '✈️', bg: 'from-purple-100 to-rose-100' },
              { label: 'Sangeet Night', city: 'Bangalore', tag: 'Entertainment', emoji: '🎵', bg: 'from-indigo-100 to-purple-100' },
              { label: 'Luxury 5-Star', city: 'Hyderabad', tag: 'Premium Planning', emoji: '👑', bg: 'from-rose-100 to-pink-100' },
            ].map((w) => (
              <div key={w.label} className={`rounded-2xl bg-gradient-to-br ${w.bg} p-6 flex flex-col items-center justify-center text-center aspect-square hover:scale-105 transition-transform cursor-pointer`}>
                <span className="text-4xl mb-3">{w.emoji}</span>
                <p className="font-semibold text-gray-900 text-sm leading-tight">{w.label}</p>
                <p className="text-xs text-gray-500 mt-1">{w.city}</p>
                <span className="mt-2 text-xs bg-white/70 text-gray-700 font-medium px-2 py-0.5 rounded-full">{w.tag}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">Real photos coming soon — our team is capturing the magic. ✨</p>
        </div>
      </section>

      {/* ── VENDORS BY CATEGORY ── */}
      <section className="py-10 bg-gray-50 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6 font-[Playfair_Display,serif]">
            Explore Vendors by Category
          </h2>
          <div className="space-y-4">
            {VENDOR_CATEGORIES.map((group) => (
              <div key={group.heading}>
                <h3 className="text-sm font-bold text-gray-900 mb-1">{group.heading}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {group.items.map((item, idx) => (
                    <span key={item.label}>
                      <Link href={item.href} className="hover:text-amber-600 transition-colors">
                        {item.label}
                      </Link>
                      {idx < group.items.length - 1 && <span className="mx-2 text-gray-400">·</span>}
                    </span>
                  ))}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VENDORS BY LOCATION ── */}
      <section className="py-14 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-gray-800 mb-8 font-[Playfair_Display,serif]">
            Wedding Vendors by Location
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
            {LOCATIONS.map((loc) => (
              <div key={loc.state}>
                <h3 className="text-sm font-bold text-rose-700 uppercase tracking-wide mb-2 border-b border-rose-100 pb-1.5">
                  {loc.state}
                </h3>
                <ul className="space-y-1">
                  {loc.cities.map((city) => (
                    <li key={city}>
                      <Link
                        href={`/categories/venue?city=${encodeURIComponent(city)}`}
                        className="text-sm text-gray-600 hover:text-rose-600 hover:pl-1 transition-all duration-150 block"
                      >
                        Wedding Venues {city}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT EXPERT ── */}
      <section className="py-10 bg-gradient-to-r from-amber-50 to-rose-50 border-t border-amber-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 font-[Playfair_Display,serif] mb-1">
              Contact a wedding expert for free
            </h3>
            <p className="text-sm text-gray-500">We&apos;d love to help you! Monday to Friday, from 10am to 7pm.</p>
          </div>
          <a
            href="tel:+917070486987"
            className="flex items-center gap-3 bg-[#8B1A4A] text-white font-semibold px-8 py-3.5 rounded-full hover:opacity-90 transition-all hover:shadow-lg text-sm flex-shrink-0"
          >
            <Phone className="w-4 h-4" />
            Call +91 70704 86987
          </a>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-20 sm:py-24 overflow-hidden">
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
            <motion.p variants={fadeUp} className="text-amber-300 text-sm font-semibold uppercase tracking-wider mb-4">
              Begin Your Journey
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-bold text-white mb-5 font-[Playfair_Display,serif]">
              Let&apos;s Start Planning<br/><span className="shimmer-text">Your Wedding</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-white/70 text-base mb-8">
              Join thousands of couples who planned their perfect wedding with ShaadiShopping&apos;s expert coordination and trusted vendors.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/plan"
                className="bg-[#8B1A4A] text-white font-bold px-8 py-4 rounded-full hover:opacity-90 transition-all hover:shadow-2xl text-sm"
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
              <Link
                href="/vendor-onboarding"
                className="flex items-center justify-center gap-2 bg-white text-gray-900 font-semibold px-8 py-4 rounded-full hover:bg-amber-50 transition-all text-sm"
              >
                <Users className="w-4 h-4" />
                Join as Vendor
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
