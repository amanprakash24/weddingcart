'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Phone, CheckCircle, Star, MapPin, Users, Calendar, ArrowRight, ShieldCheck, Clock, Sparkles } from 'lucide-react';

const FEATURES = [
  'Fully Air-Conditioned Banquet Hall',
  'In-House Catering (Veg & Non-Veg)',
  'Home Stay Accommodation Available',
  'Ample Parking Space',
  'Dedicated Event Coordinator',
  'Décor & Floral Arrangements',
  'Power Backup',
  'Stage & Sound Setup',
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
          vendorName: 'Swayamvar Hall & Home Stay',
          vendorCategory: 'venue',
          name: form.name,
          phone: form.phone,
          city: 'Patna',
          eventDate: form.eventDate,
          guestCount: form.guestCount,
          eventType: 'wedding',
          message: form.message || 'Enquiry from landing page ad',
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
            src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1600&q=85"
            alt="Swayamvar Hall & Home Stay — Banquet Hall Patna"
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
                <MapPin className="w-3 h-3" /> Patna, Bihar · Verified Venue
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
                Swayamvar Hall<br />
                <span style={{ background: 'linear-gradient(135deg, #e8d5b0, #C5A46D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  & Home Stay
                </span>
              </h1>

              <p className="text-white/70 text-base sm:text-lg leading-relaxed mb-6 max-w-lg">
                Patna&apos;s premium banquet hall for weddings, receptions &amp; celebrations. Elegant décor, in-house catering, and home stay — everything for your perfect shaadi.
              </p>

              {/* Rating */}
              <div className="flex items-center gap-3 mb-7">
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map((s) => (
                    <Star key={s} className="w-4 h-4 fill-[#C5A46D] text-[#C5A46D]" />
                  ))}
                </div>
                <span className="text-white/60 text-sm">4.8 · Highly Rated Venue in Patna</span>
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

              {/* CTA — mobile only (scrolls to form) */}
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
                    <div>
                      <input
                        required
                        type="text"
                        placeholder="Your Name *"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A4A]/20 focus:border-[#8B1A4A] transition-colors"
                      />
                    </div>
                    <div>
                      <input
                        required
                        type="tel"
                        placeholder="Phone Number * (10 digits)"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A4A]/20 focus:border-[#8B1A4A] transition-colors"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <input
                          type="date"
                          placeholder="Event Date"
                          value={form.eventDate}
                          onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#8B1A4A]/20 focus:border-[#8B1A4A] transition-colors"
                        />
                      </div>
                      <div>
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
                    </div>
                    <div>
                      <textarea
                        rows={2}
                        placeholder="Any specific requirements? (optional)"
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A4A]/20 focus:border-[#8B1A4A] transition-colors resize-none"
                      />
                    </div>

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
                    <a href="tel:+917646028228" className="text-xs font-bold text-[#8B1A4A] hover:underline">
                      +91 76460 28228
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

      {/* ── LOCATION ── */}
      <section className="bg-[#FFFAF5] py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-3">Location</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
                Conveniently Located in Patna
              </h2>
              <div className="flex items-start gap-3 text-gray-600 text-sm mb-6">
                <MapPin className="w-4 h-4 text-[#C5A46D] flex-shrink-0 mt-0.5" />
                <span>T Point, Gola Rd, near Danapur, Patna, Bihar 801503</span>
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
                title="Swayamvar Hall Location"
                src="https://maps.google.com/maps?q=T+Point,+Gola+Rd,+near+Danapur,+Patna,+Bihar+801503&output=embed&z=15"
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
            Popular dates book fast. Check availability now and secure your event date.
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
