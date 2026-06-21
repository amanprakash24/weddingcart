'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Phone, CheckCircle, Star, MapPin, Users, Calendar, ArrowRight, ShieldCheck, Clock, Sparkles, ChevronDown } from 'lucide-react';

const GALLERY_IMAGES = [
  { src: 'https://res.cloudinary.com/djaif7u83/image/upload/v1782029500/shaadishopping/swayamvar-hall/best-banquet-hall-swayamvar.jpg', alt: 'Swayamvar Hall — Best Banquet Hall in Patna' },
  { src: 'https://res.cloudinary.com/djaif7u83/image/upload/v1782029697/shaadishopping/swayamvar-hall/swayamvar-hall-patna.jpg', alt: 'Swayamvar Hall & Homestay — Wedding Venue Patna' },
  { src: 'https://res.cloudinary.com/djaif7u83/image/upload/v1782029696/shaadishopping/swayamvar-hall/swayamvar-selfie-point.jpg', alt: 'Swayamvar Hall Selfie Point — Banquet Hall Danapur Patna' },
  { src: 'https://res.cloudinary.com/djaif7u83/image/upload/v1782029695/shaadishopping/swayamvar-hall/swayamvar-mandap.jpg', alt: 'Swayamvar Hall Mandap — Wedding Decoration Patna' },
  { src: 'https://res.cloudinary.com/djaif7u83/image/upload/v1782029704/shaadishopping/swayamvar-hall/swayamvar-capacity-banquet.jpg', alt: 'Swayamvar Hall Capacity — 500 Guests Banquet Hall Patna' },
  { src: 'https://res.cloudinary.com/djaif7u83/image/upload/v1782029698/shaadishopping/swayamvar-hall/swayamvar-banquet-hall.jpg', alt: 'Swayamvar Banquet Hall Interior — Gola Road Danapur Patna' },
  { src: 'https://res.cloudinary.com/djaif7u83/image/upload/v1782029696/shaadishopping/swayamvar-hall/swayamvar-lawn.jpg', alt: 'Swayamvar Hall Lawn — Outdoor Wedding Venue Patna' },
];

const REVIEWS = [
  {
    name: 'Amit Kumar',
    rating: 5,
    date: 'May 2025',
    text: 'Swayamvar Hall is the best banquet hall in Danapur, Patna. We hosted our son\'s wedding here and everything was flawless. The decoration was beautiful, catering was excellent, and the staff was very professional throughout.',
  },
  {
    name: 'Neha Singh',
    rating: 5,
    date: 'March 2025',
    text: 'Wonderful experience at Swayamvar Hall! The homestay facility was a lifesaver for our outstation family members. Spacious hall, great food, and the coordinator handled every detail without any stress on our end.',
  },
  {
    name: 'Rakesh Prasad',
    rating: 5,
    date: 'January 2025',
    text: 'Hosted my daughter\'s reception at Swayamvar Hall. Easily accommodated our 400+ guests with proper seating and parking. The in-house catering quality was top notch. Highly recommend for large weddings in Patna.',
  },
];

const FAQS = [
  {
    q: 'Is Swayamvar Hall the best banquet hall in Danapur, Patna?',
    a: 'Swayamvar Hall & Homestay is one of the top-rated banquet halls in Danapur, Patna, with 4.8★ across 500+ events. Located on Gola Road near Chanakya Puri, it offers a fully AC hall for up to 500 guests, in-house catering, homestay accommodation, and a dedicated event coordinator.',
  },
  {
    q: 'What is the capacity of Swayamvar Hall?',
    a: 'Swayamvar Hall can accommodate up to 500 guests for weddings and large receptions. It is one of the larger banquet halls in the Danapur-Patna area, making it ideal for grand weddings and multi-day celebrations.',
  },
  {
    q: 'What is the per plate price at Swayamvar Hall Patna?',
    a: 'Swayamvar Hall offers in-house catering starting at ₹1,000 per plate (Vegetarian) and ₹1,300 per plate (Non-Vegetarian). Packages include hall access, basic décor, parking, and a dedicated event coordinator.',
  },
  {
    q: 'Does Swayamvar Hall have homestay accommodation?',
    a: 'Yes. Swayamvar Hall has homestay accommodation available for outstation guests and family members. This is a significant advantage for multi-day wedding functions where out-of-town relatives need comfortable overnight stays.',
  },
  {
    q: 'Where is Swayamvar Hall located in Patna?',
    a: 'Swayamvar Hall is located at T Point, Gola Road, near Chanakya Puri, Danapur, Patna – 801503. It is well connected from all parts of Patna and easily accessible from the Patna bypass.',
  },
  {
    q: 'How do I book Swayamvar Hall through ShaadiShopping?',
    a: 'Fill the free quote form on this page or call +91 76460 28228. ShaadiShopping is the authorised booking partner for Swayamvar Hall. Our Patna team will check date availability and share pricing — completely free for couples.',
  },
];

const FEATURES = [
  'Fully Air-Conditioned Banquet Hall',
  'Up to 500 Guests Capacity',
  'In-House Catering (Veg & Non-Veg)',
  'Home Stay Accommodation Available',
  'Ample Parking Space',
  'Dedicated Event Coordinator',
  'Décor & Floral Arrangements',
  'Power Backup',
  'Stage & Sound Setup',
  '500+ Events Hosted',
];

const BADGES = [
  { icon: Users, label: 'Upto 500 Guests' },
  { icon: Sparkles, label: 'Full Décor Available' },
  { icon: ShieldCheck, label: 'Verified Venue' },
  { icon: Clock, label: 'Quick Response' },
];

export default function SwayamvarLandingClient() {
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
    if (!isValidPhone(form.phone)) { setError('Please enter a valid 10-digit phone number.'); return; }
    setSubmitting(true);
    try {
      await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: 'swayamvar-hall',
          vendorName: 'Swayamvar Hall & Homestay',
          vendorCategory: 'venue',
          name: form.name,
          phone: form.phone,
          city: 'Patna',
          eventDate: form.eventDate,
          guestCount: form.guestCount,
          eventType: 'wedding',
          message: form.message || 'Enquiry from landing page',
          source: 'lp-swayamvar-hall',
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
            src="https://res.cloudinary.com/djaif7u83/image/upload/v1782029500/shaadishopping/swayamvar-hall/best-banquet-hall-swayamvar.jpg"
            alt="Swayamvar Hall & Homestay — Best Banquet Hall in Danapur Patna"
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(120deg, rgba(20,8,4,0.88) 0%, rgba(20,8,4,0.55) 55%, rgba(20,8,4,0.80) 100%)' }} />
        </div>

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 sm:px-8 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-white font-bold text-lg" style={{ fontFamily: 'var(--font-playfair, serif)' }}>ShaadiShopping</span>
          </Link>
          <a
            href="tel:+917646028228"
            className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-white/20 transition-all"
          >
            <Phone className="w-3.5 h-3.5" /> +91 76460 28228
          </a>
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
          <div className="grid lg:grid-cols-2 gap-10 items-center">

            {/* Left — copy */}
            <div>
              <div className="inline-flex items-center gap-2 bg-[#C5A46D]/15 border border-[#C5A46D]/30 text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.18em] px-3 py-1.5 rounded-full mb-5">
                <MapPin className="w-3 h-3" /> Gola Road, Danapur · Verified Venue
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
                Swayamvar Hall<br />
                <span style={{ background: 'linear-gradient(135deg, #e8d5b0, #C5A46D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  &amp; Homestay
                </span>
              </h1>

              <p className="text-white/70 text-base sm:text-lg leading-relaxed mb-6 max-w-lg">
                Patna&apos;s trusted banquet hall in Danapur — 500+ guests capacity, in-house catering, homestay accommodation &amp; professional event coordination for your perfect shaadi.
              </p>

              {/* Rating */}
              <div className="flex items-center gap-3 mb-7">
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map((s) => (
                    <Star key={s} className={`w-4 h-4 ${s <= 4 ? 'fill-[#C5A46D]' : 'fill-[#C5A46D]/50'} text-[#C5A46D]`} />
                  ))}
                </div>
                <span className="text-white/60 text-sm">4.8 · 500+ Events Hosted in Patna</span>
              </div>

              {/* Badges */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                {BADGES.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2.5 bg-white/6 backdrop-blur-sm border border-white/10 rounded-xl px-3.5 py-2.5">
                    <Icon className="w-4 h-4 text-[#C5A46D] flex-shrink-0" />
                    <span className="text-white/80 text-xs font-medium">{label}</span>
                  </div>
                ))}
              </div>

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
                  <h3 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
                    Enquiry Received!
                  </h3>
                  <p className="text-gray-500 text-sm mb-6">
                    Our team will call you within 30 minutes to discuss availability and pricing.
                  </p>
                  <a
                    href="tel:+917646028228"
                    className="inline-flex items-center gap-2 bg-[#8B1A4A] text-white font-semibold px-6 py-3 rounded-full text-sm hover:opacity-90 transition-all"
                  >
                    <Phone className="w-4 h-4" /> Call Us Now
                  </a>
                </div>
              ) : (
                <>
                  <div className="mb-5">
                    <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
                      Get Free Quote
                    </h2>
                    <p className="text-gray-400 text-xs mt-1">We&apos;ll call you back within 30 minutes</p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-3.5">
                    <input
                      required type="text" placeholder="Your Name *"
                      value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A4A]/20 focus:border-[#8B1A4A] transition-colors"
                    />
                    <input
                      required type="tel" placeholder="Phone Number * (10 digits)"
                      value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A4A]/20 focus:border-[#8B1A4A] transition-colors"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#8B1A4A]/20 focus:border-[#8B1A4A] transition-colors"
                      />
                      <select
                        value={form.guestCount} onChange={(e) => setForm({ ...form, guestCount: e.target.value })}
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
                      rows={2} placeholder="Any specific requirements? (optional)"
                      value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A4A]/20 focus:border-[#8B1A4A] transition-colors resize-none"
                    />

                    {error && <p className="text-rose-500 text-xs">{error}</p>}

                    <button
                      type="submit" disabled={submitting}
                      className="w-full bg-[#8B1A4A] text-white font-bold py-4 rounded-xl text-sm hover:opacity-90 disabled:opacity-60 transition-all"
                      style={{ boxShadow: '0 4px 20px rgba(139,26,74,0.4)' }}
                    >
                      {submitting ? 'Sending...' : 'Get Free Quote & Availability'}
                    </button>

                    <div className="flex items-center justify-center gap-1.5 pt-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-gray-300" />
                      <p className="text-[10px] text-gray-400 text-center">Your details are safe. No spam, ever.</p>
                    </div>
                  </form>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-center gap-2">
                    <span className="text-xs text-gray-400">Or call directly:</span>
                    <a href="tel:+917646028228" className="text-xs font-bold text-[#8B1A4A] hover:underline">+91 76460 28228</a>
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
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              Everything for Your Perfect Event
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-start gap-3 bg-[#FFFAF5] border border-[#C5A46D]/15 rounded-2xl px-4 py-4">
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
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
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
              { value: '500+', label: 'Events Hosted' },
              { value: '4.8★', label: 'Average Rating' },
              { value: '10+', label: 'Years Experience' },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-2xl sm:text-4xl font-light text-[#C5A46D]" style={{ fontFamily: 'var(--font-cormorant, serif)' }}>{value}</p>
                <p className="text-gray-500 text-[0.65rem] uppercase tracking-[0.15em] mt-1">{label}</p>
              </div>
            ))}
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
              {[1,2,3,4,5].map(s => <Star key={s} className={`w-4 h-4 ${s <= 4 ? 'fill-[#C5A46D]' : 'fill-[#C5A46D]/50'} text-[#C5A46D]`} />)}
              <span className="text-gray-500 text-sm ml-1">4.8 · 500+ Events Hosted</span>
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
                  <ChevronDown className={`w-4 h-4 text-[#C5A46D] flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
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

      {/* ── LOCATION ── */}
      <section className="bg-white py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-3">Location</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
                Conveniently Located in Danapur, Patna
              </h2>
              <div className="flex items-start gap-3 text-gray-600 text-sm mb-3">
                <MapPin className="w-4 h-4 text-[#C5A46D] flex-shrink-0 mt-0.5" />
                <span>T Point, Gola Road, near Chanakya Puri, Danapur, Patna – 801503</span>
              </div>
              <div className="flex items-start gap-3 text-gray-600 text-sm mb-6">
                <Clock className="w-4 h-4 text-[#C5A46D] flex-shrink-0 mt-0.5" />
                <span>Available daily for bookings — call for slot availability</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="#enquiry-form"
                  className="inline-flex items-center justify-center gap-2 bg-[#8B1A4A] text-white font-semibold px-6 py-3.5 rounded-full text-sm hover:opacity-90 transition-all"
                >
                  Book This Venue <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="tel:+917646028228"
                  className="inline-flex items-center justify-center gap-2 border border-[#C5A46D]/40 text-[#8B1A4A] font-semibold px-6 py-3.5 rounded-full text-sm hover:bg-[#8B1A4A]/5 transition-all"
                >
                  <Phone className="w-4 h-4" /> Call Now
                </a>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden border border-[#C5A46D]/20 shadow-lg">
              <iframe
                title="Swayamvar Hall Location — Danapur Patna"
                src="https://maps.google.com/maps?q=T+Point+Gola+Road+near+Chanakya+Puri+Danapur+Patna&output=embed&z=15"
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

      {/* ── BOTTOM CTA ── */}
      <section className="bg-[#8B1A4A] py-12 sm:py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
            Limited Dates Available
          </h2>
          <p className="text-white/70 text-sm mb-7">
            Popular muhurat dates book fast. Check availability now and secure your event date.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#enquiry-form"
              className="inline-flex items-center justify-center gap-2 bg-white text-[#8B1A4A] font-bold px-8 py-4 rounded-full text-sm hover:opacity-90 transition-all shadow-lg"
            >
              Check Availability <Calendar className="w-4 h-4" />
            </a>
            <a
              href="tel:+917646028228"
              className="inline-flex items-center justify-center gap-2 border-2 border-white/40 text-white font-semibold px-8 py-4 rounded-full text-sm hover:bg-white/10 transition-all"
            >
              <Phone className="w-4 h-4" /> +91 76460 28228
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <div className="bg-[#2A1F1B] py-5 text-center">
        <p className="text-gray-600 text-xs">
          © {new Date().getFullYear()} ShaadiShopping · Patna&apos;s Wedding Planning Platform ·{' '}
          <Link href="/" className="text-[#C5A46D]/60 hover:text-[#C5A46D] transition-colors">Visit Main Site</Link>
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
          href="tel:+917646028228"
          className="flex items-center justify-center gap-1.5 border border-gray-200 text-gray-700 px-4 py-3.5 rounded-xl text-sm font-semibold"
        >
          <Phone className="w-4 h-4" /> Call
        </a>
      </div>

    </div>
  );
}
