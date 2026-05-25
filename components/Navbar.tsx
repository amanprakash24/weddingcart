'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, ChevronDown, Home, UtensilsCrossed, Camera, Palette, Music, Car, Gift, Mail, Star, Sparkles, FileText, Phone, Search, ArrowRight, Gem, MapPin as MapPinIcon } from 'lucide-react';

const VENDOR_OPTIONS = [
  { label: 'Wedding Venues',         slug: 'venue' },
  { label: 'Bridal Makeup Artists',  slug: 'makeup' },
  { label: 'Mehndi Artists',         slug: 'mehndi' },
  { label: 'Wedding Decorators',     slug: 'decorator' },
  { label: 'Wedding Photographers',  slug: 'photo-video' },
  { label: 'Wedding Caterers',       slug: 'catering' },
  { label: 'Wedding DJ',             slug: 'dj' },
  { label: 'Wedding Band & Music',   slug: 'band' },
  { label: 'Wedding Planners',       slug: 'planning' },
  { label: 'Bridal Lehenga',         slug: 'bridal-lehenga' },
  { label: 'Bridal Jewellery',       slug: 'bridal-jewellery' },
  { label: 'Sherwani & Groom Wear',  slug: 'sherwani' },
  { label: 'Wedding Transport',      slug: 'transport' },
  { label: 'Wedding Gifts',          slug: 'gifts' },
  { label: 'SFX Effects', slug: 'sfx' },
  { label: 'Security Guards & Bouncers',    slug: 'security' },
];

const MEGA_MENU = [
  {
    heading: 'Venues',
    icon: Home,
    desc: 'Find the perfect space for your celebration',
    items: [
      { label: 'Wedding Venues', href: '/categories/venue', tag: 'Popular' },
      { label: 'Banquet Halls', href: '/categories/venue' },
      { label: 'Farmhouses & Lawns', href: '/categories/venue' },
      { label: 'Hotels & Resorts', href: '/categories/venue' },
      { label: 'Marriage Gardens', href: '/categories/venue' },
      { label: 'Kalyana Mandapams', href: '/categories/venue' },
    ],
  },
  {
    heading: 'Beauty & Styling',
    icon: Star,
    desc: 'Look and feel your absolute best',
    items: [
      { label: 'Bridal Makeup Artists', href: '/categories/makeup', tag: 'Popular' },
      { label: 'Mehndi Artists', href: '/categories/mehndi' },
      { label: 'Bridal Lehenga', href: '/categories/makeup' },
      { label: 'Bridal Jewellery', href: '/categories/bridal-jewellery' },
      { label: 'Sherwani & Groom Wear', href: '/categories/sherwani' },
      { label: 'Trousseau Packing', href: '/categories/makeup' },
    ],
  },
  {
    heading: 'Photography & Film',
    icon: Camera,
    desc: 'Preserve every precious moment forever',
    items: [
      { label: 'Wedding Photographers', href: '/categories/photo-video', tag: 'Popular' },
      { label: 'Videographers', href: '/categories/photo-video' },
      { label: 'Drone Coverage', href: '/categories/photo-video' },
      { label: 'Photobooth', href: '/categories/photo-video' },
    ],
  },
  {
    heading: 'Catering & Food',
    icon: UtensilsCrossed,
    desc: 'Delight every guest with exceptional cuisine',
    items: [
      { label: 'Wedding Caterers', href: '/categories/catering', tag: 'Popular' },
      { label: 'Multi-Cuisine Catering', href: '/categories/catering' },
      { label: 'Vegetarian Specialist', href: '/categories/catering' },
      { label: 'Wedding Cakes', href: '/categories/catering' },
      { label: 'Accommodation', href: '/categories/venue' },
    ],
  },
  {
    heading: 'Décor & Entertainment',
    icon: Palette,
    desc: 'Create an atmosphere that enchants',
    items: [
      { label: 'Wedding Decorators', href: '/categories/decorator', tag: 'Popular' },
      { label: 'Florists', href: '/categories/decorator' },
      { label: 'Wedding DJ', href: '/categories/dj' },
      { label: 'Live Band & Music', href: '/categories/band' },
      { label: 'SFX Effects', href: '/categories/sfx' },
      { label: 'Fireworks', href: '/categories/sfx' },
      { label: 'Tent House', href: '/categories/decorator' },
    ],
  },
  {
    heading: 'Planning & More',
    icon: FileText,
    desc: 'Everything else for a seamless wedding',
    items: [
      { label: 'Wedding Planners', href: '/categories/planning', tag: 'Popular' },
      { label: 'Wedding Transportation', href: '/categories/transport' },
      { label: 'Wedding Invitations', href: '/categories/invitations' },
      { label: 'Wedding Gifts', href: '/categories/gifts' },
      { label: 'Security Guards & Bouncers', href: '/categories/security' },
      { label: 'Pandits & Astrologers', href: '/categories/planning' },
    ],
  },
];

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/about', label: 'About Us' },
  { href: '/blog', label: 'Blog' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState('venue');
  const megaRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = pathname.startsWith('/admin');
  const isHome = pathname === '/';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setMegaOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (megaRef.current && !megaRef.current.contains(e.target as Node)) {
        setMegaOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const isTransparent = isHome && !scrolled && !mobileOpen;

  if (isAdmin) return null;

  return (
    <>
      {/* ── ANNOUNCEMENT BAR — single calm message ── */}
      <div className="announcement-bar fixed top-0 inset-x-0 z-[10000] h-9 flex items-center justify-center overflow-hidden px-4">
        <p className="text-[0.62rem] tracking-[0.12em] sm:tracking-[0.22em] whitespace-nowrap truncate text-center">
          <span className="text-[#C5A46D]/45 mr-3 sm:mr-5">✦</span>
          <span className="hidden sm:inline">Expert Wedding Coordination · From Venue to Vidaai · Across India</span>
          <span className="sm:hidden">Expert Wedding Coordination · Across India</span>
          <span className="text-[#C5A46D]/45 ml-3 sm:ml-5">✦</span>
        </p>
      </div>

      {/* ── MAIN NAV ── */}
      <nav
        style={{ zIndex: 9999 }}
        className={`fixed inset-x-0 transition-all duration-300 top-9 ${
          isTransparent
            ? 'bg-transparent'
            : 'bg-white/96 backdrop-blur-md shadow-[0_1px_0_rgba(201,169,110,0.15)]'
        }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-10">
          <div className="flex items-center justify-between h-[52px] sm:h-[64px] lg:h-[72px]">

            {/* Logo */}
            <Link href="/" className="flex-shrink-0" style={{ touchAction: 'manipulation' }}>
              <Image
                src="/logo.png"
                alt="ShaadiShopping"
                width={240}
                height={150}
                className="h-[44px] sm:h-[52px] lg:h-[58px] w-auto object-contain"
                priority
              />
            </Link>

            {/* Desktop nav — centered */}
            <div className="hidden lg:flex items-center gap-7">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-[0.82rem] font-medium tracking-[0.02em] transition-colors duration-200 ${
                    pathname === link.href
                      ? 'text-[#8B1A4A]'
                      : isTransparent
                      ? 'text-white/85 hover:text-white'
                      : 'text-gray-600 hover:text-[#8B1A4A]'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* Services dropdown */}
              <div className="relative" ref={megaRef}>
                <button
                  onClick={() => setMegaOpen((v) => !v)}
                  className={`flex items-center gap-1.5 text-[0.82rem] font-medium tracking-[0.02em] transition-colors duration-200 ${
                    megaOpen
                      ? 'text-[#8B1A4A]'
                      : isTransparent
                      ? 'text-white/85 hover:text-white'
                      : 'text-gray-600 hover:text-[#8B1A4A]'
                  }`}
                >
                  Services
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${megaOpen ? 'rotate-180' : ''}`} />
                </button>

                {megaOpen && (
                  <div
                    className="fixed left-[3%] right-[3%] bg-white shadow-[0_32px_80px_rgba(0,0,0,0.16)] animate-fade-in z-[9998] rounded-2xl overflow-hidden"
                    style={{ top: 'calc(36px + 72px + 4px)' }}
                  >
                    <div className="flex" style={{ minHeight: 340 }}>

                      {/* Left sidebar — category tabs */}
                      <div className="w-56 flex-shrink-0 bg-[#2A1F1B] py-6 flex flex-col gap-0.5">
                        <p className="text-[0.55rem] font-bold text-[#C5A46D]/60 uppercase tracking-[0.3em] px-5 pb-3">Categories</p>
                        {MEGA_MENU.map((cat, i) => {
                          const Icon = cat.icon;
                          return (
                            <button
                              key={cat.heading}
                              onMouseEnter={() => setActiveCategory(i)}
                              onClick={() => setActiveCategory(i)}
                              className={`flex items-center gap-3 px-5 py-3 text-left transition-all duration-150 ${
                                activeCategory === i
                                  ? 'bg-[#8B1A4A] text-white'
                                  : 'text-white/60 hover:text-white hover:bg-white/8'
                              }`}
                            >
                              <Icon className={`w-4 h-4 flex-shrink-0 ${activeCategory === i ? 'text-[#C5A46D]' : ''}`} />
                              <span className="text-[0.8rem] font-medium">{cat.heading}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Right content — sub-items */}
                      <div className="flex-1 px-8 py-6">
                        {(() => {
                          const cat = MEGA_MENU[activeCategory];
                          return (
                            <>
                              <div className="flex items-start justify-between mb-5">
                                <div>
                                  <h3 className="text-base font-semibold text-[#2A1F1B]" style={{ fontFamily: 'var(--font-playfair, serif)' }}>{cat.heading}</h3>
                                  <p className="text-xs text-gray-400 mt-0.5">{cat.desc}</p>
                                </div>
                                <Link
                                  href={cat.items[0].href}
                                  className="flex items-center gap-1 text-xs font-semibold text-[#8B1A4A] hover:opacity-75 transition-opacity"
                                >
                                  View All <ArrowRight className="w-3 h-3" />
                                </Link>
                              </div>
                              <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                                {cat.items.map((item) => (
                                  <Link
                                    key={item.label}
                                    href={item.href}
                                    onClick={() => setMegaOpen(false)}
                                    className="flex items-center justify-between group px-3 py-2.5 rounded-lg hover:bg-[#FAF5EE] transition-all"
                                  >
                                    <span className="text-[0.82rem] text-gray-600 group-hover:text-[#8B1A4A] transition-colors font-medium">{item.label}</span>
                                    <div className="flex items-center gap-2">
                                      {item.tag && (
                                        <span className="text-[0.55rem] font-bold uppercase tracking-wider text-[#8B1A4A] bg-[#8B1A4A]/10 px-1.5 py-0.5 rounded-full">{item.tag}</span>
                                      )}
                                      <ArrowRight className="w-3 h-3 text-gray-300 group-hover:text-[#C5A46D] transition-colors opacity-0 group-hover:opacity-100" />
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Bottom strip */}
                    <div className="border-t border-[#C5A46D]/10 bg-[#FFFCF7] px-8 py-3.5 flex items-center justify-between">
                      <p className="text-xs text-gray-400">Not sure where to start? Our wedding experts will guide you.</p>
                      <Link
                        href="/plan"
                        onClick={() => setMegaOpen(false)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-[#8B1A4A] bg-[#8B1A4A]/8 hover:bg-[#8B1A4A]/15 px-4 py-2 rounded-full transition-all"
                      >
                        <Sparkles className="w-3 h-3" /> Use the Planning Wizard
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-5">
              {/* Talk to Expert — icon on mobile, full label on desktop */}
              <a
                href="tel:+917646028228"
                aria-label="Talk to Expert"
                className={`flex items-center gap-1.5 text-[0.82rem] font-medium tracking-[0.02em] transition-colors duration-200 ${
                  isTransparent ? 'text-white/80 hover:text-white' : 'text-gray-500 hover:text-[#8B1A4A]'
                }`}
              >
                <Phone className="w-6 h-6 lg:w-4 lg:h-4" />
                <span className="hidden lg:inline">Talk to Expert</span>
              </a>

              {/* Divider */}
              <div className={`hidden lg:block w-px h-5 ${isTransparent ? 'bg-white/20' : 'bg-gray-200'}`} />

              {/* Vendor Registration */}
              <Link
                href="/vendor-onboarding"
                className={`hidden lg:inline-flex items-center text-[0.78rem] font-semibold tracking-[0.04em] px-4 py-2.5 rounded-lg border transition-all ${
                  isTransparent
                    ? 'border-white/30 text-white hover:bg-white/12'
                    : 'border-[#8B1A4A] text-[#8B1A4A] hover:bg-[#8B1A4A]/10'
                }`}
              >
                Vendor Registration
              </Link>

              {/* Begin Your Wedding Journey CTA */}
              <Link
                href="/plan"
                className={`hidden sm:inline-flex items-center gap-2 text-[0.78rem] font-semibold tracking-[0.05em] px-5 py-2.5 rounded-full transition-all duration-300 relative overflow-hidden group ${
                  isTransparent
                    ? 'bg-white/15 border border-white/40 text-white hover:bg-white/25 backdrop-blur-sm'
                    : 'bg-gradient-to-r from-[#8B1A4A] via-[#A8234E] to-[#C5A46D] text-white hover:shadow-[0_6px_24px_rgba(139,26,74,0.45)] hover:scale-[1.03]'
                }`}
              >
                <Sparkles className="w-3 h-3 flex-shrink-0 relative z-10" />
                <span className="relative z-10">Begin Your Wedding Journey</span>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none" />
              </Link>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen((v) => !v)}
                style={{ touchAction: 'manipulation', minWidth: 44, minHeight: 44 }}
                className={`lg:hidden flex items-center justify-center w-11 h-11 rounded-xl transition-all ${
                  isTransparent ? 'text-white hover:bg-white/12' : 'text-gray-600 hover:bg-gray-100'
                }`}
                aria-label="Toggle menu"
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="lg:hidden bg-white border-t border-[#C5A46D]/10 shadow-xl animate-fade-in max-h-[calc(100vh-5.5rem)] overflow-y-auto">
            <div className="px-5 py-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center px-4 py-3.5 rounded-xl text-sm font-medium transition-all min-h-[48px] ${
                    pathname === link.href
                      ? 'bg-[#8B1A4A] text-white'
                      : 'text-gray-700 hover:bg-rose-50 hover:text-[#8B1A4A]'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* Mobile: Vendor Registration */}
              <Link
                href="/vendor-onboarding"
                onClick={() => setMobileOpen(false)}
                className="flex items-center px-4 py-3.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-rose-50 hover:text-[#8B1A4A] transition-all min-h-[48px]"
              >
                Vendor Registration
              </Link>

              {/* Mobile Services accordion */}
              <div>
                <button
                  onClick={() => setMobileServicesOpen((v) => !v)}
                  className="flex items-center justify-between w-full px-4 py-3.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-[#FAF5EE] hover:text-[#8B1A4A] transition-all min-h-[48px]"
                >
                  All Services
                  <ChevronDown className={`w-4 h-4 transition-transform ${mobileServicesOpen ? 'rotate-180' : ''}`} />
                </button>
                {mobileServicesOpen && (
                  <div className="ml-4 mt-1 space-y-1 pb-2">
                    {MEGA_MENU.map((col) => {
                      const Icon = col.icon;
                      return (
                        <div key={col.heading} className="mb-4">
                          <div className="flex items-center gap-2 px-3 py-1.5">
                            <Icon className="w-3.5 h-3.5 text-[#C5A46D]" />
                            <p className="text-[0.6rem] font-bold text-[#C5A46D] uppercase tracking-[0.25em]">{col.heading}</p>
                          </div>
                          {col.items.map((item) => (
                            <Link
                              key={item.label}
                              href={item.href}
                              onClick={() => setMobileOpen(false)}
                              className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-gray-600 transition-colors hover:text-[#8B1A4A] hover:bg-rose-50"
                            >
                              {item.label}
                              {item.tag && <span className="text-[0.55rem] font-bold uppercase tracking-wider text-[#8B1A4A] bg-[#8B1A4A]/10 px-1.5 py-0.5 rounded-full">{item.tag}</span>}
                            </Link>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-3 pb-1 space-y-2">
                <Link
                  href="/plan"
                  className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-[#8B1A4A] via-[#A8234E] to-[#C5A46D] text-white font-semibold py-3.5 rounded-full hover:shadow-[0_4px_20px_rgba(139,26,74,0.4)] hover:scale-[1.02] transition-all min-h-[48px] text-sm tracking-wide relative overflow-hidden group"
                >
                  <Sparkles className="w-4 h-4 flex-shrink-0 relative z-10" />
                  <span className="relative z-10">Begin Your Wedding Journey</span>
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none" />
                </Link>
                <a
                  href="tel:+917646028228"
                  className="flex items-center justify-center gap-2 w-full border border-gray-200 text-gray-500 font-medium py-3 rounded-xl text-sm min-h-[48px] hover:border-[#C5A46D]/50 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  Speak With An Expert
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/15"
          style={{ zIndex: 9998 }}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
