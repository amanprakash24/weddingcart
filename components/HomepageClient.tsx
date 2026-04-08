'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Star, ChevronLeft, ChevronRight, CheckCircle, Heart, Users, Award, ArrowRight, Sparkles, Phone } from 'lucide-react';
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

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1920&q=90',
  'https://images.unsplash.com/photo-1502635385003-ee1e6a1a742d?w=1920&q=90',
  'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1920&q=90',
  'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=1920&q=90',
];

const HOW_IT_WORKS = [
  {
    step: '01', icon: Search, title: 'Discover & Compare',
    desc: 'Browse hundreds of verified vendors across categories. Read reviews, compare packages, and shortlist your favourites.',
    color: 'from-amber-400 to-amber-600', bg: 'bg-amber-50',
  },
  {
    step: '02', icon: Heart, title: 'Build Your Plan',
    desc: 'Add vendors to your wedding plan, mix and match packages, and get a consolidated view of your entire wedding budget.',
    color: 'from-rose-400 to-rose-600', bg: 'bg-rose-50',
  },
  {
    step: '03', icon: CheckCircle, title: 'Book & Celebrate',
    desc: 'Our expert planners confirm bookings, coordinate with vendors, and ensure your special day is absolutely perfect.',
    color: 'from-emerald-400 to-emerald-600', bg: 'bg-emerald-50',
  },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function HomepageClient() {
  const [heroIdx, setHeroIdx] = useState(0);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [specialServices, setSpecialServices] = useState<Category[]>([]);
  const [featuredVendors, setFeaturedVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);
  const featuredCarouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % HERO_IMAGES.length), 5000);
    return () => clearInterval(t);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [catRes, specialRes, vendorRes] = await Promise.all([
        fetch('/api/categories?isSpecial=false'),
        fetch('/api/categories?isSpecial=true'),
        fetch('/api/vendors?limit=50'),
      ]);
      const [catData, specialData, vendorData] = await Promise.all([catRes.json(), specialRes.json(), vendorRes.json()]);

      if (catData.success) setCategories(catData.data);
      if (specialData.success) setSpecialServices(specialData.data);
      if (vendorData.success) {
        setVendors(vendorData.data);
        setFeaturedVendors(vendorData.data.filter((v: Vendor) => v.isFeatured).slice(0, 8));
      }
    } catch {
      // Use empty arrays if API fails
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const topVendors = [...vendors].sort((a, b) => b.rating - a.rating).slice(0, 12);

  const scrollCarousel = (dir: 'left' | 'right') => {
    if (!carouselRef.current) return;
    const el = carouselRef.current;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10;
    if (dir === 'right' && atEnd) {
      el.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      el.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
    }
  };

  const scrollFeatured = (dir: 'left' | 'right') => {
    if (!featuredCarouselRef.current) return;
    const el = featuredCarouselRef.current;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10;
    if (dir === 'right' && atEnd) {
      el.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      el.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
    }
  };

  // Auto-scroll both carousels every 3s (featured offset by 1.5s)
  useEffect(() => {
    if (loading) return;
    const id1 = setInterval(() => scrollCarousel('right'), 3000);
    const id2 = setTimeout(() => {
      const id = setInterval(() => scrollFeatured('right'), 3000);
      return () => clearInterval(id);
    }, 1500);
    return () => { clearInterval(id1); clearTimeout(id2); };
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      {/* ── HERO ── */}
      <section className="relative h-screen min-h-[600px] max-h-[900px] flex items-center overflow-hidden">
        {/* Background images */}
        <AnimatePresence mode="sync">
          {HERO_IMAGES.map((src, i) =>
            i === heroIdx ? (
              <motion.div
                key={src}
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2 }}
              >
                <Image src={src} alt="Wedding" fill priority={i === 0} sizes="100vw" className="object-cover" />
              </motion.div>
            ) : null
          )}
        </AnimatePresence>

        <div className="absolute inset-0 hero-overlay pointer-events-none" />

        {/* Floating petals */}
        <FloatingPetals />

        {/* Hero dots */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {HERO_IMAGES.map((_, i) => (
            <button
              key={i}
              onClick={() => setHeroIdx(i)}
              className={`transition-all duration-300 rounded-full ${i === heroIdx ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/50'}`}
            />
          ))}
        </div>

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
              Plan Your{' '}
              <span className="shimmer-text">Dream Wedding</span>
              <br />with Ease
            </motion.h1>

            {/* Subtitle */}
            <motion.p variants={fadeUp} className="text-white/80 text-lg sm:text-xl mb-8 max-w-xl">
              Discover and book top-rated venues, photographers, caterers, makeup artists and more — all in one place.
            </motion.p>

            {/* CTA */}
            <motion.div variants={fadeUp}>
              <Link
                href="/plan"
                className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-500 to-rose-500 text-white px-8 py-4 rounded-2xl font-semibold text-lg shadow-2xl hover:opacity-90 hover:scale-105 transition-all"
              >
                <Sparkles className="w-5 h-5" />
                Plan Your Wedding
                <ArrowRight className="w-5 h-5" />
              </Link>
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

      {/* ── CATEGORIES ── */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Browse by Category"
            title={<>Everything You Need for Your{' '}<span className="gradient-text">Special Day</span></>}
          />

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton aspect-[4/5] rounded-2xl" />
              ))}
            </div>
          ) : (
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-50px' }}
              variants={stagger(0.07)}
            >
              {categories.map((cat) => (
                <motion.div key={cat.id} variants={scaleUp}>
                  <CategoryCard category={cat} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* ── SPECIAL / ON-DEMAND SERVICES ── */}
      {(loading || specialServices.length > 0) && (
        <section className="py-16 sm:py-20 bg-gradient-to-br from-rose-50 to-amber-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="On-Demand"
              eyebrowColor="text-rose-500"
              title={<>Special Services <span className="gradient-text">Offered by Us</span></>}
              subtitle="Additional services we arrange exclusively for your wedding — just tell us what you need"
            />

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton h-36 rounded-2xl" />
                ))}
              </div>
            ) : (
              <motion.div
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-50px' }}
                variants={stagger(0.08)}
              >
                {specialServices.map((svc) => (
                  <motion.div key={svc.id} variants={scaleUp}>
                    <Link
                      href={`/categories/${svc.id}`}
                      className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-amber-300 transition-all overflow-hidden flex flex-col h-full"
                    >
                      {svc.image && (
                        <div className="relative h-28 w-full overflow-hidden">
                          <Image src={svc.image} alt={svc.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" unoptimized />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                          <span className="absolute bottom-2 left-3 text-2xl">{svc.icon}</span>
                        </div>
                      )}
                      <div className="p-4 flex flex-col gap-2 flex-1">
                        {!svc.image && (
                          <div className="w-11 h-11 bg-amber-50 group-hover:bg-amber-100 rounded-xl flex items-center justify-center text-2xl transition-colors mb-1">
                            {svc.icon}
                          </div>
                        )}
                        <p className="font-bold text-gray-900 text-sm leading-tight group-hover:text-amber-600 transition-colors">{svc.name}</p>
                        <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">{svc.description}</p>
                        <div className="mt-auto flex items-center gap-1 text-amber-600 text-xs font-semibold pt-1">
                          View Vendors <ArrowRight className="w-3 h-3" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            )}

            <motion.div
              className="text-center mt-10"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={fadeUp}
            >
              <Link
                href="/plan"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white px-8 py-3.5 rounded-full font-semibold hover:opacity-90 transition-all hover:shadow-lg text-sm"
              >
                <Sparkles className="w-4 h-4" /> Start Planning Your Wedding
              </Link>
            </motion.div>
          </div>
        </section>
      )}

      {/* ── TOP-RATED VENDORS CAROUSEL ── */}
      <section className="py-16 sm:py-20 bg-[#FFFAF5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <motion.div
            className="mb-8"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
          >
            <p className="text-rose-500 text-sm font-semibold uppercase tracking-wider mb-2">Top Picks</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 font-[Playfair_Display,serif]">Top-Rated Vendors</h2>
            <p className="text-gray-500 mt-2 text-sm">Handpicked vendors loved by thousands of couples</p>
          </motion.div>

          {/* Carousel */}
          {loading ? (
            <div className="flex gap-5 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-80 rounded-2xl flex-none w-full sm:w-[300px]" />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6 }}
            >
              <div
                ref={carouselRef}
                className="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory snap-always scrollbar-hide pb-2 sm:-mx-4 sm:px-4"
              >
                {topVendors.map((vendor) => (
                  <div key={vendor.id} className="snap-start flex-none w-full sm:w-[300px]">
                    <VendorCard vendor={vendor} />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Carousel controls */}
          <div className="flex items-center justify-center gap-3 mt-6 mb-8">
            <button
              onClick={() => scrollCarousel('left')}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scrollCarousel('right')}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <motion.div
            className="text-center"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <Link
              href="/categories/venue"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white px-8 py-3.5 rounded-full font-semibold hover:opacity-90 transition-all hover:shadow-lg text-sm"
            >
              View All Vendors <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── FEATURED (Editors' Choice) ── */}
      {featuredVendors.length > 0 && (
        <section className="py-16 sm:py-20 bg-gradient-to-br from-amber-50 to-rose-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="Featured"
              title={<>Our <span className="gradient-text">Editors&apos; Choice</span></>}
              subtitle="Exceptional vendors with consistently outstanding reviews"
            />

            {/* Carousel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6 }}
            >
              <div
                ref={featuredCarouselRef}
                className="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory snap-always scrollbar-hide pb-2 sm:-mx-4 sm:px-4"
              >
                {featuredVendors.map((v) => (
                  <div key={v.id} className="snap-start flex-none w-full sm:w-[300px] relative pt-3">
                    <div className="absolute top-0 left-4 z-10 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1">
                      <Star className="w-3 h-3 fill-current" /> Editor&apos;s Choice
                    </div>
                    <VendorCard vendor={v} />
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => scrollFeatured('left')}
                className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => scrollFeatured('right')}
                className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── HOW IT WORKS ── */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Simple Process"
            eyebrowColor="text-emerald-600"
            title={<>How WeddingCart <span className="gradient-text">Works</span></>}
            subtitle="From discovery to your dream day — we handle every detail so you can focus on celebrating."
          />

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8 relative"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger(0.2)}
          >
            {/* Connecting line */}
            <div className="hidden md:block absolute top-16 left-1/3 right-1/3 h-0.5 bg-gradient-to-r from-amber-300 via-rose-300 to-emerald-300 z-0" />

            {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc, color, bg }) => (
              <motion.div
                key={step}
                variants={fadeUp}
                className="relative text-center"
              >
                <motion.div
                  className={`relative inline-flex items-center justify-center w-24 h-24 rounded-3xl ${bg} mb-6 mx-auto`}
                  whileHover={{ scale: 1.08, rotate: 3 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white text-xs font-bold shadow-lg`}>
                    {step}
                  </div>
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </motion.div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 font-[Playfair_Display,serif]">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-16 sm:py-20 bg-[#FFFAF5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Couples Love Us"
            eyebrowColor="text-rose-500"
            title={<>Happy Couples, <span className="gradient-text">Perfect Weddings</span></>}
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
                text: 'WeddingCart made our wedding planning so effortless! We found our dream venue, photographer, and caterer all in one place. The vendors were professional and delivered beyond expectations.',
                image: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=200&q=80',
              },
              {
                name: 'Ananya & Vikram', city: 'Mumbai', rating: 5,
                text: 'Absolutely love WeddingCart! The comparison feature helped us find vendors within our budget. The planning wizard saved us weeks of research. Our wedding was a fairy tale!',
                image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=200&q=80',
              },
              {
                name: 'Sneha & Arjun', city: 'Jaipur', rating: 5,
                text: "From mehndi to photography, WeddingCart had the perfect vendors for our royal Rajasthani wedding. The team was helpful throughout. Couldn't have asked for a better experience!",
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
              Start Today — It&apos;s Free
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-bold text-white mb-5 font-[Playfair_Display,serif]">
              Ready to Plan Your{' '}
              <span className="shimmer-text">Dream Wedding?</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-white/70 text-base mb-8">
              Join 10,000+ couples who planned their perfect wedding with WeddingCart. Get expert guidance, compare vendors, and book with confidence.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/plan"
                className="bg-gradient-to-r from-amber-500 to-rose-500 text-white font-bold px-8 py-4 rounded-full hover:opacity-90 transition-all hover:shadow-2xl text-sm"
              >
                Start Planning — Free
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
    </div>
  );
}
