import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { connectDB } from '@/lib/mongodb';
import BlogModel from '@/lib/models/Blog';
import { JsonLd } from '@/components/JsonLd';
import { Calendar, Clock, ArrowLeft, BookOpen, ChevronRight, User } from 'lucide-react';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

const CATEGORY_BADGE: Record<string, string> = {
  'Wedding Tips':         'bg-amber-50 text-amber-700 border-amber-200',
  'Venue Guides':         'bg-rose-50 text-rose-700 border-rose-200',
  'Bridal Fashion':       'bg-purple-50 text-purple-700 border-purple-200',
  'Real Weddings':        'bg-pink-50 text-pink-700 border-pink-200',
  'Budget Planning':      'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Traditions & Culture': 'bg-orange-50 text-orange-700 border-orange-200',
  'Destination Weddings': 'bg-blue-50 text-blue-700 border-blue-200',
  'Food & Catering':      'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Décor & Flowers':      'bg-teal-50 text-teal-700 border-teal-200',
  'Photography':          'bg-indigo-50 text-indigo-700 border-indigo-200',
};

interface BlogData {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  author: string;
  category: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  publishedAt: string | null;
  readTime: number;
}

async function getBlog(slug: string): Promise<BlogData | null> {
  try {
    await connectDB();
    const blog = await BlogModel.findOne({ slug, status: 'published' }).lean<BlogData>();
    return blog;
  } catch {
    return null;
  }
}

async function getRelatedPosts(category: string, excludeSlug: string): Promise<BlogData[]> {
  try {
    await connectDB();
    const posts = await BlogModel.find({ status: 'published', category, slug: { $ne: excludeSlug } })
      .select('title slug excerpt coverImage category publishedAt readTime author')
      .sort({ publishedAt: -1 })
      .limit(3)
      .lean<BlogData[]>();
    return posts;
  } catch {
    return [];
  }
}

function formatDate(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const blog = await getBlog(slug);
  if (!blog) return { title: 'Post Not Found' };

  const title = blog.seoTitle || blog.title;
  const description = blog.seoDescription || blog.excerpt || `Read ${blog.title} on the ShaadiShopping Blog.`;
  const url = `${BASE_URL}/blog/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      locale: 'en_IN',
      publishedTime: blog.publishedAt ?? undefined,
      authors: [blog.author],
      images: blog.coverImage ? [{ url: blog.coverImage, width: 1200, height: 630, alt: blog.title }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: blog.coverImage ? [blog.coverImage] : [],
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [blog, related] = await Promise.all([
    getBlog(slug),
    getBlog(slug).then(b => b ? getRelatedPosts(b.category, slug) : []),
  ]);

  if (!blog) notFound();

  const categoryBadge = CATEGORY_BADGE[blog.category] ?? 'bg-gray-100 text-gray-600 border-gray-200';

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: blog.title,
    description: blog.excerpt,
    image: blog.coverImage || undefined,
    author: { '@type': 'Organization', name: blog.author },
    publisher: {
      '@type': 'Organization',
      name: 'ShaadiShopping',
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/logo.png` },
    },
    datePublished: blog.publishedAt,
    dateModified: blog.publishedAt,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${BASE_URL}/blog/${slug}` },
    keywords: blog.tags?.join(', '),
    articleSection: blog.category,
    url: `${BASE_URL}/blog/${slug}`,
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: blog.title, item: `${BASE_URL}/blog/${slug}` },
    ],
  };

  return (
    <>
      <JsonLd data={articleJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      <div className="min-h-screen bg-[#FAFAFA]">

        {/* ── Breadcrumb ── */}
        <div className="bg-white border-b border-gray-100 pt-24 pb-0">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
            <nav className="flex items-center gap-2 text-xs text-gray-400">
              <Link href="/" className="hover:text-amber-600 transition-colors">Home</Link>
              <ChevronRight className="w-3 h-3" />
              <Link href="/blog" className="hover:text-amber-600 transition-colors">Blog</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-gray-600 line-clamp-1">{blog.title}</span>
            </nav>
          </div>
        </div>

        {/* ── Article header ── */}
        <header className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
            <span className={`inline-flex text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full border mb-5 ${categoryBadge}`}>
              {blog.category}
            </span>
            <h1 className="font-[Playfair_Display,serif] text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-5">
              {blog.title}
            </h1>
            {blog.excerpt && (
              <p className="text-gray-500 text-lg leading-relaxed mb-6 max-w-2xl">{blog.excerpt}</p>
            )}
            <div className="flex flex-wrap items-center gap-5 text-sm text-gray-500 pb-8 border-b border-gray-100">
              <span className="flex items-center gap-2 font-semibold text-gray-800">
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {blog.author.charAt(0).toUpperCase()}
                </span>
                {blog.author}
              </span>
              {blog.publishedAt && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-gray-400" /> {formatDate(blog.publishedAt)}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-gray-400" /> {blog.readTime} min read
              </span>
            </div>
          </div>
        </header>

        {/* ── Cover image ── */}
        {blog.coverImage && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
            <div className="relative aspect-[16/9] rounded-2xl overflow-hidden shadow-lg">
              <Image
                src={blog.coverImage}
                alt={blog.title}
                fill
                className="object-cover"
                priority
                unoptimized
              />
            </div>
          </div>
        )}

        {/* ── Content ── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-12">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 sm:px-12 py-10">
            <div
              className="blog-prose"
              dangerouslySetInnerHTML={{ __html: blog.content }}
            />
          </div>

          {/* Tags */}
          {blog.tags && blog.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {blog.tags.map(tag => (
                <span key={tag} className="bg-white border border-gray-200 text-gray-500 text-xs font-medium px-3 py-1.5 rounded-full hover:border-amber-300 hover:text-amber-700 transition-colors cursor-default">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Author card */}
          <div className="mt-10 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-start gap-5">
            <span className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {blog.author.charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Written by</p>
              <p className="font-[Playfair_Display,serif] font-bold text-gray-900 text-lg mb-1">{blog.author}</p>
              <p className="text-gray-500 text-sm leading-relaxed">
                Wedding planning expert at ShaadiShopping — helping couples plan their dream weddings across India.
              </p>
            </div>
          </div>

          {/* Back link */}
          <div className="mt-8">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm text-gray-500 font-medium hover:text-amber-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to all posts
            </Link>
          </div>
        </div>

        {/* ── Related Posts ── */}
        {related.length > 0 && (
          <section className="bg-white border-t border-gray-100 py-14">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-amber-600 text-xs font-bold uppercase tracking-widest mb-1">Keep Reading</p>
                  <h2 className="font-[Playfair_Display,serif] text-2xl font-bold text-gray-900">More in {blog.category}</h2>
                </div>
                <Link href={`/blog?category=${encodeURIComponent(blog.category)}`}
                  className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:gap-2.5 transition-all">
                  View all <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {related.map(post => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="group bg-[#FAFAFA] rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-amber-50 to-rose-50">
                      {post.coverImage ? (
                        <Image src={post.coverImage} alt={post.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <BookOpen className="w-8 h-8 text-amber-200" />
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="font-[Playfair_Display,serif] font-bold text-gray-900 text-sm leading-snug mb-2 line-clamp-2 group-hover:text-amber-700 transition-colors">
                        {post.title}
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400">
                        <span>{formatDate(post.publishedAt)}</span>
                        <span>·</span>
                        <span>{post.readTime} min read</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
