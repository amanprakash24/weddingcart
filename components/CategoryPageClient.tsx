'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Search, MapPin, SlidersHorizontal, Star, ChevronDown, X, ChevronRight, Grid, List } from 'lucide-react';
import { Vendor, Category } from '@/types';
import VendorCard from './VendorCard';

const CATEGORY_INFO: Record<string, { name: string; desc: string; image: string }> = {
  venue: { name: 'Wedding Venues', desc: 'Find the perfect venue for your dream wedding', image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1920&q=80' },
  makeup: { name: 'Makeup Artists', desc: 'Professional bridal makeup for your special day', image: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1920&q=80' },
  mehndi: { name: 'Mehndi Artists', desc: 'Intricate mehndi designs for brides and guests', image: 'https://images.unsplash.com/photo-1591824353446-b4d49d58b8b7?w=1920&q=80' },
  decorator: { name: 'Wedding Decorators', desc: 'Transform your venue with stunning decor', image: 'https://images.unsplash.com/photo-1478146059778-26028b07395a?w=1920&q=80' },
  band: { name: 'Band & Music', desc: 'Live bands for unforgettable wedding celebrations', image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1920&q=80' },
  dj: { name: 'DJ Services', desc: 'Expert DJs to keep your dance floor rocking', image: 'https://images.unsplash.com/photo-1571266028243-d220c6a8c270?w=1920&q=80' },
  catering: { name: 'Catering Services', desc: 'Exquisite cuisine for every palate', image: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=1920&q=80' },
  'photo-video': { name: 'Photo & Video', desc: 'Capture every precious moment beautifully', image: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=1920&q=80' },
};

const CITIES = ['All Cities', 'Patna', 'Delhi', 'Mumbai', 'Jaipur', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Udaipur', 'Goa'];
const SORTS = [
  { value: 'rating', label: 'Top Rated' },
  { value: 'reviews', label: 'Most Reviewed' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
];

interface Props {
  slug: string;
  initialCoverImage?: string;
  initialName?: string;
  initialDescription?: string;
}

export default function CategoryPageClient({ slug, initialCoverImage, initialName, initialDescription }: Props) {
  const searchParams = useSearchParams();
  const info = CATEGORY_INFO[slug] || { name: slug, desc: '', image: '' };

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [city, setCity] = useState(searchParams.get('city') || 'All Cities');
  const [sort, setSort] = useState('rating');
  const [minRating, setMinRating] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ category: slug, sort });
      if (city !== 'All Cities') params.set('city', city);
      if (search) params.set('search', search);
      if (minRating) params.set('minRating', minRating);

      const [vRes, cRes] = await Promise.all([
        fetch(`/api/vendors?${params}`),
        fetch(`/api/categories/${slug}`),
      ]);
      const [vData, cData] = await Promise.all([vRes.json(), cRes.json()]);
      if (vData.success) setVendors(vData.data);
      if (cData.success) setCategory(cData.data);
    } catch {
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, [slug, city, search, sort, minRating]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const clearFilters = () => {
    setSearch(''); setCity('All Cities'); setSort('rating'); setMinRating('');
  };
  const hasFilters = search || city !== 'All Cities' || minRating;

  return (
    <div>
      {/* Hero */}
      <section className="relative h-64 sm:h-80 flex items-end overflow-hidden">
        <div className="absolute inset-0">
          {(initialCoverImage || category?.image || info.image) ? (
            <Image
              src={initialCoverImage || category?.image || info.image}
              alt={initialName || category?.name || info.name}
              fill
              sizes="100vw"
              className="object-cover"
              priority
              fetchPriority="high"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-rose-900 to-pink-800" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
        </div>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-white/70 text-sm mb-3">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white">{initialName || category?.name || info.name}</span>
          </nav>
          <h1 className="text-3xl sm:text-4xl font-bold text-white font-[Playfair_Display,serif]">{initialName || category?.name || info.name}</h1>
          <p className="text-white/80 text-sm mt-1">{initialDescription || category?.description || info.desc}</p>
          {category && (
            <div className="flex items-center gap-4 mt-3">
              <span className="bg-white/20 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full">
                {vendors.length} vendors found
              </span>
              {city !== 'All Cities' && (
                <span className="bg-amber-500/80 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {city}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Filters */}
      <div className="sticky top-16 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 flex-1 min-w-48 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200 focus-within:border-amber-400 transition-colors">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder={`Search ${info.name}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* City */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200 min-w-36">
              <MapPin className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <select value={city} onChange={(e) => setCity(e.target.value)} className="bg-transparent text-sm text-gray-700 outline-none cursor-pointer">
                {CITIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200">
              <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-transparent text-sm text-gray-700 outline-none cursor-pointer">
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            {/* More filters toggle */}
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                showFilters ? 'bg-amber-500 border-amber-500 text-white' : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-amber-300'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </button>

            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-rose-500 font-medium hover:underline flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Clear all
              </button>
            )}

            {/* View toggle */}
            <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-400'}`}>
                <Grid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-400'}`}>
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Extended filters */}
          {showFilters && (
            <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-100 mt-3 animate-fade-in">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 font-medium">Min. Rating:</label>
                <div className="flex gap-1">
                  {['', '4', '4.5', '4.8'].map((r) => (
                    <button
                      key={r}
                      onClick={() => setMinRating(r)}
                      className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                        minRating === r ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-200 text-gray-600 hover:border-amber-300'
                      }`}
                    >
                      {r ? <><Star className="w-3 h-3" />{r}+</> : 'All'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Vendors Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className={`grid gap-5 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-80 rounded-2xl" />)}
          </div>
        ) : vendors.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-gray-700 font-semibold text-xl mb-2">No vendors found</h3>
            <p className="text-gray-400 mb-6">Try adjusting your filters or search terms.</p>
            <button onClick={clearFilters} className="bg-gradient-to-r from-amber-500 to-rose-500 text-white px-6 py-2.5 rounded-full text-sm font-semibold">
              Clear Filters
            </button>
          </div>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-5">{vendors.length} vendors found</p>
            <div className={`grid gap-5 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {vendors.map((vendor) => <VendorCard key={vendor.id} vendor={vendor} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
