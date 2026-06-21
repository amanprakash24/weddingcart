'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Phone, CheckCircle, Star, MapPin, Users, Calendar,
  ArrowRight, ShieldCheck, Clock, Utensils, Home, ChevronDown,
} from 'lucide-react';

const REVIEWS = [
  {
    name: 'Priya Sharma',
    rating: 5,
    date: 'April 2025',
    text: 'Best banquet hall in Patna! We hosted our daughter\'s wedding at Touch of Cozy and the experience was perfect from start to finish. The food was delicious, hall was beautifully decorated, and the staff was extremely cooperative.',
  },
  {
    name: 'Rajesh Kumar',
    rating: 5,
    date: 'March 2025',
    text: 'Excellent banquet hall in Rajeev Nagar, Patna. Catering was top-notch with great variety. The 5 guest rooms were very comfortable for our outstation relatives. The venue manager handled everything professionally.',
  },
  {
    name: 'Sunita Verma',
    rating: 5,
    date: 'February 2025',
    text: 'We celebrated our engagement here and it was wonderful. Ambiance is elegant, parking was easy, and food quality was excellent. Best value banquet hall in Patliputra area — great hospitality all around.',
  },
];

const FAQS = [
  {
    q: 'Is Touch of Cozy the best banquet hall in Patna?',
    a: 'Touch of Cozy is one of the top-rated banquet halls in Patna, located in Mica Colony, Rajeev Nagar (Patliputra area). It offers a fully AC hall for 300+ guests, in-house catering from ₹999/plate, 5 guest rooms, valet parking, and is baraat-friendly — rated 5.0★ by 47+ couples.',
  },
  {
    q: 'What is the capacity of Touch of Cozy banquet hall?',
    a: 'Touch of Cozy can comfortably host 200–350 guests for a seated dinner and up to 400+ guests for cocktail-style receptions. Valet parking is available for 40–45 vehicles.',
  },
  {
    q: 'What is the catering price at Touch of Cozy Patna?',
    a: 'In-house catering packages start at ₹999/plate (Veg Gold), ₹1,199 (Veg Platinum), ₹1,351 (Veg Luxury), ₹1,199 (Non-Veg Gold), ₹1,399 (Non-Veg Platinum), and ₹1,599 (Non-Veg Luxury). All packages include hall access and decoration.',
  },
  {
    q: 'Does Touch of Cozy allow overnight weddings and baraat?',
    a: 'Yes. Touch of Cozy explicitly permits baraat processions and supports overnight weddings. The venue operates from 11 AM to 12 AM daily. Guest rooms are available for the bridal family overnight.',
  },
  {
    q: 'Where exactly is Touch of Cozy located in Patna?',
    a: 'Road No. 23, Near Atal Path Branch Road, Mica Colony, Rajeev Nagar, Patna – 800012. Easily accessible from Boring Road (10 min), Bailey Road, and the Patna bypass.',
  },
  {
    q: 'How do I book Touch of Cozy?',
    a: 'Fill the free quote form on this page or call +91 76460 28228. ShaadiShopping is the authorised booking partner — our service is completely free for couples.',
  },
];

const GALLERY_IMAGES = [
  { src: 'https://res.cloudinary.com/djaif7u83/image/upload/v1781971028/shaadishopping/touch-of-cozy/best-banquet-hall-touch-of-cozy.jpg', alt: 'Touch of Cozy — Best Banquet Hall in Patna' },
  { src: 'https://res.cloudinary.com/djaif7u83/image/upload/v1782033876/shaadishopping/touch-of-cozy/touch-of-cozy-venue.jpg', alt: 'Touch of Cozy Banquet Hall & Café — Rajeev Nagar Patna' },
  { src: 'https://res.cloudinary.com/djaif7u83/image/upload/v1782033878/shaadishopping/touch-of-cozy/best-banquet-hall-patna.jpg', alt: 'Best Banquet Hall in Patna — Touch of Cozy' },
  { src: 'https://res.cloudinary.com/djaif7u83/image/upload/v1782033876/shaadishopping/touch-of-cozy/touch-of-cozy-hall.jpg', alt: 'Touch of Cozy Hall Interior — Wedding Venue Patna' },
  { src: 'https://res.cloudinary.com/djaif7u83/image/upload/v1782033877/shaadishopping/touch-of-cozy/touch-of-cozy-2.jpg', alt: 'Touch of Cozy Banquet Hall — Mica Colony Patna' },
  { src: 'https://res.cloudinary.com/djaif7u83/image/upload/v1782033874/shaadishopping/touch-of-cozy/touch-of-cozy-1.jpg', alt: 'Touch of Cozy Wedding Hall — Patliputra Patna' },
  { src: 'https://res.cloudinary.com/djaif7u83/image/upload/v1781971030/shaadishopping/touch-of-cozy/touch-of-cozy-patna.jpg', alt: 'Touch of Cozy — Wedding & Reception Venue Patna' },
];

const FEATURES = [
  'Fully Air-Conditioned Banquet Hall',
  '5 Complimentary Guest Rooms with Events',
  'In-House Catering (Veg & Non-Veg)',
  'In-House Decoration',
  'LED Counter (Platinum & Luxury)',
  'Valet Parking — 40–45 Vehicles',
  'Café Services',
  'Baraat Permitted',
  'Overnight Weddings Allowed',
  'FSSAI Certified Kitchen',
  'GST Registered',
  'Operating Hours: 11 AM – 12 AM',
  'Dedicated Event Coordinator',
];

const BADGES = [
  { icon: Users, label: 'Large Gatherings' },
  { icon: Home, label: '5 Guest Rooms' },
  { icon: Utensils, label: 'In-House Catering' },
  { icon: Clock, label: 'Quick Response' },
];

const PACKAGES = [
  {
    id: 'veg-gold',
    name: 'Veg Gold',
    price: 999,
    isPopular: false,
    tag: 'Vegetarian',
    highlights: ['₹999 per plate', 'Without LED Counter', '2 Starters', 'Banquet Hall Access'],
  },
  {
    id: 'veg-platinum',
    name: 'Veg Platinum',
    price: 1199,
    isPopular: false,
    tag: 'Vegetarian',
    highlights: ['₹1,199 per plate', 'With LED Counter', '3 Starters', 'Welcome Drink'],
  },
  {
    id: 'veg-luxury',
    name: 'Veg Luxury',
    price: 1351,
    isPopular: true,
    tag: 'Vegetarian',
    highlights: ['₹1,351 per plate', 'With LED Counter', '4 Starters + Mocktails', 'Tawa Garden'],
  },
  {
    id: 'non-veg-gold',
    name: 'Non-Veg Gold',
    price: 1199,
    isPopular: false,
    tag: 'Non-Vegetarian',
    highlights: ['₹1,199 per plate', 'Without LED Counter', 'Chicken + Fish', 'Banquet Hall Access'],
  },
  {
    id: 'non-veg-platinum',
    name: 'Non-Veg Platinum',
    price: 1399,
    isPopular: false,
    tag: 'Non-Vegetarian',
    highlights: ['₹1,399 per plate', 'With LED Counter', '4 Starters', 'Salad Bar'],
  },
  {
    id: 'non-veg-luxury',
    name: 'Non-Veg Luxury',
    price: 1599,
    isPopular: false,
    tag: 'Non-Vegetarian',
    highlights: ['₹1,599 per plate', 'With LED Counter', 'Chicken + Mutton + Fish', 'Tawa Garden'],
  },
];

export default function TouchOfCozyClient() {
  const [form, setForm] = useState({
    name: '', phone: '', eventDate: '', guestCount: '', message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const isValidPhone = (v: string) => /^\d{10}$/.test(v.replace(/[\s\-\+\(\)]/g, ''));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isValidPhone(form.phone)) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    setSubmitting(true);
    try {
      await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: 'touch-of-cozy-patna',
          vendorName: 'Touch of Cozy',
          vendorCategory: 'venue',
          name: form.name,
          phone: form.phone,
          city: 'Patna',
          eventDate: form.eventDate,
          guestCount: form.guestCount,
          eventType: 'wedding',
          message: form.message || 'Enquiry from landing page',
          source: 'lp-touch-of-cozy',
        }),
      });
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please call us directly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFAF5]">

      {/* ── HERO ── */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1600&q=85"
            alt="Touch of Cozy — Banquet Hall & Wedding Venue in Patna"
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(120deg, rgba(20,8,4,0.90) 0%, rgba(20,8,4,0.55) 55%, rgba(20,8,4,0.82) 100%)' }}
          />
        </div>

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 sm:px-8 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-white font-bold text-lg" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              ShaadiShopping
            </span>
          </Link>
          <a
            href="tel:+917986519662"
            className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-white/20 transition-all"
          >
            <Phone className="w-3.5 h-3.5" /> +91 79865 19662
          </a>
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
          <div className="grid lg:grid-cols-2 gap-10 items-center">

            {/* Left — copy */}
            <div>
              <div className="inline-flex items-center gap-2 bg-[#C5A46D]/15 border border-[#C5A46D]/30 text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.18em] px-3 py-1.5 rounded-full mb-5">
                <MapPin className="w-3 h-3" /> Mica Colony, Patna · Verified Venue
              </div>

              <h1
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4"
                style={{ fontFamily: 'var(--font-playfair, serif)' }}
              >
                Touch of Cozy<br />
                <span
                  style={{
                    background: 'linear-gradient(135deg, #e8d5b0, #C5A46D)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Banquet &amp; Café
                </span>
              </h1>

              <p className="text-white/70 text-base sm:text-lg leading-relaxed mb-6 max-w-lg">
                Patna&apos;s premier banquet hall, café &amp; guest stay — where elegance meets comfort. Weddings, receptions, engagements, birthdays &amp; corporate events with personalized care.
              </p>

              {/* Rating */}
              <div className="flex items-center gap-3 mb-7">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="w-4 h-4 fill-[#C5A46D] text-[#C5A46D]" />
                  ))}
                </div>
                <span className="text-white/60 text-sm">5.0 · Top-Rated Venue in Patna</span>
              </div>

              {/* Badges */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                {BADGES.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2.5 bg-white/6 backdrop-blur-sm border border-white/10 rounded-xl px-3.5 py-2.5"
                  >
                    <Icon className="w-4 h-4 text-[#C5A46D] flex-shrink-0" />
                    <span className="text-white/80 text-xs font-medium">{label}</span>
                  </div>
                ))}
              </div>

              {/* Mobile CTA */}
              <a
                href="#enquiry-form"
                className="lg:hidden inline-flex items-center gap-2 bg-[#8B1A4A] text-white font-bold px-8 py-4 rounded-full text-sm shadow-xl hover:opacity-90 transition-all"
                style={{ boxShadow: '0 8px 32px rgba(139,26,74,0.5)' }}
              >
                Get Free Quote <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            {/* Right — lead form */}
            <div id="enquiry-form" className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8">
              {submitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                  <h3
                    className="text-xl font-bold text-gray-900 mb-2"
                    style={{ fontFamily: 'var(--font-playfair, serif)' }}
                  >
                    Enquiry Received!
                  </h3>
                  <p className="text-gray-500 text-sm mb-6">
                    Our team will call you within 30 minutes to confirm availability and pricing.
                  </p>
                  <a
                    href="tel:+917986519662"
                    className="inline-flex items-center gap-2 bg-[#8B1A4A] text-white font-semibold px-6 py-3 rounded-full text-sm hover:opacity-90 transition-all"
                  >
                    <Phone className="w-4 h-4" /> Call Us Now
                  </a>
                </div>
              ) : (
                <>
                  <div className="mb-5">
                    <h2
                      className="text-xl font-bold text-gray-900"
                      style={{ fontFamily: 'var(--font-playfair, serif)' }}
                    >
                      Get Free Quote
                    </h2>
                    <p className="text-gray-400 text-xs mt-1">We&apos;ll call you back within 30 minutes</p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-3.5">
                    <input
                      required
                      type="text"
                      placeholder="Your Name *"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A4A]/20 focus:border-[#8B1A4A] transition-colors"
                    />
                    <input
                      required
                      type="tel"
                      placeholder="Phone Number * (10 digits)"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A4A]/20 focus:border-[#8B1A4A] transition-colors"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="date"
                        value={form.eventDate}
                        onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#8B1A4A]/20 focus:border-[#8B1A4A] transition-colors"
                      />
                      <select
                        value={form.guestCount}
                        onChange={(e) => setForm({ ...form, guestCount: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#8B1A4A]/20 focus:border-[#8B1A4A] transition-colors bg-white"
                      >
                        <option value="">Guests</option>
                        <option value="50-100">50–100</option>
                        <option value="100-200">100–200</option>
                        <option value="200-350">200–350</option>
                        <option value="350-500">350–500</option>
                        <option value="500+">500+</option>
                      </select>
                    </div>
                    <textarea
                      rows={2}
                      placeholder="Any specific requirements? (optional)"
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A4A]/20 focus:border-[#8B1A4A] transition-colors resize-none"
                    />

                    {error && <p className="text-rose-500 text-xs">{error}</p>}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-[#8B1A4A] text-white font-bold py-4 rounded-xl text-sm hover:opacity-90 disabled:opacity-60 transition-all"
                      style={{ boxShadow: '0 4px 20px rgba(139,26,74,0.4)' }}
                    >
                      {submitting ? 'Sending...' : 'Get Free Quote & Availability'}
                    </button>

                    <div className="flex items-center justify-center gap-1.5 pt-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-gray-300" />
                      <p className="text-[10px] text-gray-400 text-center">
                        Your details are safe. No spam, ever.
                      </p>
                    </div>
                  </form>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-center gap-2">
                    <span className="text-xs text-gray-400">Or call directly:</span>
                    <a href="tel:+917986519662" className="text-xs font-bold text-[#8B1A4A] hover:underline">
                      +91 79865 19662
                    </a>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="bg-white py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-2">What&apos;s Included</p>
            <h2
              className="text-2xl sm:text-3xl font-bold text-gray-900"
              style={{ fontFamily: 'var(--font-playfair, serif)' }}
            >
              Everything for Your Perfect Celebration
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f}
                className="flex items-start gap-3 bg-[#FFFAF5] border border-[#C5A46D]/15 rounded-2xl px-4 py-4"
              >
                <CheckCircle className="w-4 h-4 text-[#C5A46D] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700 font-medium leading-snug">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PHOTO GALLERY ── */}
      <section className="bg-[#FFFAF5] py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-2">Photo Gallery</p>
            <h2
              className="text-2xl sm:text-3xl font-bold text-gray-900"
              style={{ fontFamily: 'var(--font-playfair, serif)' }}
            >
              See the Venue for Yourself
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {GALLERY_IMAGES.map((img, i) => (
              <div
                key={img.src}
                className={`relative rounded-2xl overflow-hidden shadow-md border border-[#C5A46D]/15 ${i === 0 ? 'col-span-2 row-span-2 aspect-[4/3]' : 'aspect-square'}`}
              >
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  className="object-cover hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP ── */}
      <section className="bg-[#2A1F1B] py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { value: '300+', label: 'Events Hosted' },
              { value: '5.0★', label: 'Customer Rating' },
              { value: '11AM–12AM', label: 'Daily Operations' },
            ].map(({ value, label }) => (
              <div key={label}>
                <p
                  className="text-2xl sm:text-4xl font-light text-[#C5A46D]"
                  style={{ fontFamily: 'var(--font-cormorant, serif)' }}
                >
                  {value}
                </p>
                <p className="text-gray-500 text-[0.65rem] uppercase tracking-[0.15em] mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PACKAGES ── */}
      <section className="bg-[#FFFAF5] py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-2">Catering Packages</p>
            <h2
              className="text-2xl sm:text-3xl font-bold text-gray-900"
              style={{ fontFamily: 'var(--font-playfair, serif)' }}
            >
              Packages Starting at ₹999 Per Plate
            </h2>
            <p className="text-gray-500 text-sm mt-2">All packages include banquet hall, décor &amp; in-house catering</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PACKAGES.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative rounded-2xl border p-5 bg-white ${
                  pkg.isPopular
                    ? 'border-[#8B1A4A] shadow-lg shadow-[#8B1A4A]/10'
                    : 'border-[#C5A46D]/20'
                }`}
              >
                {pkg.isPopular && (
                  <div className="absolute -top-3 left-5">
                    <span className="bg-[#8B1A4A] text-white text-[0.6rem] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="mb-3">
                  <span className="text-[0.6rem] font-bold uppercase tracking-widest text-[#C5A46D]">{pkg.tag}</span>
                  <h3
                    className="text-lg font-bold text-gray-900 mt-0.5"
                    style={{ fontFamily: 'var(--font-playfair, serif)' }}
                  >
                    {pkg.name}
                  </h3>
                  <p className="text-2xl font-bold text-[#8B1A4A] mt-1">
                    ₹{pkg.price.toLocaleString('en-IN')}
                    <span className="text-xs text-gray-400 font-normal"> / plate</span>
                  </p>
                </div>
                <ul className="space-y-1.5 mb-5">
                  {pkg.highlights.map((h) => (
                    <li key={h} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-3.5 h-3.5 text-[#C5A46D] flex-shrink-0" />
                      {h}
                    </li>
                  ))}
                </ul>
                <a
                  href="#enquiry-form"
                  className={`block text-center text-sm font-semibold py-2.5 rounded-xl transition-all ${
                    pkg.isPopular
                      ? 'bg-[#8B1A4A] text-white hover:opacity-90'
                      : 'border border-[#8B1A4A]/30 text-[#8B1A4A] hover:bg-[#8B1A4A]/5'
                  }`}
                >
                  Book This Package
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LOCATION ── */}
      <section className="bg-white py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-3">Location</p>
              <h2
                className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4"
                style={{ fontFamily: 'var(--font-playfair, serif)' }}
              >
                Conveniently Located in Rajeev Nagar, Patna
              </h2>
              <div className="flex items-start gap-3 text-gray-600 text-sm mb-3">
                <MapPin className="w-4 h-4 text-[#C5A46D] flex-shrink-0 mt-0.5" />
                <span>Road No. 23, Near Atal Path Branch Road, Mica Colony, Rajeev Nagar, Patna – 800012</span>
              </div>
              <div className="flex items-start gap-3 text-gray-600 text-sm mb-6">
                <Clock className="w-4 h-4 text-[#C5A46D] flex-shrink-0 mt-0.5" />
                <span>Open daily: 11:00 AM – 12:00 AM</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="#enquiry-form"
                  className="inline-flex items-center justify-center gap-2 bg-[#8B1A4A] text-white font-semibold px-6 py-3.5 rounded-full text-sm hover:opacity-90 transition-all"
                >
                  Book This Venue <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="tel:+917986519662"
                  className="inline-flex items-center justify-center gap-2 border border-[#C5A46D]/40 text-[#8B1A4A] font-semibold px-6 py-3.5 rounded-full text-sm hover:bg-[#8B1A4A]/5 transition-all"
                >
                  <Phone className="w-4 h-4" /> Call Now
                </a>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden border border-[#C5A46D]/20 shadow-lg">
              <iframe
                title="Touch of Cozy Location — Rajeev Nagar Patna"
                src="https://maps.google.com/maps?q=Touch+of+Cozy+Mica+Colony+Rajeev+Nagar+Patna&output=embed&z=15"
                width="100%"
                height="280"
                style={{ border: 0, display: 'block' }}
                loading="lazy"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── REVIEWS ── */}
      <section className="bg-white py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-2">What Couples Say</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              Real Reviews from Real Weddings
            </h2>
            <div className="flex items-center justify-center gap-2 mt-3">
              {[1,2,3,4,5].map(s => <Star key={s} className="w-4 h-4 fill-[#C5A46D] text-[#C5A46D]" />)}
              <span className="text-gray-500 text-sm ml-1">5.0 · 47+ Google Reviews</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {REVIEWS.map((r) => (
              <div key={r.name} className="bg-[#FFFAF5] border border-[#C5A46D]/15 rounded-2xl p-5">
                <div className="flex items-center gap-1 mb-3">
                  {[1,2,3,4,5].map(s => <Star key={s} className="w-3.5 h-3.5 fill-[#C5A46D] text-[#C5A46D]" />)}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed mb-4">&ldquo;{r.text}&rdquo;</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">{r.name}</span>
                  <span className="text-xs text-gray-400">{r.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-[#FFFAF5] py-14 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-2">FAQ</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white border border-[#C5A46D]/20 rounded-2xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="text-sm font-semibold text-gray-900 pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#C5A46D] flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4">
                    <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="bg-[#8B1A4A] py-12 sm:py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2
            className="text-2xl sm:text-3xl font-bold text-white mb-3"
            style={{ fontFamily: 'var(--font-playfair, serif)' }}
          >
            Dates Fill Up Fast
          </h2>
          <p className="text-white/70 text-sm mb-7">
            Secure your event date now. Get a free quote and check availability in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#enquiry-form"
              className="inline-flex items-center justify-center gap-2 bg-white text-[#8B1A4A] font-bold px-8 py-4 rounded-full text-sm hover:opacity-90 transition-all shadow-lg"
            >
              Check Availability <Calendar className="w-4 h-4" />
            </a>
            <a
              href="tel:+917986519662"
              className="inline-flex items-center justify-center gap-2 border-2 border-white/40 text-white font-semibold px-8 py-4 rounded-full text-sm hover:bg-white/10 transition-all"
            >
              <Phone className="w-4 h-4" /> +91 79865 19662
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <div className="bg-[#2A1F1B] py-5 text-center">
        <p className="text-gray-600 text-xs">
          © {new Date().getFullYear()} ShaadiShopping · Patna&apos;s Wedding Planning Platform ·{' '}
          <Link href="/" className="text-[#C5A46D]/60 hover:text-[#C5A46D] transition-colors">
            Visit Main Site
          </Link>
        </p>
      </div>

      {/* ── STICKY MOBILE CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-white border-t border-gray-100 px-4 py-3 flex gap-3 shadow-2xl">
        <a
          href="#enquiry-form"
          className="flex-1 flex items-center justify-center bg-[#8B1A4A] text-white font-bold py-3.5 rounded-xl text-sm"
          style={{ boxShadow: '0 4px 16px rgba(139,26,74,0.4)' }}
        >
          Get Free Quote
        </a>
        <a
          href="tel:+917986519662"
          className="flex items-center justify-center gap-1.5 border border-gray-200 text-gray-700 px-4 py-3.5 rounded-xl text-sm font-semibold"
        >
          <Phone className="w-4 h-4" /> Call
        </a>
      </div>

    </div>
  );
}
