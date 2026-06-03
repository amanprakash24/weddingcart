'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, Phone, Mail, MapPin, Share2, MessageCircle, PlayCircle, AtSign, CheckCircle } from 'lucide-react';

const services = [
  { label: 'Wedding Venues', href: '/categories/venue' },
  { label: 'Makeup Artists', href: '/categories/makeup' },
  { label: 'Mehndi Artists', href: '/categories/mehndi' },
  { label: 'Decorators', href: '/categories/decorator' },
  { label: 'Catering', href: '/categories/catering' },
  { label: 'Photo & Video', href: '/categories/photo-video' },
  { label: 'DJ Services', href: '/categories/dj' },
  { label: 'Band & Music', href: '/categories/band' },
  { label: 'Wedding Planners', href: '/categories/planning' },
];

const patnaLinks = [
  { label: 'Wedding Venues in Patna', href: '/cities/patna/venue' },
  { label: 'Makeup Artists in Patna', href: '/cities/patna/makeup' },
  { label: 'Caterers in Patna', href: '/cities/patna/catering' },
  { label: 'Photographers in Patna', href: '/cities/patna/photo-video' },
  { label: 'Decorators in Patna', href: '/cities/patna/decorator' },
  { label: 'Mehndi Artists in Patna', href: '/cities/patna/mehndi' },
  { label: 'DJ Services in Patna', href: '/cities/patna/dj' },
  { label: 'Bands in Patna', href: '/cities/patna/band' },
  { label: 'Wedding Planners Patna', href: '/cities/patna/planning' },
];

const cityLinks = [
  { label: 'Patna', href: '/cities/patna' },
  { label: 'Delhi', href: '/cities/delhi' },
  { label: 'Mumbai', href: '/cities/mumbai' },
  { label: 'Jaipur', href: '/cities/jaipur' },
  { label: 'Bangalore', href: '/cities/bangalore' },
  { label: 'Goa', href: '/cities/goa' },
  { label: 'Udaipur', href: '/cities/udaipur' },
  { label: 'Kolkata', href: '/cities/kolkata' },
];

const company = [
  { label: 'About Us', href: '/about' },
  { label: 'Blog', href: '/blog' },
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'Begin Your Journey', href: '/plan' },
  { label: 'For Vendors', href: '/vendor-onboarding' },
  { label: 'Privacy Policy', href: '#' },
  { label: 'Terms of Service', href: '#' },
];

const socials = [
  { Icon: Share2, href: '#', label: 'Instagram' },
  { Icon: MessageCircle, href: '#', label: 'Facebook' },
  { Icon: PlayCircle, href: '#', label: 'YouTube' },
  { Icon: AtSign, href: '#', label: 'Twitter' },
];

export default function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = () => {
    if (!email.trim() || !email.includes('@')) return;
    setSubscribed(true);
    setEmail('');
  };

  return (
    <footer style={{ background: '#2A1F1B' }} className="text-gray-400">

      {/* ── NEWSLETTER BAND ── */}
      <div className="border-b border-[#C5A46D]/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="max-w-lg">
              <p className="eyebrow-luxury mb-3">Stay Connected</p>
              <h3 className="font-cormorant text-3xl sm:text-4xl italic font-light text-white mb-3">
                Wedding Planning Tips &amp; Inspiration
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Expert wedding advice and vendor spotlights — no spam. Only what matters for your big day.
              </p>
            </div>

            <div className="w-full lg:w-auto lg:min-w-[360px]">
              {subscribed ? (
                <div className="flex items-center gap-3 bg-[#C5A46D]/10 border border-[#C5A46D]/25 rounded-xl px-5 py-4">
                  <CheckCircle className="w-5 h-5 text-[#C5A46D] flex-shrink-0" />
                  <div>
                    <p className="text-white text-sm font-semibold">You&apos;re subscribed!</p>
                    <p className="text-gray-500 text-xs mt-0.5">Expect curated wedding ideas in your inbox.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubscribe()}
                      placeholder="Your email address"
                      className="flex-1 bg-white/5 border border-[#C5A46D]/20 rounded-xl px-4 py-3.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C5A46D]/50 transition-colors"
                    />
                    <button
                      onClick={handleSubscribe}
                      className="shrink-0 bg-[#8B1A4A] text-white text-xs font-semibold tracking-widest uppercase px-6 rounded-xl hover:opacity-90 transition-all"
                    >
                      Subscribe
                    </button>
                  </div>
                  <p className="text-gray-600 text-xs mt-2.5">Join 5,000+ couples already subscribed.</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN FOOTER ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-10">

          {/* Brand — spans 2 cols on mobile, 1 on lg */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <Heart className="w-5 h-5 fill-[#8B1A4A] text-[#8B1A4A]" />
              <span className="text-lg font-bold text-white tracking-wide" style={{ fontFamily: 'var(--font-playfair, serif)' }}>ShaadiShopping</span>
            </div>
            <div className="h-px w-24 mb-5" style={{ background: 'linear-gradient(to right, #C5A46D, transparent)' }} />
            <p className="text-gray-500 text-sm leading-relaxed mb-2">
              India&apos;s managed wedding planning &amp; coordination platform — from Venue to Vidaai.
            </p>
            <p className="text-[#C5A46D]/60 text-xs mb-6">
              Founded by <span className="text-[#C5A46D]">Anisha Kumari</span> · Patna, Bihar
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2.5">
                <Phone className="w-3.5 h-3.5 text-[#C5A46D] flex-shrink-0" />
                <a href="tel:+917646028228" className="hover:text-[#C5A46D] transition-colors">+91 76460 28228</a>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-3.5 h-3.5 text-[#C5A46D] flex-shrink-0" />
                <a href="mailto:shaadi.shopping51@gmail.com" className="hover:text-[#C5A46D] transition-colors">shaadi.shopping51@gmail.com</a>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-3.5 h-3.5 text-[#C5A46D] flex-shrink-0 mt-0.5" />
                <span className="text-gray-500">T Point, Gola Rd, near Danapur,<br />Patna, Bihar 801503</span>
              </div>
              <a
                href="https://maps.google.com/?q=T+Point,+Gola+Rd,+near+Danapur,+Patna,+Bihar+801503"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block rounded-xl overflow-hidden border border-[#C5A46D]/20 hover:border-[#C5A46D]/50 transition-colors"
              >
                <iframe
                  title="ShaadiShopping Location"
                  src="https://maps.google.com/maps?q=T+Point,+Gola+Rd,+near+Danapur,+Patna,+Bihar+801503&output=embed&z=15"
                  width="100%"
                  height="140"
                  style={{ border: 0, display: 'block', filter: 'grayscale(0.4) contrast(1.1)' }}
                  loading="lazy"
                  allowFullScreen
                />
              </a>
            </div>
          </div>

          {/* Wedding Services */}
          <div>
            <h4 className="text-[#C5A46D] font-semibold mb-5 text-[0.6rem] uppercase tracking-[0.25em]">Wedding Services</h4>
            <ul className="space-y-3">
              {services.map((s) => (
                <li key={s.href}>
                  <Link href={s.href} className="text-sm text-gray-500 hover:text-[#C5A46D] transition-colors hover:pl-1.5 duration-200 block">
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Popular in Patna */}
          <div>
            <h4 className="text-[#C5A46D] font-semibold mb-5 text-[0.6rem] uppercase tracking-[0.25em]">Popular in Patna</h4>
            <ul className="space-y-3">
              {patnaLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-gray-500 hover:text-[#C5A46D] transition-colors hover:pl-1.5 duration-200 block">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Cities */}
          <div>
            <h4 className="text-[#C5A46D] font-semibold mb-5 text-[0.6rem] uppercase tracking-[0.25em]">Cities We Serve</h4>
            <ul className="space-y-3 mb-8">
              {cityLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-gray-500 hover:text-[#C5A46D] transition-colors hover:pl-1.5 duration-200 block">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company + Socials */}
          <div>
            <h4 className="text-[#C5A46D] font-semibold mb-5 text-[0.6rem] uppercase tracking-[0.25em]">Company</h4>
            <ul className="space-y-3 mb-10">
              {company.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-gray-500 hover:text-[#C5A46D] transition-colors hover:pl-1.5 duration-200 block">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <h4 className="text-[#C5A46D] font-semibold mb-4 text-[0.6rem] uppercase tracking-[0.25em]">Follow Us</h4>
            <div className="flex items-center gap-2.5">
              {socials.map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 flex items-center justify-center rounded-full border border-[#C5A46D]/20 text-gray-500 hover:border-[#C5A46D] hover:text-[#C5A46D] transition-all"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── BOTTOM BAR ── */}
      <div className="border-t border-[#C5A46D]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-gray-600 text-xs tracking-wide text-center" suppressHydrationWarning>
            © {new Date().getFullYear()} ShaadiShopping. All rights reserved.
          </p>
          <div className="flex items-center gap-1.5 text-gray-600 text-xs tracking-wide">
            <span>Crafted with</span>
            <Heart className="w-3 h-3 fill-[#8B1A4A] text-[#8B1A4A]" />
            <span>in Patna for couples across India</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
