'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Clock, ArrowRight, BookOpen, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

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

const VENDOR_OPTIONS = [
  { label: 'Wedding Venues',          slug: 'venue' },
  { label: 'Bridal Makeup Artists',   slug: 'makeup' },
  { label: 'Mehndi Artists',          slug: 'mehndi' },
  { label: 'Wedding Decorators',      slug: 'decorator' },
  { label: 'Wedding Photographers',   slug: 'photo-video' },
  { label: 'Wedding Caterers',        slug: 'catering' },
  { label: 'Wedding DJ',              slug: 'dj' },
  { label: 'Wedding Band & Music',    slug: 'band' },
  { label: 'Wedding Planners',        slug: 'planning' },
  { label: 'Wedding Invitations',     slug: 'invitations' },
  { label: 'Bridal Lehenga',         slug: 'bridal-lehenga' },
  { label: 'Bridal Jewellery',       slug: 'bridal-jewellery' },
  { label: 'Sherwani & Groom Wear',  slug: 'sherwani' },
  { label: 'Wedding Transport',       slug: 'transport' },
  { label: 'Wedding Gifts',          slug: 'gifts' },
];

function formatDate(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ── Gold ornamental divider ─────────────────────────────── */
function GoldDivider() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#C5A46D]/50" />
      <span className="text-[#C5A46D] text-[10px] tracking-[0.3em]">✦</span>
      <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#C5A46D]/50" />
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="bg-[#FFFCF7] rounded-2xl overflow-hidden border border-[#E8D4A0]/30 animate-pulse">
      <div className="aspect-[16/10] bg-[#E8D4A0]/30" />
      <div className="p-6 space-y-3">
        <div className="h-2.5 bg-[#E8D4A0]/40 rounded w-1/4" />
        <div className="h-5 bg-[#E8D4A0]/50 rounded w-4/5" />
        <div className="h-3.5 bg-[#E8D4A0]/30 rounded w-full" />
        <div className="h-3.5 bg-[#E8D4A0]/30 rounded w-3/4" />
      </div>
    </div>
  );
}

/* ── Featured (magazine cover) ───────────────────────────── */
function FeaturedCard({ blog }: { blog: Blog }) {
  return (
    <Link
      href={`/blog/${blog.slug}`}
      className="group relative block rounded-3xl overflow-hidden shadow-[0_32px_80px_rgba(28,10,18,0.35)] hover:shadow-[0_40px_100px_rgba(28,10,18,0.5)] transition-all duration-700"
    >
      {/* Background image */}
      <div className="relative aspect-[16/8] sm:aspect-[21/9]">
        {blog.coverImage ? (
          <Image
            src={blog.coverImage}
            alt={blog.title}
            fill
            className="object-cover scale-[1.02] group-hover:scale-[1.07] transition-transform duration-[1200ms] ease-out"
            unoptimized
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1C0A12] via-[#3D1428] to-[#1C0A12]" />
        )}

        {/* Cinematic overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0C0408]/95 via-[#0C0408]/40 to-[#0C0408]/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0C0408]/60 via-transparent to-transparent" />
      </div>

      {/* Text content — overlaid bottom-left */}
      <div className="absolute bottom-0 left-0 right-0 px-8 sm:px-12 pb-10 sm:pb-12">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-[#C5A46D] text-[#1C0A12] text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 rounded-full">
            Featured
          </span>
          <span className="text-[#C5A46D]/70 text-[11px] font-medium uppercase tracking-widest">
            {blog.category}
          </span>
        </div>

        <h2 className="font-[Playfair_Display,serif] font-bold text-white text-2xl sm:text-3xl lg:text-4xl leading-tight mb-4 max-w-2xl group-hover:text-[#E8D4A0] transition-colors duration-300">
          {blog.title}
        </h2>

        {blog.excerpt && (
          <p className="text-white/55 text-sm leading-relaxed mb-5 max-w-xl hidden sm:block line-clamp-2">
            {blog.excerpt}
          </p>
        )}

        <div className="flex items-center gap-5 text-xs text-white/40 mb-6">
          <span className="text-white/60 font-semibold">{blog.author}</span>
          <span className="w-1 h-1 rounded-full bg-[#C5A46D]/50" />
          {blog.publishedAt && <span>{formatDate(blog.publishedAt)}</span>}
          <span className="w-1 h-1 rounded-full bg-[#C5A46D]/50" />
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {blog.readTime} min read</span>
        </div>

        <span className="inline-flex items-center gap-2 text-[#C5A46D] text-sm font-semibold tracking-wide group-hover:gap-3.5 transition-all duration-300">
          Read Story <ArrowRight className="w-4 h-4" />
        </span>
      </div>

      {/* Gold border shimmer on hover */}
      <div className="absolute inset-0 rounded-3xl border border-[#C5A46D]/0 group-hover:border-[#C5A46D]/25 transition-colors duration-500 pointer-events-none" />
    </Link>
  );
}

/* ── Blog card ───────────────────────────────────────────── */
function BlogCard({ blog }: { blog: Blog }) {
  return (
    <Link
      href={`/blog/${blog.slug}`}
      className="group flex flex-col bg-[#FFFCF7] rounded-2xl overflow-hidden
        border border-[#E8D4A0]/40
        shadow-[0_4px_24px_rgba(197,164,109,0.07)]
        hover:shadow-[0_12px_48px_rgba(197,164,109,0.18)]
        hover:border-[#C5A46D]/50
        hover:-translate-y-1.5
        transition-all duration-400"
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-[#F5E9D0] to-[#EFE4D2]">
        {blog.coverImage ? (
          <Image
            src={blog.coverImage}
            alt={blog.title}
            fill
            className="object-cover group-hover:scale-[1.06] transition-transform duration-700"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1C0A12] to-[#3D1428]">
            <BookOpen className="w-10 h-10 text-[#C5A46D]/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1C0A12]/30 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-6">
        {/* Category */}
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C5A46D] flex-shrink-0" />
          <span className="text-[#C5A46D] text-[10px] font-bold uppercase tracking-[0.18em]">{blog.category}</span>
        </div>

        <h3 className="font-[Playfair_Display,serif] font-bold text-[#1C0A12] text-[15px] leading-snug mb-3 line-clamp-2 group-hover:text-[#8B1A4A] transition-colors duration-200 flex-1">
          {blog.title}
        </h3>

        {blog.excerpt && (
          <p className="text-[#6B5B4D] text-[12.5px] leading-relaxed mb-4 line-clamp-2">{blog.excerpt}</p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-2 text-[11px] text-[#9B8B7D] pt-4 border-t border-[#E8D4A0]/50 mt-auto">
          <span className="font-medium text-[#6B5B4D] truncate max-w-[90px]">{blog.author}</span>
          <span className="w-1 h-1 rounded-full bg-[#C5A46D]/50 flex-shrink-0" />
          {blog.publishedAt && <span className="truncate">{formatDate(blog.publishedAt)}</span>}
          <span className="w-1 h-1 rounded-full bg-[#C5A46D]/50 flex-shrink-0" />
          <span className="flex items-center gap-1 flex-shrink-0">
            <Clock className="w-3 h-3 text-[#C5A46D]" /> {blog.readTime} min
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ── Vendor search widget ─────────────────────────────────── */
function VendorSearchWidget() {
  const router = useRouter();
  const [selected, setSelected] = useState('venue');

  return (
    <section className="my-20">
      <div
        className="relative rounded-3xl overflow-hidden px-6 sm:px-16 py-14 text-center"
        style={{ background: 'linear-gradient(135deg, #1C0A12 0%, #2D0B1F 50%, #1C0A12 100%)' }}
      >
        {/* Dot grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, #C5A46D 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />
        {/* Gold glow blobs */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#C5A46D]/8 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-[#8B1A4A]/15 rounded-full blur-[60px] pointer-events-none" />

        <div className="relative z-10">
          <GoldDivider />

          <div className="mt-8 mb-3">
            <p className="text-[#C5A46D] text-[11px] font-bold uppercase tracking-[0.3em] mb-4">Discover</p>
            <h2 className="font-[Playfair_Display,serif] text-2xl sm:text-3xl lg:text-4xl font-bold text-[#E8D4A0] leading-snug">
              Find the Best Wedding Vendors<br className="hidden sm:block" />
              <span className="italic text-[#C5A46D]"> with Trusted Reviews</span>
            </h2>
            <p className="text-[#9B8B7D] text-sm mt-3">
              500+ verified vendors · 25+ cities · Thousands of happy couples
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 my-10">
            <span className="text-[#E8D4A0]/60 font-medium text-base whitespace-nowrap">I am looking for</span>
            <div className="relative">
              <select
                value={selected}
                onChange={e => setSelected(e.target.value)}
                className="appearance-none bg-transparent border-0 border-b border-[#C5A46D]/50 focus:border-[#C5A46D] outline-none text-[#E8D4A0] font-semibold text-base pb-2 pr-8 pl-1 cursor-pointer transition-colors min-w-[240px]"
                style={{ colorScheme: 'dark' }}
              >
                {VENDOR_OPTIONS.map(opt => (
                  <option key={opt.slug} value={opt.slug} className="bg-[#1C0A12] text-[#E8D4A0]">{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-0 bottom-2.5 w-4 h-4 text-[#C5A46D] pointer-events-none" />
            </div>
          </div>

          <button
            onClick={() => router.push(`/categories/${selected}`)}
            className="inline-flex items-center gap-2.5 font-bold px-12 py-4 rounded-full text-[#1C0A12] text-sm tracking-wide transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_40px_rgba(197,164,109,0.4)]"
            style={{ background: 'linear-gradient(135deg, #C5A46D, #E8D4A0, #C5A46D)' }}
          >
            Search Vendors <ArrowRight className="w-4 h-4" />
          </button>

          <div className="mt-8">
            <GoldDivider />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Browse our Guides ───────────────────────────────────── */
const GUIDE_CARDS = [
  {
    title: 'Décor',
    subtitle: 'GUIDE',
    category: 'Décor & Flowers',
    gradient: 'linear-gradient(160deg, #0B2323 0%, #0F3328 50%, #1A4D3A 100%)',
    shimmer: 'rgba(110,173,168,0.12)',
    accent: '#6EADA8',
  },
  {
    title: 'Bridal',
    subtitle: 'FASHION',
    category: 'Bridal Fashion',
    gradient: 'linear-gradient(160deg, #1A0826 0%, #2D0D40 50%, #3D1060 100%)',
    shimmer: 'rgba(168,124,170,0.12)',
    accent: '#C49EC6',
  },
  {
    title: 'Photo',
    subtitle: 'GRAPHY',
    category: 'Photography',
    gradient: 'linear-gradient(160deg, #0A0A1A 0%, #141428 50%, #1E1E40 100%)',
    shimmer: 'rgba(122,136,196,0.12)',
    accent: '#7A88C4',
  },
  {
    title: 'Venue',
    subtitle: 'GUIDES',
    category: 'Venue Guides',
    gradient: 'linear-gradient(160deg, #0A1A24 0%, #0F2B3D 50%, #1A3F5C 100%)',
    shimmer: 'rgba(110,155,184,0.12)',
    accent: '#6E9BB8',
  },
];

function BrowseGuides({ onSelect }: { onSelect: (cat: string) => void }) {
  return (
    <section className="mb-16">
      {/* Section heading */}
      <div className="text-center mb-10">
        <GoldDivider />
        <div className="mt-7 mb-1">
          <p className="text-[#C5A46D] text-[11px] font-bold uppercase tracking-[0.28em] mb-2">Explore</p>
          <h2
            className="text-3xl sm:text-4xl font-bold text-[#1C0A12]"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Browse our Guides
          </h2>
        </div>
      </div>

      {/* 4-card grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {GUIDE_CARDS.map(card => (
          <button
            key={card.category}
            onClick={() => onSelect(card.category)}
            className="group relative rounded-2xl overflow-hidden cursor-pointer text-left focus:outline-none"
            style={{ aspectRatio: '3 / 4' }}
          >
            {/* Background gradient */}
            <div className="absolute inset-0" style={{ background: card.gradient }} />

            {/* Ambient glow */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
              style={{ background: `radial-gradient(ellipse at center, ${card.shimmer} 0%, transparent 70%)` }}
            />

            {/* Subtle dot texture */}
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            />

            {/* Gold inset frame */}
            <div
              className="absolute inset-3 rounded-xl border transition-all duration-500 pointer-events-none z-10"
              style={{ borderColor: `${card.accent}30` }}
            />
            <div
              className="absolute inset-3 rounded-xl border opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none z-10"
              style={{ borderColor: `${card.accent}70` }}
            />

            {/* Text content — centered */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-4">
              {/* Decorative ornament */}
              <span
                className="text-[10px] tracking-[0.3em] mb-5 opacity-60 transition-opacity duration-300 group-hover:opacity-100"
                style={{ color: card.accent }}
              >
                ✦
              </span>

              {/* Main title */}
              <h3
                className="text-3xl sm:text-4xl font-bold italic leading-none mb-1 text-center transition-all duration-300"
                style={{
                  fontFamily: 'Playfair Display, serif',
                  color: '#FFFCF7',
                  textShadow: '0 2px 20px rgba(0,0,0,0.5)',
                }}
              >
                {card.title}
              </h3>

              {/* Subtitle */}
              <p
                className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.3em] mb-8 transition-colors duration-300"
                style={{ color: `${card.accent}CC` }}
              >
                {card.subtitle}
              </p>

              {/* Explore link */}
              <span
                className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.3em] transition-all duration-300"
                style={{
                  color: card.accent,
                  borderBottom: `1px solid ${card.accent}60`,
                  paddingBottom: '2px',
                }}
              >
                EXPLORE
              </span>
            </div>

            {/* Scale image effect via overlay */}
            <div className="absolute inset-0 scale-100 group-hover:scale-105 transition-transform duration-700 pointer-events-none" />
          </button>
        ))}
      </div>
    </section>
  );
}

/* ── Browse by Category ───────────────────────────────────── */
function BrowseByCategory({ onSelect }: { onSelect: (cat: string) => void }) {
  return (
    <section className="mt-16 mb-4">
      <div className="text-center mb-10">
        <GoldDivider />
        <div className="mt-6">
          <p className="text-[#C5A46D] text-[11px] font-bold uppercase tracking-[0.25em] mb-2">Explore</p>
          <h2 className="font-[Playfair_Display,serif] text-2xl sm:text-3xl font-bold text-[#1C0A12]">Browse by Category</h2>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {CATEGORIES.filter(c => c !== 'All').map(cat => (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className="group flex flex-col items-center gap-3 rounded-2xl p-5 text-center transition-all duration-300
              bg-[#1C0A12] border border-[#C5A46D]/12
              hover:border-[#C5A46D]/45 hover:bg-[#2D0B1F]
              hover:shadow-[0_8px_32px_rgba(197,164,109,0.12)]
              hover:-translate-y-1"
          >
            <span className="text-2xl">{CATEGORY_ICONS[cat] ?? '📝'}</span>
            <span className="text-xs font-semibold text-[#9B8B7D] group-hover:text-[#C5A46D] transition-colors leading-tight">{cat}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ── Main component ───────────────────────────────────────── */
export default function BlogListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get('category') ?? 'All';
  const page = parseInt(searchParams.get('page') ?? '1');

  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const cat = category === 'All' ? '' : category;
    fetch(`/api/blogs?category=${encodeURIComponent(cat)}&page=${page}&limit=9`)
      .then(r => r.json())
      .then(data => {
        setBlogs(data.blogs ?? []);
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
    <div className="min-h-screen bg-[#FFFCF7]">

      {/* ── CINEMATIC HERO ─────────────────────────────────── */}
      <section
        className="relative overflow-hidden pt-28 pb-20"
        style={{ background: 'linear-gradient(160deg, #0C0408 0%, #1C0A12 45%, #2D0B1F 100%)' }}
      >
        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, #C5A46D 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        {/* Ambient blobs */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#8B1A4A]/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-[300px] h-[300px] bg-[#C5A46D]/8 rounded-full blur-[80px] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Label */}
          <div className="flex items-center gap-3 mb-7">
            <div className="h-px w-10 bg-[#C5A46D]" />
            <span className="text-[#C5A46D] text-[11px] font-bold uppercase tracking-[0.28em]">ShaadiShopping Journal</span>
          </div>

          {/* Heading */}
          <h1 className="font-[Playfair_Display,serif] font-bold text-[#FFFCF7] leading-[1.08] mb-6">
            <span className="block text-5xl sm:text-6xl lg:text-7xl">Wedding</span>
            <span
              className="block text-5xl sm:text-6xl lg:text-7xl italic"
              style={{ WebkitTextStroke: '1px #C5A46D', color: 'transparent' }}
            >
              Stories
            </span>
            <span className="block text-5xl sm:text-6xl lg:text-7xl">&amp; Inspiration</span>
          </h1>

          <p className="text-[#9B8B7D] text-base max-w-md leading-relaxed mb-10">
            Expert guides, real wedding stories and trend reports for couples planning their dream wedding across India.
          </p>

          {/* Stats */}
          <div className="flex items-center gap-8 sm:gap-12">
            {[['500+', 'Articles'], ['10', 'Categories'], ['Daily', 'Updates']].map(([v, l]) => (
              <div key={l}>
                <p className="font-[Playfair_Display,serif] font-bold text-[#C5A46D] text-xl">{v}</p>
                <p className="text-[#6B5B4D] text-[10px] uppercase tracking-[0.2em] mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-[#FFFCF7] to-transparent pointer-events-none" />
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Browse Guides ───────────────────────────────── */}
        <div className="mb-4 mt-2">
          <BrowseGuides onSelect={setFilter} />
        </div>

        {/* ── Category filter ─────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-10">
          {CATEGORIES.map(cat => {
            const active = category === cat;
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-4 py-1.5 rounded-full text-[12.5px] font-semibold transition-all duration-200 ${
                  active
                    ? 'bg-[#1C0A12] text-[#C5A46D] border border-[#C5A46D]/40 shadow-[0_2px_12px_rgba(28,10,18,0.2)]'
                    : 'bg-white border border-[#E8D4A0]/60 text-[#6B5B4D] hover:border-[#C5A46D]/50 hover:text-[#8B1A4A] hover:bg-[#FFFCF7]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* ── Content ─────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-8">
            <div
              className="rounded-3xl overflow-hidden animate-pulse"
              style={{ background: 'linear-gradient(135deg, #1C0A12, #2D0B1F)' }}
            >
              <div className="aspect-[21/9] opacity-20 bg-[#C5A46D]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}
            </div>
          </div>
        ) : blogs.length === 0 ? (
          <div className="text-center py-32">
            <BookOpen className="w-14 h-14 text-[#C5A46D]/30 mx-auto mb-5" />
            <h3 className="font-[Playfair_Display,serif] text-xl font-bold text-[#1C0A12] mb-2">No posts yet</h3>
            <p className="text-[#9B8B7D] text-sm">
              {category !== 'All' ? `No posts in "${category}" yet.` : 'Check back soon for wedding inspiration.'}
            </p>
            {category !== 'All' && (
              <button onClick={() => setFilter('All')} className="mt-5 text-sm text-[#C5A46D] font-semibold hover:underline underline-offset-2">
                Browse all posts →
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Featured */}
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
              <div className="flex items-center justify-center gap-3 py-4">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-[#E8D4A0]/60 text-[#6B5B4D] text-sm font-semibold hover:border-[#C5A46D]/60 hover:text-[#8B1A4A] disabled:opacity-30 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <span className="px-4 text-sm text-[#9B8B7D]">
                  {page} / {pages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === pages}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-[#E8D4A0]/60 text-[#6B5B4D] text-sm font-semibold hover:border-[#C5A46D]/60 hover:text-[#8B1A4A] disabled:opacity-30 transition-all"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Vendor search */}
        {!loading && <VendorSearchWidget />}

        {/* Browse by Category */}
        {category === 'All' && !loading && (
          <BrowseByCategory onSelect={setFilter} />
        )}
      </div>
    </div>
  );
}
