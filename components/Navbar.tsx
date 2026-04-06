'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, Menu, X, Heart, Phone } from 'lucide-react';
import { useCart } from '@/context/CartContext';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/categories/venue', label: 'Venues' },
  { href: '/categories/makeup', label: 'Makeup' },
  { href: '/categories/catering', label: 'Catering' },
  { href: '/categories/photo-video', label: 'Photography' },
  { href: '/plan', label: 'Plan Wedding' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { itemCount, openCart } = useCart();
  const pathname = usePathname();
  const isHome = pathname === '/';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const isTransparent = isHome && !scrolled && !mobileOpen;

  return (
    <>
      {/* Use z-[9999] so the nav is always above page content on all mobile browsers */}
      <nav
        style={{ zIndex: 9999 }}
        className={`fixed top-0 inset-x-0 transition-all duration-300 ${
          isTransparent
            ? 'bg-transparent'
            : 'bg-white/95 backdrop-blur-md shadow-sm border-b border-amber-100/60'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 flex-shrink-0 py-2"
              style={{ touchAction: 'manipulation' }}
            >
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-rose-500 rounded-full opacity-20 animate-spin-slow pointer-events-none" />
                <div className="relative flex items-center justify-center w-8 h-8">
                  <Heart className="w-5 h-5 fill-rose-500 text-rose-500" />
                </div>
              </div>
              <span
                className={`text-xl font-bold font-[Playfair_Display,serif] transition-colors ${
                  isTransparent ? 'text-white' : 'gradient-text'
                }`}
              >
                WeddingCart
              </span>
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
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <a
                href="tel:+911800000000"
                style={{ touchAction: 'manipulation' }}
                className={`hidden sm:flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full transition-all ${
                  isTransparent
                    ? 'text-white/90 hover:bg-white/15'
                    : 'text-gray-600 hover:text-amber-600 hover:bg-amber-50'
                }`}
              >
                <Phone className="w-4 h-4" />
                <span className="hidden md:inline">1800-000-0000</span>
              </a>

              {/* Cart button — min 44×44 tap target for mobile */}
              <button
                onClick={openCart}
                aria-label="Open cart"
                style={{ touchAction: 'manipulation', minWidth: 44, minHeight: 44 }}
                className={`relative flex items-center justify-center w-11 h-11 rounded-full transition-all ${
                  isTransparent
                    ? 'text-white hover:bg-white/15'
                    : 'text-gray-700 hover:bg-amber-50 hover:text-amber-600'
                }`}
              >
                <ShoppingCart className="w-5 h-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 flex items-center justify-center bg-rose-500 text-white text-xs font-bold rounded-full pointer-events-none">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </button>

              <Link
                href="/plan"
                style={{ touchAction: 'manipulation' }}
                className="hidden sm:flex items-center bg-gradient-to-r from-amber-500 to-rose-500 text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 transition-all hover:shadow-lg"
              >
                Start Planning
              </Link>

              {/* Hamburger — min 44×44 tap target */}
              <button
                onClick={() => setMobileOpen((v) => !v)}
                style={{ touchAction: 'manipulation', minWidth: 44, minHeight: 44 }}
                className={`lg:hidden flex items-center justify-center w-11 h-11 rounded-full transition-all ${
                  isTransparent
                    ? 'text-white hover:bg-white/15'
                    : 'text-gray-700 hover:bg-gray-100'
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
                  href="tel:+911800000000"
                  style={{ touchAction: 'manipulation' }}
                  className="flex items-center justify-center gap-2 w-full border border-gray-200 text-gray-600 font-medium py-3 rounded-xl text-sm min-h-[48px]"
                >
                  <Phone className="w-4 h-4" />
                  Call: 1800-000-0000
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Mobile menu backdrop — closes menu on tap outside */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20"
          style={{ zIndex: 9998, touchAction: 'manipulation' }}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Admin link */}
      <Link
        href="/admin"
        className="fixed bottom-4 left-4 z-40 w-10 h-10 flex items-center justify-center bg-gray-800/80 text-white text-xs rounded-full opacity-20 hover:opacity-100 transition-opacity"
        title="Admin Panel"
        style={{ touchAction: 'manipulation' }}
      >
        A
      </Link>
    </>
  );
}
