'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Clock, ArrowRight, BookOpen, ChevronLeft, ChevronRight, User } from 'lucide-react';

interface Blog {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  author: string;
  category: string;
  publishedAt: string | null;
  readTime: number;
}

const CATEGORIES = [
  'All', 'Wedding Tips', 'Venue Guides', 'Bridal Fashion',
  'Real Weddings', 'Budget Planning', 'Traditions & Culture',
  'Destination Weddings', 'Food & Catering', 'Décor & Flowers', 'Photography',
];

const CATEGORY_COLORS: Record<string, { pill: string; badge: string }> = {
  'Wedding Tips':         { pill: 'bg-amber-500 text-white',         badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  'Venue Guides':         { pill: 'bg-rose-500 text-white',          badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  'Bridal Fashion':       { pill: 'bg-purple-500 text-white',        badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  'Real Weddings':        { pill: 'bg-pink-500 text-white',          badge: 'bg-pink-50 text-pink-700 border-pink-200' },
  'Budget Planning':      { pill: 'bg-emerald-500 text-white',       badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'Traditions & Culture': { pill: 'bg-orange-500 text-white',        badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  'Destination Weddings': { pill: 'bg-blue-500 text-white',          badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  'Food & Catering':      { pill: 'bg-yellow-500 text-white',        badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  'Décor & Flowers':      { pill: 'bg-teal-500 text-white',          badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  'Photography':          { pill: 'bg-indigo-500 text-white',        badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
};

const CATEGORY_ICONS: Record<string, string> = {
  'Wedding Tips':         '💡',
  'Venue Guides':         '🏛️',
  'Bridal Fashion':       '👗',
  'Real Weddings':        '💍',
  'Budget Planning':      '💰',
  'Traditions & Culture': '🪔',
  'Destination Weddings': '✈️',
  'Food & Catering':      '🍽️',
  'Décor & Flowers':      '🌸',
  'Photography':          '📷',
};

function getCategoryBadge(cat: string) {
  return CATEGORY_COLORS[cat]?.badge ?? 'bg-gray-100 text-gray-600 border-gray-200';
}

function formatDate(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function BlogCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
      <div className="aspect-[16/10] bg-gray-200" />
      <div className="p-5 space-y-3">
        <div className="h-3 bg-gray-100 rounded w-1/4" />
        <div className="h-5 bg-gray-200 rounded w-4/5" />
        <div className="h-4 bg-gray-100 rounded w-full" />
        <div className="h-4 bg-gray-100 rounded w-3/4" />
        <div className="flex gap-3 pt-2">
          <div className="h-3 bg-gray-100 rounded w-1/4" />
          <div className="h-3 bg-gray-100 rounded w-1/4" />
        </div>
      </div>
    </div>
  );
}

function FeaturedCard({ blog }: { blog: Blog }) {
  return (
    <Link
      href={`/blog/${blog.slug}`}
      className="group grid grid-cols-1 lg:grid-cols-2 bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] lg:aspect-auto overflow-hidden bg-gradient-to-br from-amber-100 to-rose-100">
        {blog.coverImage ? (
          <Image
            src={blog.coverImage}
            alt={blog.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
            unoptimized
            priority
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-950 via-rose-950 to-gray-900">
            <BookOpen className="w-16 h-16 text-white/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        <span className="absolute top-4 left-4 bg-amber-500 text-white text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
          Featured
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-col justify-center p-8 lg:p-10">
        <span className={`inline-flex self-start text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border mb-4 ${getCategoryBadge(blog.category)}`}>
          {blog.category}
        </span>
        <h2 className="font-[Playfair_Display,serif] font-bold text-gray-900 text-2xl lg:text-3xl leading-snug mb-4 group-hover:text-amber-700 transition-colors">
          {blog.title}
        </h2>
        {blog.excerpt && (
          <p className="text-gray-500 text-sm leading-relaxed mb-6 line-clamp-3">{blog.excerpt}</p>
        )}
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 mb-6">
          <span className="flex items-center gap-1.5 font-medium text-gray-600">
            <User className="w-3.5 h-3.5" /> {blog.author}
          </span>
          {blog.publishedAt && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> {formatDate(blog.publishedAt)}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> {blog.readTime} min read
          </span>
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700 group-hover:gap-3 transition-all">
          Read Article <ArrowRight className="w-4 h-4" />
        </span>
      </div>
    </Link>
  );
}

function BlogCard({ blog }: { blog: Blog }) {
  return (
    <Link
      href={`/blog/${blog.slug}`}
      className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-amber-50 to-rose-50">
        {blog.coverImage ? (
          <Image
            src={blog.coverImage}
            alt={blog.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-100 to-rose-100">
            <BookOpen className="w-10 h-10 text-amber-300" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5">
        <span className={`inline-flex self-start text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border mb-3 ${getCategoryBadge(blog.category)}`}>
          {blog.category}
        </span>
        <h3 className="font-[Playfair_Display,serif] font-bold text-gray-900 text-base leading-snug mb-2.5 line-clamp-2 group-hover:text-amber-700 transition-colors flex-1">
          {blog.title}
        </h3>
        {blog.excerpt && (
          <p className="text-gray-500 text-[13px] leading-relaxed mb-4 line-clamp-2">{blog.excerpt}</p>
        )}
        <div className="flex items-center gap-3 text-[11px] text-gray-400 pt-3 border-t border-gray-50 mt-auto">
          <span className="font-medium text-gray-500 truncate max-w-[80px]">{blog.author}</span>
          <span className="w-0.5 h-0.5 rounded-full bg-gray-300 flex-shrink-0" />
          {blog.publishedAt && <span className="flex items-center gap-1">{formatDate(blog.publishedAt)}</span>}
          <span className="w-0.5 h-0.5 rounded-full bg-gray-300 flex-shrink-0" />
          <span className="flex items-center gap-1 flex-shrink-0">
            <Clock className="w-3 h-3" /> {blog.readTime} min
          </span>
        </div>
      </div>
    </Link>
  );
}

const VENDOR_OPTIONS = [
  { label: 'Wedding Venues',               slug: 'venue' },
  { label: 'Bridal Makeup Artists',        slug: 'makeup' },
  { label: 'Mehndi Artists',               slug: 'mehndi' },
  { label: 'Wedding Decorators',           slug: 'decorator' },
  { label: 'Wedding Photographers',        slug: 'photo-video' },
  { label: 'Wedding Caterers',             slug: 'catering' },
  { label: 'Wedding DJ',                   slug: 'dj' },
  { label: 'Wedding Band & Music',         slug: 'band' },
  { label: 'Wedding Planners',             slug: 'planning' },
  { label: 'Wedding Invitations',          slug: 'invitations' },
  { label: 'Bridal Lehenga',              slug: 'bridal-lehenga' },
  { label: 'Bridal Jewellery',            slug: 'bridal-jewellery' },
  { label: 'Sherwani & Groom Wear',       slug: 'sherwani' },
  { label: 'Wedding Transport',            slug: 'transport' },
  { label: 'Wedding Gifts',               slug: 'gifts' },
];

function VendorSearchWidget() {
  const router = useRouter();
  const [selected, setSelected] = useState('venue');

  return (
    <section className="my-16">
      <div className="relative bg-white border border-[#C5A46D]/30 rounded-2xl px-6 sm:px-14 py-10 text-center shadow-sm">

        {/* Decorative corner lines — top */}
        <div className="absolute top-0 left-0 right-0 flex items-center pointer-events-none" style={{ transform: 'translateY(-1px)' }}>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#C5A46D]/60 to-[#C5A46D]/60 ml-8 mr-4" />
          <div className="flex-1 h-px bg-gradient-to-l from-transparent via-[#C5A46D]/60 to-[#C5A46D]/60 ml-4 mr-8" />
        </div>

        {/* Decorative corner lines — bottom */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center pointer-events-none" style={{ transform: 'translateY(1px)' }}>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#C5A46D]/60 to-[#C5A46D]/60 ml-8 mr-4" />
          <div className="flex-1 h-px bg-gradient-to-l from-transparent via-[#C5A46D]/60 to-[#C5A46D]/60 ml-4 mr-8" />
        </div>

        <h2 className="font-[Playfair_Display,serif] text-2xl sm:text-3xl font-bold text-gray-900 mb-8 leading-snug">
          Find the best wedding vendors with<br className="hidden sm:block" /> thousands of trusted reviews
        </h2>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-0 mb-8">
          <span className="text-gray-600 font-medium text-base sm:mr-4 whitespace-nowrap">I am looking for</span>
          <div className="relative">
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              className="appearance-none bg-transparent border-0 border-b-2 border-gray-400 focus:border-[#8B1A4A] outline-none text-gray-800 font-medium text-base pb-1 pr-7 pl-1 cursor-pointer transition-colors min-w-[220px]"
            >
              {VENDOR_OPTIONS.map(opt => (
                <option key={opt.slug} value={opt.slug}>{opt.label}</option>
              ))}
            </select>
            <span className="absolute right-0 bottom-1.5 text-gray-500 pointer-events-none text-sm font-semibold">∨</span>
          </div>
        </div>

        <button
          onClick={() => router.push(`/categories/${selected}`)}
          className="bg-[#8B1A4A] hover:bg-[#7a1640] text-white font-semibold px-10 py-3 rounded-full text-base transition-all hover:shadow-lg hover:shadow-[#8B1A4A]/30"
        >
          Search
        </button>
      </div>
    </section>
  );
}

function BrowseByCategory({ onSelect }: { onSelect: (cat: string) => void }) {
  return (
    <section className="mt-20 mb-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-amber-600 text-xs font-bold uppercase tracking-widest mb-1">Explore</p>
          <h2 className="font-[Playfair_Display,serif] text-2xl font-bold text-gray-900">Browse by Category</h2>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {CATEGORIES.filter(c => c !== 'All').map(cat => (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className="group flex flex-col items-center gap-2 bg-white border border-gray-100 rounded-2xl p-4 hover:border-amber-300 hover:shadow-md transition-all duration-200 text-center"
          >
            <span className="text-2xl">{CATEGORY_ICONS[cat] ?? '📝'}</span>
            <span className="text-xs font-semibold text-gray-700 group-hover:text-amber-700 transition-colors leading-tight">{cat}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function BlogListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get('category') ?? 'All';
  const page = parseInt(searchParams.get('page') ?? '1');

  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const cat = category === 'All' ? '' : category;
    fetch(`/api/blogs?category=${encodeURIComponent(cat)}&page=${page}&limit=9`)
      .then(r => r.json())
      .then(data => {
        setBlogs(data.blogs ?? []);
        setTotal(data.total ?? 0);
        setPages(data.pages ?? 1);
      })
      .finally(() => setLoading(false));
  }, [category, page]);

  const setFilter = (cat: string) => {
    const params = new URLSearchParams();
    if (cat !== 'All') params.set('category', cat);
    router.push(`/blog?${params.toString()}`);
  };

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`/blog?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [featured, ...rest] = blogs;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">

      {/* ── Hero ── */}
      <section className="bg-white border-b border-gray-100 pt-28 pb-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-amber-600 text-xs font-bold uppercase tracking-widest mb-3">ShaadiShopping Journal</p>
            <h1 className="font-[Playfair_Display,serif] text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-4">
              Wedding Stories,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-rose-500">
                Tips & Inspiration
              </span>
            </h1>
            <p className="text-gray-500 text-base leading-relaxed">
              Expert guides, real wedding stories and trend reports for couples planning their dream wedding across India.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Category filter ── */}
        <div className="flex flex-wrap gap-2 mb-10">
          {CATEGORIES.map(cat => {
            const active = category === cat;
            const color = CATEGORY_COLORS[cat]?.pill ?? 'bg-gray-800 text-white';
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                  active
                    ? (cat === 'All' ? 'bg-gray-900 text-white shadow-sm' : `${color} shadow-sm`)
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
              <div className="aspect-[4/3] bg-gray-200" />
              <div className="p-10 space-y-4">
                <div className="h-3 bg-gray-100 rounded w-1/4" />
                <div className="h-8 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-100 rounded w-full" />
                <div className="h-4 bg-gray-100 rounded w-5/6" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => <BlogCardSkeleton key={i} />)}
            </div>
          </div>
        ) : blogs.length === 0 ? (
          <div className="text-center py-32">
            <BookOpen className="w-14 h-14 text-gray-200 mx-auto mb-5" />
            <h3 className="font-[Playfair_Display,serif] text-xl font-bold text-gray-700 mb-2">No posts yet</h3>
            <p className="text-gray-400 text-sm">
              {category !== 'All' ? `No posts in "${category}" yet.` : 'Check back soon for wedding inspiration.'}
            </p>
            {category !== 'All' && (
              <button onClick={() => setFilter('All')} className="mt-5 text-sm text-amber-600 font-semibold hover:underline">
                Browse all posts →
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Featured post */}
            {page === 1 && featured && (
              <div className="mb-10">
                <FeaturedCard blog={featured} />
              </div>
            )}

            {/* Grid */}
            {rest.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                {(page === 1 ? rest : blogs).map(blog => (
                  <BlogCard key={blog._id} blog={blog} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-2 py-4">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 text-gray-600 text-sm font-medium hover:border-amber-400 hover:text-amber-600 disabled:opacity-40 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <span className="px-4 py-2 text-sm text-gray-500">
                  Page {page} of {pages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === pages}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 text-gray-600 text-sm font-medium hover:border-amber-400 hover:text-amber-600 disabled:opacity-40 transition-all"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Vendor search widget */}
        {!loading && blogs.length > 0 && <VendorSearchWidget />}

        {/* Browse by Category */}
        {category === 'All' && !loading && (
          <BrowseByCategory onSelect={setFilter} />
        )}
      </div>
    </div>
  );
}
