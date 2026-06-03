'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  Star, MapPin, Phone, CheckCircle, Share2, X,
  ArrowRight, ChevronLeft, ChevronRight, Sparkles,
  ShieldCheck, Award, MessageCircle, Calendar,
} from 'lucide-react';
import { Vendor, Package } from '@/types';

const CATEGORY_LABELS: Record<string, string> = {
  venue: 'Wedding Venue', makeup: 'Bridal Makeup Artist', mehndi: 'Mehndi Artist',
  decorator: 'Wedding Decorator', band: 'Wedding Band', dj: 'DJ Services',
  catering: 'Wedding Caterer', 'photo-video': 'Photographer & Videographer',
  accommodation: 'Accommodation', gifts: 'Gifts', invitations: 'Invitations',
  transport: 'Transport', legal: 'Legal Services', hospitality: 'Hospitality',
  planning: 'Wedding Planner', astro: 'Astrology', 'bridal-lehenga': 'Bridal Lehenga',
  'bridal-jewellery': 'Bridal Jewellery', sherwani: 'Sherwani', trousseau: 'Trousseau',
  sfx: 'SFX Effects', security: 'Security',
};

const fadeUp = {
  hidden: { opacity: 0, y: 36 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = (delay = 0.1) => ({
  hidden: {},
  show: { transition: { staggerChildren: delay, delayChildren: 0.1 } },
});

function EnquiryModal({ vendor, onClose }: { vendor: Vendor; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', phone: '', eventDate: '', guestCount: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const isValid = (p: string) => /^\d{10}$/.test(p.replace(/[\s\-\+\(\)]/g, ''));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid(form.phone)) { setError('Enter a valid 10-digit phone number.'); return; }
    setSubmitting(true); setError('');
    try {
      await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: vendor.id, vendorName: vendor.name,
          vendorCategory: vendor.category, city: vendor.city,
          eventType: 'wedding', source: 'portfolio',
          ...form,
        }),
      });
      setDone(true);
    } catch { setError('Something went wrong. Please call us directly.'); }
    finally { setSubmitting(false); }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="h-1.5 w-full" style={{ background: 'linear-gradient(to right, #8B1A4A, #C5A46D)' }} />
        <div className="p-6 sm:p-8">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>

          {done ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'var(--font-playfair, serif)' }}>Enquiry Sent!</h3>
              <p className="text-gray-500 text-sm mb-6">We&apos;ll connect you with {vendor.name} within 30 minutes.</p>
              <button onClick={onClose} className="bg-[#8B1A4A] text-white font-semibold px-6 py-3 rounded-full text-sm hover:opacity-90 transition-all">
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <p className="text-[#C5A46D] text-[0.6rem] font-bold uppercase tracking-[0.2em] mb-1">Send Enquiry</p>
                <h3 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-playfair, serif)' }}>{vendor.name}</h3>
                <p className="text-gray-400 text-xs mt-0.5">{CATEGORY_LABELS[vendor.category]} · {vendor.city}</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <input required placeholder="Your Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A4A]/20 focus:border-[#8B1A4A]" />
                <input required type="tel" placeholder="Phone Number * (10 digits)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A4A]/20 focus:border-[#8B1A4A]" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#8B1A4A]/20 focus:border-[#8B1A4A]" />
                  <select value={form.guestCount} onChange={(e) => setForm({ ...form, guestCount: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#8B1A4A]/20 focus:border-[#8B1A4A] bg-white">
                    <option value="">Guests</option>
                    {['50-100','100-200','200-350','350-500','500+'].map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <textarea rows={2} placeholder="Message (optional)" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A4A]/20 focus:border-[#8B1A4A] resize-none" />
                {error && <p className="text-rose-500 text-xs">{error}</p>}
                <button type="submit" disabled={submitting}
                  className="w-full bg-[#8B1A4A] text-white font-bold py-3.5 rounded-xl text-sm hover:opacity-90 disabled:opacity-60 transition-all"
                  style={{ boxShadow: '0 4px 20px rgba(139,26,74,0.35)' }}>
                  {submitting ? 'Sending...' : 'Send Enquiry'}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function VendorPortfolioClient({ id }: { id: string }) {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [showEnquiry, setShowEnquiry] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activePackage, setActivePackage] = useState<string | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  useEffect(() => {
    fetch(`/api/vendors/${id}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setVendor(d.data); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: vendor?.name, url });
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const gallery = vendor ? [vendor.image, ...(vendor.images?.filter((i) => i && i !== vendor.image) ?? [])].filter(Boolean) : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFAF5]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-[#C5A46D] border-t-transparent animate-spin" />
          <p className="text-gray-400 text-sm">Loading portfolio…</p>
        </div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFFAF5] gap-4">
        <p className="text-2xl font-bold text-gray-800" style={{ fontFamily: 'var(--font-playfair, serif)' }}>Portfolio not found</p>
        <Link href="/" className="text-[#8B1A4A] text-sm font-semibold hover:underline">← Back to ShaadiShopping</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFAF5] overflow-x-hidden">

      {/* ── HERO ── */}
      <section ref={heroRef} className="relative h-[92vh] min-h-[560px] flex items-end overflow-hidden">
        <motion.div className="absolute inset-0" style={{ scale: heroScale }}>
          <Image src={gallery[0] || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1600&q=85'}
            alt={vendor.name} fill className="object-cover" priority sizes="100vw" />
        </motion.div>

        {/* Gradient overlays */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(15,6,3,0.95) 0%, rgba(15,6,3,0.4) 50%, rgba(15,6,3,0.1) 100%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at bottom left, rgba(139,26,74,0.25) 0%, transparent 60%)' }} />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 sm:px-8 py-5">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center group-hover:bg-white/20 transition-all">
              <ChevronLeft className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-white/70 text-xs font-medium hidden sm:block">ShaadiShopping</span>
          </Link>
          <button onClick={handleShare}
            className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-white/20 transition-all">
            <Share2 className="w-3.5 h-3.5" />
            {copied ? 'Copied!' : 'Share Portfolio'}
          </button>
        </div>

        {/* Hero content */}
        <motion.div
          className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 pb-12 sm:pb-16"
          style={{ opacity: heroOpacity }}
        >
          <motion.div initial="hidden" animate="show" variants={stagger(0.12)}>

            {/* Category + City */}
            <motion.div variants={fadeUp} className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="flex items-center gap-1.5 bg-[#C5A46D]/15 border border-[#C5A46D]/30 text-[#C5A46D] text-[0.6rem] font-bold uppercase tracking-[0.18em] px-3 py-1.5 rounded-full">
                <Sparkles className="w-3 h-3" /> {CATEGORY_LABELS[vendor.category] ?? vendor.category}
              </span>
              <span className="flex items-center gap-1.5 bg-white/8 border border-white/15 text-white/70 text-[0.6rem] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full">
                <MapPin className="w-3 h-3" /> {vendor.city}
              </span>
              {vendor.isFeatured && (
                <span className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[0.6rem] font-bold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full">
                  <Award className="w-3 h-3" /> Featured
                </span>
              )}
            </motion.div>

            {/* Name */}
            <motion.h1 variants={fadeUp}
              className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4 max-w-3xl"
              style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              {vendor.name}
            </motion.h1>

            {/* Rating + Price */}
            <motion.div variants={fadeUp} className="flex items-center gap-5 mb-8 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1,2,3,4,5].map((s) => (
                    <Star key={s} className={`w-4 h-4 ${s <= Math.round(vendor.rating) ? 'fill-[#C5A46D] text-[#C5A46D]' : 'fill-white/20 text-white/20'}`} />
                  ))}
                </div>
                <span className="text-white font-bold text-sm">{vendor.rating}</span>
                {vendor.reviewCount > 0 && <span className="text-white/50 text-xs">({vendor.reviewCount} reviews)</span>}
              </div>
              <div className="h-4 w-px bg-white/20" />
              <span className="text-white/70 text-sm">
                Starting from <span className="text-[#C5A46D] font-bold text-base">₹{vendor.priceMin.toLocaleString('en-IN')}</span>
              </span>
            </motion.div>

            {/* CTAs */}
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setShowEnquiry(true)}
                className="inline-flex items-center justify-center gap-2 bg-[#8B1A4A] text-white font-bold px-8 py-4 rounded-full text-sm hover:opacity-90 transition-all"
                style={{ boxShadow: '0 8px 32px rgba(139,26,74,0.5)' }}>
                Send Enquiry <ArrowRight className="w-4 h-4" />
              </button>
              {vendor.ownerPhone && (
                <a href={`tel:${vendor.ownerPhone}`}
                  className="inline-flex items-center justify-center gap-2 bg-white/8 backdrop-blur-sm border border-white/20 text-white font-semibold px-7 py-4 rounded-full text-sm hover:bg-white/15 transition-all">
                  <Phone className="w-4 h-4" /> Call Now
                </a>
              )}
            </motion.div>

          </motion.div>
        </motion.div>
      </section>

      {/* ── VERIFIED BADGE STRIP ── */}
      <div className="bg-[#2A1F1B] py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-center gap-3 flex-wrap">
          <ShieldCheck className="w-4 h-4 text-[#C5A46D]" />
          <p className="text-[#C5A46D]/80 text-xs font-semibold tracking-[0.12em] uppercase">
            Verified & Listed on ShaadiShopping
          </p>
          <div className="hidden sm:block h-3 w-px bg-[#C5A46D]/20" />
          <p className="text-gray-500 text-xs">India&apos;s Trusted Wedding Platform</p>
        </div>
      </div>

      {/* ── ABOUT ── */}
      <section className="py-16 sm:py-24 bg-[#FFFAF5]">
        <div className="max-w-4xl mx-auto px-4 sm:px-8">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} variants={stagger(0.12)}>
            <motion.p variants={fadeUp} className="text-[#C5A46D] text-[0.6rem] font-bold uppercase tracking-[0.22em] mb-3">About</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6 leading-tight"
              style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              About {vendor.name}
            </motion.h2>
            <motion.div variants={fadeUp} className="w-12 h-0.5 mb-6" style={{ background: 'linear-gradient(to right, #C5A46D, transparent)' }} />
            <motion.p variants={fadeUp} className="text-gray-600 text-base sm:text-lg leading-relaxed font-cormorant">
              {vendor.description}
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ── GALLERY ── */}
      {gallery.length > 0 && (
        <section className="py-16 sm:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-8">
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} variants={stagger(0.1)}
              className="text-center mb-10">
              <motion.p variants={fadeUp} className="text-[#C5A46D] text-[0.6rem] font-bold uppercase tracking-[0.22em] mb-3">Gallery</motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-gray-900"
                style={{ fontFamily: 'var(--font-playfair, serif)' }}>Our Work</motion.h2>
            </motion.div>

            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
              initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }} variants={stagger(0.07)}
            >
              {gallery.slice(0, 8).map((img, i) => (
                <motion.div key={i} variants={fadeUp}
                  className={`relative overflow-hidden rounded-2xl cursor-pointer group ${i === 0 ? 'col-span-2 row-span-2 min-h-[280px]' : 'min-h-[130px]'}`}
                  onClick={() => setLightbox(i)}
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Image src={img} alt={`${vendor.name} ${i + 1}`} fill className="object-cover group-hover:scale-110 transition-transform duration-700" sizes="(max-width: 640px) 50vw, 25vw" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* ── FEATURES ── */}
      {vendor.features?.length > 0 && (
        <section className="py-16 sm:py-20 bg-[#F8F5EF]">
          <div className="max-w-5xl mx-auto px-4 sm:px-8">
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} variants={stagger(0.1)}>
              <motion.p variants={fadeUp} className="text-[#C5A46D] text-[0.6rem] font-bold uppercase tracking-[0.22em] mb-3 text-center">What We Offer</motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-10"
                style={{ fontFamily: 'var(--font-playfair, serif)' }}>Features & Amenities</motion.h2>
              <motion.div variants={stagger(0.06)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {vendor.features.map((f, i) => (
                  <motion.div key={i} variants={fadeUp}
                    className="flex items-center gap-3 bg-white border border-[#C5A46D]/12 rounded-2xl px-5 py-4 hover:border-[#C5A46D]/35 hover:shadow-sm transition-all duration-300">
                    <div className="w-6 h-6 rounded-full bg-[#8B1A4A]/8 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-3.5 h-3.5 text-[#8B1A4A]" />
                    </div>
                    <span className="text-gray-700 text-sm font-medium">{f}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ── PACKAGES ── */}
      {vendor.packages?.length > 0 && (
        <section className="py-16 sm:py-24 bg-[#2A1F1B] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top right, rgba(139,26,74,0.18) 0%, transparent 60%)' }} />

          <div className="max-w-6xl mx-auto px-4 sm:px-8 relative z-10">
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} variants={stagger(0.12)}
              className="text-center mb-12">
              <motion.p variants={fadeUp} className="text-[#C5A46D] text-[0.6rem] font-bold uppercase tracking-[0.22em] mb-3">Pricing</motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-white"
                style={{ fontFamily: 'var(--font-playfair, serif)' }}>Packages & Pricing</motion.h2>
            </motion.div>

            <motion.div
              className={`grid gap-5 ${vendor.packages.length === 1 ? 'max-w-sm mx-auto' : vendor.packages.length === 2 ? 'sm:grid-cols-2 max-w-2xl mx-auto' : 'sm:grid-cols-2 lg:grid-cols-3'}`}
              initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }} variants={stagger(0.1)}
            >
              {vendor.packages.map((pkg: Package) => (
                <motion.div key={pkg.id} variants={fadeUp}
                  onClick={() => setActivePackage(activePackage === pkg.id ? null : pkg.id)}
                  className={`relative rounded-3xl p-6 cursor-pointer transition-all duration-400 border ${
                    pkg.isPopular
                      ? 'bg-[#8B1A4A] border-[#8B1A4A] shadow-2xl'
                      : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-[#C5A46D]/30'
                  }`}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  {pkg.isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-[#C5A46D] text-[#2A1F1B] text-[0.55rem] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full shadow">
                        Most Popular
                      </span>
                    </div>
                  )}

                  {pkg.image && (
                    <div className="relative w-full h-36 rounded-2xl overflow-hidden mb-5">
                      <Image src={pkg.image} alt={pkg.name} fill className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" />
                    </div>
                  )}

                  <h3 className={`text-lg font-bold mb-1 ${pkg.isPopular ? 'text-white' : 'text-white'}`}
                    style={{ fontFamily: 'var(--font-playfair, serif)' }}>{pkg.name}</h3>
                  {pkg.description && <p className={`text-xs mb-4 leading-relaxed ${pkg.isPopular ? 'text-white/75' : 'text-gray-400'}`}>{pkg.description}</p>}

                  <p className={`text-3xl font-light mb-5 ${pkg.isPopular ? 'text-white' : 'text-[#C5A46D]'}`}
                    style={{ fontFamily: 'var(--font-cormorant, serif)' }}>
                    ₹{pkg.price.toLocaleString('en-IN')}
                  </p>

                  <AnimatePresence>
                    {pkg.features?.length > 0 && (
                      <motion.ul className="space-y-2 mb-5"
                        initial={false}
                        animate={activePackage === pkg.id ? { height: 'auto', opacity: 1 } : { height: pkg.features.length <= 3 ? 'auto' : 'auto', opacity: 1 }}>
                        {pkg.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <CheckCircle className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${pkg.isPopular ? 'text-white/70' : 'text-[#C5A46D]'}`} />
                            <span className={`text-xs ${pkg.isPopular ? 'text-white/80' : 'text-gray-400'}`}>{f}</span>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>

                  <button onClick={(e) => { e.stopPropagation(); setShowEnquiry(true); }}
                    className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-[0.12em] transition-all ${
                      pkg.isPopular
                        ? 'bg-white text-[#8B1A4A] hover:bg-white/90'
                        : 'bg-[#C5A46D]/15 border border-[#C5A46D]/30 text-[#C5A46D] hover:bg-[#C5A46D]/25'
                    }`}>
                    Enquire About This Package
                  </button>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* ── CONTACT CTA ── */}
      <section className="py-16 sm:py-24 bg-[#FFFAF5]">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 text-center">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} variants={stagger(0.12)}>
            <motion.p variants={fadeUp} className="text-[#C5A46D] text-[0.6rem] font-bold uppercase tracking-[0.22em] mb-3">Get In Touch</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              Ready to Book {vendor.name}?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-gray-500 text-sm mb-8 max-w-md mx-auto leading-relaxed">
              Get in touch to check availability, discuss your requirements, and get a personalised quote.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => setShowEnquiry(true)}
                className="inline-flex items-center justify-center gap-2 bg-[#8B1A4A] text-white font-bold px-8 py-4 rounded-full text-sm hover:opacity-90 transition-all shadow-lg"
                style={{ boxShadow: '0 6px 28px rgba(139,26,74,0.4)' }}>
                <Calendar className="w-4 h-4" /> Send Enquiry
              </button>
              {vendor.ownerPhone && (
                <a href={`tel:${vendor.ownerPhone}`}
                  className="inline-flex items-center justify-center gap-2 border-2 border-[#C5A46D]/35 text-[#8B1A4A] font-bold px-8 py-4 rounded-full text-sm hover:bg-[#8B1A4A]/5 transition-all">
                  <Phone className="w-4 h-4" /> Call Directly
                </a>
              )}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── SHAADISHOPPING FOOTER ── */}
      <div className="bg-[#2A1F1B] py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#C5A46D]" />
            <span className="text-gray-400 text-xs">
              Listed & verified by <Link href="/" className="text-[#C5A46D] font-semibold hover:underline">ShaadiShopping</Link>
              {' '}— India&apos;s Wedding Platform
            </span>
          </div>
          <Link href={`/vendors/${vendor.id}`}
            className="text-xs text-[#C5A46D]/60 hover:text-[#C5A46D] transition-colors flex items-center gap-1">
            View on ShaadiShopping <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* ── LIGHTBOX ── */}
      <AnimatePresence>
        {lightbox !== null && (
          <motion.div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}>
            <button className="absolute top-4 right-4 text-white/60 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all">
              <X className="w-5 h-5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setLightbox((l) => l !== null && l > 0 ? l - 1 : gallery.length - 1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <motion.div className="relative w-full max-w-4xl aspect-video rounded-2xl overflow-hidden"
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}>
              <Image src={gallery[lightbox]} alt="" fill className="object-contain" sizes="90vw" />
            </motion.div>
            <button onClick={(e) => { e.stopPropagation(); setLightbox((l) => l !== null && l < gallery.length - 1 ? l + 1 : 0); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all">
              <ChevronRight className="w-6 h-6" />
            </button>
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs">{lightbox + 1} / {gallery.length}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ENQUIRY MODAL ── */}
      <AnimatePresence>
        {showEnquiry && vendor && (
          <EnquiryModal vendor={vendor} onClose={() => setShowEnquiry(false)} />
        )}
      </AnimatePresence>

      {/* ── STICKY MOBILE CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-white border-t border-gray-100 px-4 py-3 flex gap-3 shadow-2xl">
        <button onClick={() => setShowEnquiry(true)}
          className="flex-1 flex items-center justify-center gap-2 bg-[#8B1A4A] text-white font-bold py-3.5 rounded-xl text-sm"
          style={{ boxShadow: '0 4px 16px rgba(139,26,74,0.4)' }}>
          <MessageCircle className="w-4 h-4" /> Enquire Now
        </button>
        {vendor.ownerPhone && (
          <a href={`tel:${vendor.ownerPhone}`}
            className="flex items-center justify-center gap-1.5 border border-gray-200 text-gray-700 px-4 py-3.5 rounded-xl text-sm font-semibold">
            <Phone className="w-4 h-4" /> Call
          </a>
        )}
      </div>

    </div>
  );
}
