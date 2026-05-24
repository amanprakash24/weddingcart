'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, ChevronDown, Home, UtensilsCrossed, Camera, Palette, Music, Car, Gift, Mail, Star, Sparkles, FileText, Phone, Search, ArrowRight } from 'lucide-react';

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
];

const MEGA_MENU = [
  {
    heading: 'Venues',
    items: [
      { label: 'Wedding Venues', href: '/categories/venue', bold: true, icon: Home },
      { label: 'Wedding Lawns & Farmhouses', href: '/categories/venue' },
      { label: 'Hotels', href: '/categories/venue' },
      { label: 'Banquet Halls', href: '/categories/venue' },
      { label: 'Marriage Garden', href: '/categories/venue' },
      { label: 'Kalyana Mandapams', href: '/categories/venue' },
      { label: 'Wedding Resorts', href: '/categories/venue' },
    ],
  },
  {
    heading: 'Food & Hospitality',
    items: [
      { label: 'Caterers', href: '/categories/catering', bold: true, icon: UtensilsCrossed },
      { label: 'Wedding Cakes', href: '/categories/catering' },
      { label: 'Accommodation', href: '/categories/venue' },
    ],
  },
  {
    heading: 'Photography',
    items: [
      { label: 'Wedding Photographers', href: '/categories/photo-video', bold: true, icon: Camera },
      { label: 'Wedding Videography', href: '/categories/photo-video' },
      { label: 'Photobooth', href: '/categories/photo-video' },
    ],
  },
  {
    heading: 'Decor & Entertainment',
    items: [
      { label: 'Wedding Decorators', href: '/categories/decorator', bold: true, icon: Palette },
      { label: 'Florists', href: '/categories/decorator' },
      { label: 'Wedding Entertainment', href: '/categories/band', bold: true, icon: Music },
      { label: 'Wedding DJ', href: '/categories/dj' },
      { label: 'Wedding Music / Band', href: '/categories/band' },
      { label: 'Wedding Choreographers', href: '/categories/band' },
    ],
  },
  {
    heading: 'Bridal & Groom',
    items: [
      { label: 'Bridal Makeup Artists', href: '/categories/makeup', bold: true, icon: Star },
      { label: 'Mehndi Artists', href: '/categories/mehndi' },
      { label: 'Bridal Lehenga', href: '/categories/makeup' },
      { label: 'Trousseau Packing', href: '/categories/makeup' },
      { label: 'Bridal Jewellery', href: '/categories/makeup' },
      { label: 'Sherwani / Groom Wear', href: '/categories/makeup' },
    ],
  },
  {
    heading: 'Logistics & More',
    items: [
      { label: 'Wedding Transportation', href: '/categories/transport', bold: true, icon: Car },
      { label: 'Tent House', href: '/categories/decorator' },
      { label: 'Wedding Invitations', href: '/categories/invitations', bold: true, icon: Mail },
      { label: 'Wedding Gifts', href: '/categories/gifts', bold: true, icon: Gift },
      { label: 'Pandits', href: '/categories/planning' },
      { label: 'Astrologers', href: '/categories/planning' },
      { label: 'Legal & Documentation', href: '/categories/planning' },
      { label: 'Wedding Planners', href: '/categories/planning', bold: true, icon: FileText },
      { label: 'Honeymoon', href: '/categories/venue' },
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
                    className="fixed left-[5%] right-[5%] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.12)] border-t border-[#C5A46D]/15 animate-fade-in overflow-y-auto z-[9998] rounded-b-2xl"
                    style={{ top: 'calc(36px + 72px - 35px)' }}
                  >
                    <div className="max-w-7xl mx-auto px-8 py-8">
                      <div className="grid grid-cols-3 lg:grid-cols-6 gap-8">
                        {MEGA_MENU.map((col) => (
                          <div key={col.heading}>
                            <p className="text-[0.6rem] font-bold text-[#C5A46D] uppercase tracking-[0.25em] mb-4">{col.heading}</p>
                            <ul className="space-y-2">
                              {col.items.map((item) => (
                                <li key={item.label}>
                                  <Link
                                    href={item.href}
                                    className={`flex items-center gap-1.5 text-[0.8rem] py-0.5 transition-colors hover:text-[#8B1A4A] ${item.bold ? 'font-semibold text-gray-800' : 'text-gray-400'}`}
                                  >
                                    {item.icon && <item.icon className="w-3 h-3 text-[#C5A46D]/70 flex-shrink-0" />}
                                    {item.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                      <div className="mt-8 pt-5 border-t border-gray-100 flex items-center justify-between">
                        <p className="text-xs text-gray-400">Need help choosing? Our experts will guide you.</p>
                        <Link href="/plan" className="flex items-center gap-1.5 text-xs font-semibold text-[#8B1A4A] hover:opacity-75 transition-opacity">
                          <Sparkles className="w-3 h-3" /> Use the Planning Wizard
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-5">
              {/* Talk to Expert — desktop only */}
              <a
                href="tel:+917646028228"
                className={`hidden lg:flex items-center gap-1.5 text-[0.82rem] font-medium tracking-[0.02em] transition-colors duration-200 ${
                  isTransparent ? 'text-white/80 hover:text-white' : 'text-gray-500 hover:text-[#8B1A4A]'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                Talk to Expert
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

              {/* Begin Your Journey CTA */}
              <Link
                href="/plan"
                className={`hidden sm:inline-flex items-center text-[0.78rem] font-semibold tracking-[0.06em] px-6 py-2.5 rounded-lg transition-all hover:opacity-88 ${
                  isTransparent
                    ? 'bg-white/18 border border-white/30 text-white hover:bg-white/25'
                    : 'bg-[#8B1A4A] text-white hover:shadow-[0_4px_16px_rgba(139,26,74,0.35)]'
                }`}
              >
                Begin Your Journey
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
                    {MEGA_MENU.map((col) => (
                      <div key={col.heading} className="mb-4">
                        <p className="text-[0.6rem] font-bold text-[#C5A46D] uppercase tracking-[0.25em] px-3 py-1">{col.heading}</p>
                        {col.items.map((item) => (
                          <Link
                            key={item.label}
                            href={item.href}
                            className={`block px-3 py-2.5 rounded-lg text-sm transition-colors hover:text-[#8B1A4A] hover:bg-rose-50 ${item.bold ? 'font-semibold text-gray-700' : 'text-gray-400'}`}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 pb-1 space-y-2">
                <Link
                  href="/plan"
                  className="flex items-center justify-center w-full bg-[#8B1A4A] text-white font-semibold py-3.5 rounded-xl hover:opacity-90 transition-all min-h-[48px] text-sm tracking-wide"
                >
                  Begin Your Journey Your Wedding
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
