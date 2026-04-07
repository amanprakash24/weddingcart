'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Search, MapPin, Star, ChevronLeft, ChevronRight, CheckCircle, Heart, Users, Award, ArrowRight, Sparkles, Phone } from 'lucide-react';
import { Vendor, Category } from '@/types';
import VendorCard from './VendorCard';
import CategoryCard from './CategoryCard';

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1920&q=90',
  'https://images.unsplash.com/photo-1502635385003-ee1e6a1a742d?w=1920&q=90',
  'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1920&q=90',
  'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=1920&q=90',
];

const CITIES = ['All Cities', 'Patna', 'Delhi', 'Mumbai', 'Jaipur', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Udaipur', 'Goa'];

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: Search,
    title: 'Discover & Compare',
    desc: 'Browse hundreds of verified vendors across categories. Read reviews, compare packages, and shortlist your favourites.',
    color: 'from-amber-400 to-amber-600',
    bg: 'bg-amber-50',
  },
  {
    step: '02',
    icon: Heart,
    title: 'Build Your Plan',
    desc: 'Add vendors to your wedding plan, mix and match packages, and get a consolidated view of your entire wedding budget.',
    color: 'from-rose-400 to-rose-600',
    bg: 'bg-rose-50',
  },
  {
    step: '03',
    icon: CheckCircle,
    title: 'Book & Celebrate',
    desc: 'Our expert planners confirm bookings, coordinate with vendors, and ensure your special day is absolutely perfect.',
    color: 'from-emerald-400 to-emerald-600',
    bg: 'bg-emerald-50',
  },
];

export default function HomepageClient() {
  const [heroIdx, setHeroIdx] = useState(0);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('All Cities');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredVendors, setFeaturedVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorPage, setVendorPage] = useState(0);
  const CARDS_PER_PAGE = 4;

  // Hero auto-rotate
  useEffect(() => {
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % HERO_IMAGES.length), 5000);
    return () => clearInterval(t);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [catRes, vendorRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/vendors?limit=50'),
      ]);
      const [catData, vendorData] = await Promise.all([catRes.json(), vendorRes.json()]);

      if (catData.success) setCategories(catData.data);
      if (vendorData.success) {
        setVendors(vendorData.data);
        setFeaturedVendors(vendorData.data.filter((v: Vendor) => v.isFeatured).slice(0, 8));
      }
    } catch {
      // Use empty arrays if API fails
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (city !== 'All Cities') params.set('city', city);
    window.location.href = `/categories/venue?${params.toString()}`;
  };

  const filteredVendors = vendors
    .filter((v) => {
      const matchSearch = !search || v.name.toLowerCase().includes(search.toLowerCase()) || v.city.toLowerCase().includes(search.toLowerCase());
      const matchCity = city === 'All Cities' || v.city === city;
      return matchSearch && matchCity;
    })
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 12);

  const pagedVendors = filteredVendors.slice(vendorPage * CARDS_PER_PAGE, vendorPage * CARDS_PER_PAGE + CARDS_PER_PAGE);
  const totalPages = Math.ceil(filteredVendors.length / CARDS_PER_PAGE);

  return (
    <div>
      {/* ── HERO ── */}
      <section className="relative h-screen min-h-[600px] max-h-[900px] flex items-center overflow-hidden">
        {/* Background images — pointer-events-none so they never steal taps from the fixed navbar */}
        {HERO_IMAGES.map((src, i) => (
          <div
            key={src}
            className={`absolute inset-0 transition-opacity duration-1000 pointer-events-none ${i === heroIdx ? 'opacity-100' : 'opacity-0'}`}
          >
            <Image src={src} alt="Wedding" fill priority={i === 0} sizes="100vw" className="object-cover" />
          </div>
        ))}
        <div className="absolute inset-0 hero-overlay pointer-events-none" />

        {/* Hero dots */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {HERO_IMAGES.map((_, i) => (
            <button
              key={i}
              onClick={() => setHeroIdx(i)}
              className={`transition-all duration-300 rounded-full ${i === heroIdx ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/50'}`}
            />
          ))}
        </div>

        {/* Hero content */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
          <div className="max-w-3xl">
            {/* Pill */}
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/30 text-white px-4 py-1.5 rounded-full text-sm font-medium mb-6 animate-fade-in">
              <Sparkles className="w-4 h-4 text-amber-300" />
              India&apos;s Most Trusted Wedding Marketplace
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-[1.1] mb-6 animate-slide-up font-[Playfair_Display,serif]">
              Plan Your{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-rose-300">
                Dream Wedding
              </span>
              <br />with Ease
            </h1>

            <p className="text-white/80 text-lg sm:text-xl mb-8 max-w-xl animate-slide-up animation-delay-200">
              Discover and book top-rated venues, photographers, caterers, makeup artists and more — all in one place.
            </p>

            {/* Plan Your Wedding button */}
            <div className="animate-slide-up animation-delay-300">
              <Link
                href="/plan"
                className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-500 to-rose-500 text-white px-8 py-4 rounded-2xl font-semibold text-lg shadow-2xl hover:opacity-90 hover:scale-105 transition-all"
              >
                <Sparkles className="w-5 h-5" />
                Plan Your Wedding
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-6 mt-8 animate-slide-up animation-delay-400">
              {[
                { icon: Users, label: '10,000+ Couples', sub: 'Trust Us' },
                { icon: Award, label: '500+ Vendors', sub: 'Verified' },
                { icon: MapPin, label: '25+ Cities', sub: 'Covered' },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-white/15 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{label}</p>
                    <p className="text-white/60 text-xs">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CATEGORIES ── */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-amber-600 text-sm font-semibold uppercase tracking-wider mb-2">Browse by Category</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 font-[Playfair_Display,serif]">
              Everything You Need for Your{' '}
              <span className="gradient-text">Special Day</span>
            </h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton aspect-[4/5] rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {categories.map((cat) => (
                <CategoryCard key={cat.id} category={cat} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── SPECIAL / ON-DEMAND SERVICES ── */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-rose-50 to-amber-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-rose-500 text-sm font-semibold uppercase tracking-wider mb-2">On-Demand</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 font-[Playfair_Display,serif]">
              Special Services <span className="gradient-text">Offered by Us</span>
            </h2>
            <p className="text-gray-500 mt-2 text-sm">Additional services we arrange exclusively for your wedding — just tell us what you need</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { icon: '🛏️', label: 'Accommodation', desc: 'Guest stay arrangements near your venue', id: 'accommodation' },
              { icon: '🎁', label: 'Gifts & Hampers', desc: 'Curated return gifts and wedding hampers', id: 'gifts' },
              { icon: '✉️', label: 'Invitations & Stationery', desc: 'Printed & digital wedding invitation suites', id: 'invitations' },
              { icon: '🚗', label: 'Transportation', desc: 'Luxury cars and guest fleet management', id: 'transport' },
              { icon: '📋', label: 'Legal & Documentation', desc: 'Marriage registration and paperwork help', id: 'legal' },
              { icon: '🤝', label: 'Hospitality', desc: 'End-to-end guest management & coordination', id: 'hospitality' },
              { icon: '📝', label: 'Wedding Planning & Coordination', desc: 'Full-service planners for every detail', id: 'planning' },
              { icon: '🔮', label: 'Astrologers & Pandits', desc: 'Muhurat, kundali & religious ceremony experts', id: 'astro' },
              { icon: '👗', label: 'Bridal Lehenga', desc: 'Exquisite lehengas, sarees & bridal outfits', id: 'bridal-lehenga' },
              { icon: '💍', label: 'Bridal Jewellery', desc: 'Traditional gold, kundan & diamond jewellery sets', id: 'bridal-jewellery' },
              { icon: '🤵', label: 'Sherwani / Groom Wear', desc: 'Royal sherwanis, bandhgalas & Indo-western outfits', id: 'sherwani' },
              { icon: '🎀', label: 'Trousseau Packing', desc: 'Creative & elegant trousseau packing services', id: 'trousseau' },
            ].map((svc) => (
              <Link
                key={svc.id}
                href="/plan"
                className="group bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-amber-300 transition-all flex flex-col gap-3"
              >
                <div className="w-12 h-12 bg-amber-50 group-hover:bg-amber-100 rounded-xl flex items-center justify-center text-2xl transition-colors">
                  {svc.icon}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm leading-tight mb-1 group-hover:text-amber-600 transition-colors">{svc.label}</p>
                  <p className="text-gray-400 text-xs leading-relaxed">{svc.desc}</p>
                </div>
                <div className="mt-auto flex items-center gap-1 text-amber-600 text-xs font-semibold">
                  Add to Plan <ArrowRight className="w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              href="/plan"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white px-8 py-3.5 rounded-full font-semibold hover:opacity-90 transition-all hover:shadow-lg text-sm"
            >
              <Sparkles className="w-4 h-4" /> Start Planning Your Wedding
            </Link>
          </div>
        </div>
      </section>

      {/* ── TOP-RATED VENDORS ── */}
      <section className="py-16 sm:py-20 bg-[#FFFAF5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-rose-500 text-sm font-semibold uppercase tracking-wider mb-2">Top Picks</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 font-[Playfair_Display,serif]">
                Top-Rated Vendors
              </h2>
              <p className="text-gray-500 mt-2 text-sm">Handpicked vendors loved by thousands of couples</p>
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setVendorPage((p) => Math.max(0, p - 1))}
                  disabled={vendorPage === 0}
                  className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:border-amber-400 hover:text-amber-600 disabled:opacity-40 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-500">{vendorPage + 1} / {totalPages}</span>
                <button
                  onClick={() => setVendorPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={vendorPage >= totalPages - 1}
                  className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:border-amber-400 hover:text-amber-600 disabled:opacity-40 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* City & Search filter strip */}
          <div className="flex flex-wrap gap-2 mb-8">
            {CITIES.map((c) => (
              <button
                key={c}
                onClick={() => { setCity(c); setVendorPage(0); }}
                className={`text-xs font-semibold px-4 py-1.5 rounded-full border transition-all ${
                  city === c
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-600'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-80 rounded-2xl" />
              ))}
            </div>
          ) : pagedVendors.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {pagedVendors.map((vendor) => (
                <VendorCard key={vendor.id} vendor={vendor} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg">No vendors found for the selected filters.</p>
              <button onClick={() => { setSearch(''); setCity('All Cities'); }} className="mt-4 text-amber-600 font-semibold hover:underline text-sm">
                Clear filters
              </button>
            </div>
          )}

          <div className="text-center mt-10">
            <Link
              href="/categories/venue"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white px-8 py-3.5 rounded-full font-semibold hover:opacity-90 transition-all hover:shadow-lg text-sm"
            >
              View All Vendors <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>


      {/* ── FEATURED (Top Rated) ── */}
      {featuredVendors.length > 0 && (
        <section className="py-16 sm:py-20 bg-gradient-to-br from-amber-50 to-rose-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <p className="text-amber-600 text-sm font-semibold uppercase tracking-wider mb-2">Featured</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 font-[Playfair_Display,serif]">
                Our <span className="gradient-text">Editors&apos; Choice</span>
              </h2>
              <p className="text-gray-500 mt-2 text-sm">Exceptional vendors with consistently outstanding reviews</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {featuredVendors.slice(0, 4).map((v) => (
                <div key={v.id} className="relative">
                  <div className="absolute -top-3 left-4 z-10 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" /> Editor&apos;s Choice
                  </div>
                  <VendorCard vendor={v} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── HOW IT WORKS ── */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-emerald-600 text-sm font-semibold uppercase tracking-wider mb-2">Simple Process</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 font-[Playfair_Display,serif]">
              How WeddingCart <span className="gradient-text">Works</span>
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm">
              From discovery to your dream day — we handle every detail so you can focus on celebrating.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-16 left-1/3 right-1/3 h-0.5 bg-gradient-to-r from-amber-300 via-rose-300 to-emerald-300 z-0" />

            {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc, color, bg }, i) => (
              <div key={step} className={`relative text-center animate-slide-up animation-delay-${(i + 1) * 200}`}>
                <div className={`relative inline-flex items-center justify-center w-24 h-24 rounded-3xl ${bg} mb-6 mx-auto`}>
                  <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white text-xs font-bold shadow-lg`}>
                    {step}
                  </div>
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 font-[Playfair_Display,serif]">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-16 sm:py-20 bg-[#FFFAF5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-rose-500 text-sm font-semibold uppercase tracking-wider mb-2">Couples Love Us</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 font-[Playfair_Display,serif]">
              Happy Couples, <span className="gradient-text">Perfect Weddings</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: 'Priya & Rahul',
                city: 'Delhi', rating: 5,
                text: 'WeddingCart made our wedding planning so effortless! We found our dream venue, photographer, and caterer all in one place. The vendors were professional and delivered beyond expectations.',
                image: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=200&q=80',
              },
              {
                name: 'Ananya & Vikram',
                city: 'Mumbai', rating: 5,
                text: 'Absolutely love WeddingCart! The comparison feature helped us find vendors within our budget. The planning wizard saved us weeks of research. Our wedding was a fairy tale!',
                image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=200&q=80',
              },
              {
                name: 'Sneha & Arjun',
                city: 'Jaipur', rating: 4,
                text: 'From mehndi to photography, WeddingCart had the perfect vendors for our royal Rajasthani wedding. The team was helpful throughout. Couldn\'t have asked for a better experience!',
                image: 'https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=200&q=80',
              },
            ].map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-5 italic">&quot;{t.text}&quot;</p>
                <div className="flex items-center gap-3">
                  <div className="relative w-11 h-11 rounded-full overflow-hidden flex-shrink-0">
                    <Image src={t.image} alt={t.name} fill sizes="44px" className="object-cover" />
                  </div>
                  <div>
                    <p className="text-gray-900 font-semibold text-sm">{t.name}</p>
                    <p className="text-gray-400 text-xs">{t.city}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-20 sm:py-24 overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1478146059778-26028b07395a?w=1920&q=80"
            alt="Wedding decoration"
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950/90 to-gray-900/70" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-2xl mx-auto">
            <p className="text-amber-300 text-sm font-semibold uppercase tracking-wider mb-4">Start Today — It&apos;s Free</p>
            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-5 font-[Playfair_Display,serif]">
              Ready to Plan Your{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-rose-300">
                Dream Wedding?
              </span>
            </h2>
            <p className="text-white/70 text-base mb-8">
              Join 10,000+ couples who planned their perfect wedding with WeddingCart. Get expert guidance, compare vendors, and book with confidence.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/plan"
                className="bg-gradient-to-r from-amber-500 to-rose-500 text-white font-bold px-8 py-4 rounded-full hover:opacity-90 transition-all hover:shadow-2xl text-sm"
              >
                Start Planning — Free
              </Link>
              <a
                href="tel:+917070486987"
                className="flex items-center justify-center gap-2 bg-white/15 backdrop-blur-sm border border-white/30 text-white font-semibold px-8 py-4 rounded-full hover:bg-white/25 transition-all text-sm"
              >
                <Phone className="w-4 h-4" />
                Talk to an Expert
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
