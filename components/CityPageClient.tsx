'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, ChevronDown } from 'lucide-react';
import VendorCard from './VendorCard';
import { Vendor } from '@/types';

const CATEGORY_TABS = [
  { id: 'all', label: 'All Vendors' },
  { id: 'venue', label: 'Venues' },
  { id: 'makeup', label: 'Makeup' },
  { id: 'mehndi', label: 'Mehndi' },
  { id: 'catering', label: 'Catering' },
  { id: 'photo-video', label: 'Photo & Video' },
  { id: 'decorator', label: 'Decorators' },
  { id: 'dj', label: 'DJ' },
  { id: 'band', label: 'Band' },
  { id: 'planning', label: 'Planners' },
];

const QUICK_CATS = [
  { id: 'venue', label: 'Venues', icon: '🏛️' },
  { id: 'makeup', label: 'Makeup', icon: '💄' },
  { id: 'catering', label: 'Catering', icon: '🍽️' },
  { id: 'decorator', label: 'Decorators', icon: '🌸' },
  { id: 'photo-video', label: 'Photography', icon: '📸' },
  { id: 'mehndi', label: 'Mehndi', icon: '🎨' },
  { id: 'band', label: 'Band & Music', icon: '🎺' },
  { id: 'planning', label: 'Planners', icon: '📋' },
  { id: 'dj', label: 'DJ', icon: '🎧' },
  { id: 'bridal-lehenga', label: 'Bridal Lehenga', icon: '👗' },
  { id: 'bridal-jewellery', label: 'Jewellery', icon: '💍' },
  { id: 'sfx', label: 'SFX Effects', icon: '✨' },
];

interface FAQ { q: string; a: string }

interface Props {
  cityName: string;
  stateName: string;
  faqs: FAQ[];
  heroImage: string;
}

function FAQItem({ q, a }: FAQ) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#E8D4A0]/60 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left bg-white hover:bg-[#FAF5EE] transition-colors"
      >
        <span className="text-[#2A1F1B] font-semibold text-sm pr-4">{q}</span>
        <ChevronDown
          className={`w-4 h-4 text-[#C5A46D] flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-6 pb-5 bg-[#FFFCF7]">
          <p className="text-[#6B5B4D] text-sm leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function CityPageClient({ cityName, stateName, faqs, heroImage }: Props) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    async function fetchVendors() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ city: cityName, sort: 'rating' });
        if (activeCategory !== 'all') params.set('category', activeCategory);
        const res = await fetch(`/api/vendors?${params}`);
        const data = await res.json();
        setVendors(data.data ?? []);
      } finally {
        setLoading(false);
      }
    }
    fetchVendors();
  }, [cityName, activeCategory]);

  return (
    <div className="min-h-screen bg-[#FFFCF7]">
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div className="relative h-[380px] md:h-[460px] overflow-hidden">
        <Image
          src={heroImage}
          alt={`Wedding vendors in ${cityName}`}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1C1208]/55 via-[#1C1208]/35 to-[#1C1208]/75" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <p className="text-[#C5A46D] text-[10px] font-semibold tracking-[0.22em] uppercase mb-3">
            ShaadiShopping · {stateName}
          </p>
          <h1
            className="text-white text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight"
            style={{ fontFamily: 'var(--font-playfair, serif)' }}
          >
            Wedding Vendors<br />in {cityName}
          </h1>
          <p className="text-white/80 text-sm md:text-base max-w-lg mb-7">
            Verified venues, makeup artists, caterers, decorators & more — all in one place
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            <Link
              href="/plan"
              className="inline-flex items-center gap-2 bg-[#8B1A4A] hover:bg-[#6D1239] text-white text-sm font-semibold px-7 py-3 rounded-full transition-all duration-300 shadow-lg"
            >
              Start Planning <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              href={`/categories/venue?city=${cityName}`}
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white text-sm font-semibold px-7 py-3 rounded-full backdrop-blur-sm transition-all duration-300"
            >
              View Venues
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        {/* ── Category Quick-Links ─────────────────────────────────────────── */}
        <section className="mb-14">
          <h2
            className="text-[#2A1F1B] text-2xl md:text-3xl font-bold mb-2 text-center"
            style={{ fontFamily: 'var(--font-playfair, serif)' }}
          >
            Browse by Category
          </h2>
          <p className="text-center text-[#6B5B4D] text-sm mb-8">
            All categories pre-filtered for {cityName}
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-3">
            {QUICK_CATS.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.id}?city=${cityName}`}
                className="flex flex-col items-center gap-2 p-3 rounded-xl border border-[#E8D4A0]/70 bg-white hover:bg-[#FAF5EE] hover:border-[#C5A46D]/60 hover:scale-105 transition-all duration-200 shadow-sm"
              >
                <span className="text-2xl">{cat.icon}</span>
                <span className="text-[9px] font-semibold text-[#2A1F1B] text-center leading-tight">
                  {cat.label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Vendor Grid ─────────────────────────────────────────────────── */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h2
              className="text-[#2A1F1B] text-2xl md:text-3xl font-bold"
              style={{ fontFamily: 'var(--font-playfair, serif)' }}
            >
              Top Vendors in {cityName}
            </h2>
          </div>

          {/* Category filter tabs */}
          <div className="flex gap-2 flex-wrap mb-7">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`text-[11px] font-semibold px-4 py-2 rounded-full border transition-all duration-200 ${
                  activeCategory === tab.id
                    ? 'bg-[#8B1A4A] text-white border-[#8B1A4A] shadow-sm'
                    : 'bg-white text-[#6B5B4D] border-[#E8D4A0] hover:border-[#C5A46D]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl h-72 animate-pulse border border-gray-100" />
              ))}
            </div>
          ) : vendors.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-4xl mb-4">🔍</p>
              <p className="text-lg font-medium text-[#2A1F1B] mb-1">
                No {activeCategory === 'all' ? '' : activeCategory + ' '}vendors in {cityName} yet
              </p>
              <p className="text-sm">We&apos;re adding vendors every week. Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vendors.map((vendor) => (
                <VendorCard key={vendor.id} vendor={vendor} />
              ))}
            </div>
          )}
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        {faqs.length > 0 && (
          <section className="mb-14">
            <h2
              className="text-[#2A1F1B] text-2xl md:text-3xl font-bold mb-2 text-center"
              style={{ fontFamily: 'var(--font-playfair, serif)' }}
            >
              Frequently Asked Questions
            </h2>
            <p className="text-center text-[#6B5B4D] text-sm mb-8">
              Wedding planning in {cityName}, {stateName}
            </p>
            <div className="max-w-3xl mx-auto space-y-3">
              {faqs.map((faq, i) => (
                <FAQItem key={i} q={faq.q} a={faq.a} />
              ))}
            </div>
          </section>
        )}

        {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
        <section className="rounded-3xl overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-[#8B1A4A] to-[#5C1230]" />
          <div
            className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, #C5A46D 0%, transparent 60%)' }}
          />
          <div className="relative z-10 text-center px-6 py-14">
            <p className="text-[#C5A46D] text-[10px] font-semibold tracking-[0.22em] uppercase mb-3">
              Free Expert Consultation
            </p>
            <h3
              className="text-white text-3xl md:text-4xl font-bold mb-3"
              style={{ fontFamily: 'var(--font-playfair, serif)' }}
            >
              Plan Your {cityName} Wedding
            </h3>
            <p className="text-white/70 text-sm max-w-md mx-auto mb-8">
              Our local experts know {cityName}&apos;s best vendors, muhurats, and budgets.
              Get personalised advice — completely free.
            </p>
            <Link
              href="/plan"
              className="inline-flex items-center gap-2 bg-[#C5A46D] hover:bg-[#B8934A] text-white text-sm font-semibold px-8 py-4 rounded-full transition-all duration-300 shadow-xl"
            >
              Begin Planning <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
