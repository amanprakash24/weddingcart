'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Clock, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';

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

function formatDate(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
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
  };

  return (
    <div className="min-h-screen bg-[#FFFAF5]">
      {/* Hero */}
      <section className="bg-gradient-to-br from-amber-950 via-rose-950 to-gray-950 pt-28 pb-16 text-center">
        <p className="text-amber-400 text-sm font-semibold uppercase tracking-widest mb-3">Wedding Inspiration</p>
        <h1 className="text-4xl sm:text-5xl font-bold text-white font-[Playfair_Display,serif] mb-4">
          The ShaadiShopping Blog
        </h1>
        <p className="text-white/60 text-lg max-w-xl mx-auto">
          Tips, trends, guides and real wedding stories to inspire your perfect day.
        </p>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-10">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                category === cat
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
                <div className="h-48 bg-gray-200" />
                <div className="p-5 space-y-3">
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : blogs.length === 0 ? (
          <div className="text-center py-24">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No posts yet in this category.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {blogs.map(blog => (
                <Link
                  key={blog._id}
                  href={`/blog/${blog.slug}`}
                  className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="relative h-48 bg-gradient-to-br from-amber-100 to-rose-100 overflow-hidden">
                    {blog.coverImage ? (
                      <Image
                        src={blog.coverImage}
                        alt={blog.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        unoptimized
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <BookOpen className="w-10 h-10 text-amber-300" />
                      </div>
                    )}
                    <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                      {blog.category}
                    </span>
                  </div>
                  <div className="p-5">
                    <h2 className="font-bold text-gray-900 text-base font-[Playfair_Display,serif] leading-snug mb-2 group-hover:text-amber-700 transition-colors line-clamp-2">
                      {blog.title}
                    </h2>
                    {blog.excerpt && (
                      <p className="text-gray-500 text-sm leading-relaxed mb-4 line-clamp-2">{blog.excerpt}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(blog.publishedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {blog.readTime} min read
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="p-2 rounded-full border border-gray-200 text-gray-500 hover:border-amber-400 hover:text-amber-600 disabled:opacity-40 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 rounded-full text-sm font-medium transition-all ${
                      p === page
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'border border-gray-200 text-gray-600 hover:border-amber-400 hover:text-amber-600'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === pages}
                  className="p-2 rounded-full border border-gray-200 text-gray-500 hover:border-amber-400 hover:text-amber-600 disabled:opacity-40 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
