'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ShoppingCart, Menu, X, Phone, ChevronDown, Home, UtensilsCrossed, Camera, Palette, Music, Car, Gift, Mail, Star, Sparkles, FileText } from 'lucide-react';
import { useCart } from '@/context/CartContext';

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
      { label: 'Hospitality', href: '/plan' },
      { label: 'Honeymoon', href: '/categories/venue' },
      { label: 'Party Places', href: '/categories/venue' },
    ],
  },
];

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About Us' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const megaRef = useRef<HTMLDivElement>(null);
  const { itemCount } = useCart();
  const pathname = usePathname();
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
  }, [pathname]);

  // Close mega menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (megaRef.current && !megaRef.current.contains(e.target as Node)) {
        setMegaOpen(false);
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
      <nav
        style={{ zIndex: 9999 }}
        className={`fixed top-0 inset-x-0 transition-all duration-300 ${
          isTransparent
            ? 'bg-transparent'
            : 'bg-white/95 backdrop-blur-md shadow-sm border-b border-amber-100/60'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 relative">
            {/* Logo — extreme left */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0" style={{ touchAction: 'manipulation' }}>
              <Image
                src="/logo.png"
                alt="ShaadiShopping logo"
                width={220}
                height={140}
                className="h-12 w-auto object-contain"
                priority
              />
              {/* Brand name beside logo on desktop */}
              <span className={`hidden lg:block text-xl font-bold font-[Playfair_Display,serif] whitespace-nowrap transition-colors ${isTransparent ? 'text-white' : 'gradient-text'}`}>
                ShaadiShopping
              </span>
            </Link>

            {/* Brand name — centered on mobile only */}
            <Link href="/" style={{ touchAction: 'manipulation' }} className={`lg:hidden absolute left-1/2 -translate-x-1/2 text-lg font-bold font-[Playfair_Display,serif] whitespace-nowrap transition-colors ${isTransparent ? 'text-white' : 'gradient-text'}`}>
              ShaadiShopping
            </Link>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{ touchAction: 'manipulation' }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    pathname === link.href
                      ? 'bg-amber-500 text-white'
                      : isTransparent
                      ? 'text-white/90 hover:text-white hover:bg-white/15'
                      : 'text-gray-700 hover:text-amber-600 hover:bg-amber-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* Services mega menu trigger */}
              <div className="relative" ref={megaRef}>
                <button
                  onClick={() => setMegaOpen((v) => !v)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    megaOpen
                      ? 'bg-amber-500 text-white'
                      : isTransparent
                      ? 'text-white/90 hover:text-white hover:bg-white/15'
                      : 'text-gray-700 hover:text-amber-600 hover:bg-amber-50'
                  }`}
                >
                  All Services <ChevronDown className={`w-3.5 h-3.5 transition-transform ${megaOpen ? 'rotate-180' : ''}`} />
                </button>

                {megaOpen && (
                  <div className="fixed top-16 left-[10%] right-[10%] h-[65vh] bg-white shadow-2xl border border-amber-100/60 rounded-b-2xl animate-fade-in overflow-y-auto z-[9998]">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 h-full flex flex-col">
                      <div className="grid grid-cols-3 lg:grid-cols-6 gap-6 flex-1">
                        {MEGA_MENU.map((col) => (
                          <div key={col.heading}>
                            <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-3 border-b border-amber-100 pb-1.5">{col.heading}</p>
                            <ul className="space-y-1">
                              {col.items.map((item) => (
                                <li key={item.label}>
                                  <Link
                                    href={item.href}
                                    className={`flex items-center gap-1.5 text-sm py-1 transition-colors hover:text-amber-600 ${item.bold ? 'font-semibold text-gray-800' : 'text-gray-500'}`}
                                  >
                                    {item.icon && <item.icon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                                    {item.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                      <div className="pt-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
                        <p className="text-xs text-gray-400">Can&apos;t find what you need?</p>
                        <Link href="/plan" className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:underline">
                          <Sparkles className="w-3.5 h-3.5" /> Use the Planning Wizard
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <a
                href="tel:+917070486987"
                style={{ touchAction: 'manipulation' }}
                className={`hidden sm:flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full transition-all ${
                  isTransparent ? 'text-white/90 hover:bg-white/15' : 'text-gray-600 hover:text-amber-600 hover:bg-amber-50'
                }`}
              >
                <Phone className="w-4 h-4" />
                <span className="hidden md:inline">70704 86987</span>
              </a>

              <Link
                href="/cart"
                aria-label="View cart"
                style={{ touchAction: 'manipulation', minWidth: 44, minHeight: 44 }}
                className={`relative flex items-center justify-center w-11 h-11 rounded-full transition-all ${
                  isTransparent ? 'text-white hover:bg-white/15' : 'text-gray-700 hover:bg-amber-50 hover:text-amber-600'
                }`}
              >
                <ShoppingCart className="w-5 h-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 flex items-center justify-center bg-rose-500 text-white text-xs font-bold rounded-full pointer-events-none">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </Link>

              <Link
                href="/plan"
                style={{ touchAction: 'manipulation' }}
                className="hidden sm:flex items-center bg-gradient-to-r from-amber-500 to-rose-500 text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 transition-all hover:shadow-lg"
              >
                Start Planning
              </Link>

              <button
                onClick={() => setMobileOpen((v) => !v)}
                style={{ touchAction: 'manipulation', minWidth: 44, minHeight: 44 }}
                className={`lg:hidden flex items-center justify-center w-11 h-11 rounded-full transition-all ${
                  isTransparent ? 'text-white hover:bg-white/15' : 'text-gray-700 hover:bg-gray-100'
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
          <div className="lg:hidden bg-white border-t border-gray-100 shadow-xl animate-fade-in max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{ touchAction: 'manipulation' }}
                  className={`flex items-center px-4 py-3.5 rounded-xl text-sm font-medium transition-all min-h-[48px] ${
                    pathname === link.href
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white'
                      : 'text-gray-700 hover:bg-amber-50 hover:text-amber-600'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* Mobile All Services accordion */}
              <div>
                <button
                  onClick={() => setMobileServicesOpen((v) => !v)}
                  className="flex items-center justify-between w-full px-4 py-3.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-amber-50 hover:text-amber-600 transition-all min-h-[48px]"
                >
                  All Services
                  <ChevronDown className={`w-4 h-4 transition-transform ${mobileServicesOpen ? 'rotate-180' : ''}`} />
                </button>
                {mobileServicesOpen && (
                  <div className="ml-4 mt-1 space-y-1 pb-2">
                    {MEGA_MENU.map((col) => (
                      <div key={col.heading} className="mb-3">
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest px-3 py-1">{col.heading}</p>
                        {col.items.map((item) => (
                          <Link
                            key={item.label}
                            href={item.href}
                            className={`block px-3 py-2 rounded-lg text-sm transition-colors hover:text-amber-600 hover:bg-amber-50 ${item.bold ? 'font-semibold text-gray-800' : 'text-gray-500'}`}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 pb-1">
                <Link
                  href="/plan"
                  style={{ touchAction: 'manipulation' }}
                  className="flex items-center justify-center w-full bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold py-3.5 rounded-xl hover:opacity-90 transition-all min-h-[48px]"
                >
                  Start Planning Your Wedding
                </Link>
              </div>
              <div className="pb-2">
                <a
                  href="tel:+917070486987"
                  style={{ touchAction: 'manipulation' }}
                  className="flex items-center justify-center gap-2 w-full border border-gray-200 text-gray-600 font-medium py-3 rounded-xl text-sm min-h-[48px]"
                >
                  <Phone className="w-4 h-4" />
                  Call: 70704 86987
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20"
          style={{ zIndex: 9998, touchAction: 'manipulation' }}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

    </>
  );
}
