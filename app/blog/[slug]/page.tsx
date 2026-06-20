import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { connectDB } from '@/lib/mongodb';
import BlogModel from '@/lib/models/Blog';
import { JsonLd } from '@/components/JsonLd';
import { Calendar, Clock, ArrowLeft, BookOpen, ChevronRight } from 'lucide-react';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

const CATEGORY_COLOR: Record<string, string> = {
  'Wedding Tips':         '#C5A46D',
  'Venue Guides':         '#B87E6F',
  'Bridal Fashion':       '#A87CAA',
  'Real Weddings':        '#C4758A',
  'Budget Planning':      '#6E9E7F',
  'Traditions & Culture': '#C48B5A',
  'Destination Weddings': '#6E9BB8',
  'Food & Catering':      '#C4A84E',
  'Décor & Flowers':      '#6EADA8',
  'Photography':          '#7A88C4',
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
  updatedAt: string | null;
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

  const courtMarriageKeywords = slug === 'court-marriage-registration-patna-bihar'
    ? ['court marriage patna', 'court marriage registration patna', 'special marriage act patna',
        'court marriage bihar', 'how to do court marriage patna', 'court marriage patna documents',
        'arya samaj marriage patna', 'civil marriage patna', 'court marriage registration bihar',
        'court shadi patna', 'registered marriage patna']
    : [];

  return {
    title,
    description,
    keywords: [
      ...(blog.tags?.length ? blog.tags : ['wedding tips', 'wedding planning India', 'ShaadiShopping blog']),
      ...courtMarriageKeywords,
    ],
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
  const blog = await getBlog(slug);
  if (!blog) notFound();
  const related = await getRelatedPosts(blog.category, slug);

  const categoryColor = CATEGORY_COLOR[blog.category] ?? '#C5A46D';

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
    dateModified: blog.updatedAt ?? blog.publishedAt,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${BASE_URL}/blog/${slug}` },
    keywords: blog.tags?.join(', '),
    articleSection: blog.category,
    url: `${BASE_URL}/blog/${slug}`,
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['h1', '.blog-prose h2', '.blog-prose h3'],
    },
  };

  const COURT_MARRIAGE_FAQS = slug === 'court-marriage-registration-patna-bihar' ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How to do court marriage in Patna, Bihar?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'To register a court marriage in Patna, Bihar, both parties must visit the Sub-Divisional Magistrate (SDM) office with their identity proof (Aadhaar/Passport), age proof, passport photos, and address proof. File a Notice of Intended Marriage under the Special Marriage Act, 1954. After a 30-day notice period, the marriage officer registers the marriage in the presence of three witnesses.',
        },
      },
      {
        '@type': 'Question',
        name: 'What documents are needed for court marriage in Patna?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Documents required for court marriage in Patna: Aadhaar card or passport of both parties, birth certificate or 10th mark sheet for age proof, 2 passport-size photos each, address proof, and identity proof of three witnesses.',
        },
      },
      {
        '@type': 'Question',
        name: 'How long does court marriage registration take in Bihar?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Under the Special Marriage Act, the process takes a minimum of 30 days after filing the notice. The marriage is registered after the mandatory notice period if no objections are received.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is the cost of court marriage registration in Patna?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The government fee for court marriage in Bihar is typically ₹100–₹150. Legal assistance and documentation services may cost ₹2,000–₹5,000 extra if hired.',
        },
      },
    ],
  } : null;

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
      {COURT_MARRIAGE_FAQS && <JsonLd data={COURT_MARRIAGE_FAQS} />}

      <div className="min-h-screen" style={{ background: '#FFFCF7' }}>

        {/* ── Cinematic hero header ── */}
        <div
          className="relative overflow-hidden pt-[81px]"
          style={{ background: 'linear-gradient(160deg, #0C0408 0%, #1C0A12 55%, #2D0B1F 100%)' }}
        >
          {/* dot-grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(197,164,109,0.035) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
          {/* ambient glows */}
          <div className="absolute top-0 left-1/4 w-80 h-80 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(139,26,74,0.12) 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 right-1/4 w-96 h-64 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(197,164,109,0.08) 0%, transparent 70%)' }} />

          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-12">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-xs mb-8" style={{ color: 'rgba(232,212,160,0.5)' }}>
              <Link href="/" className="hover:text-[#E8D4A0] transition-colors">Home</Link>
              <ChevronRight className="w-3 h-3" />
              <Link href="/blog" className="hover:text-[#E8D4A0] transition-colors">Blog</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="line-clamp-1" style={{ color: 'rgba(232,212,160,0.7)' }}>{blog.title}</span>
            </nav>

            {/* Category */}
            <div className="flex items-center gap-2 mb-5">
              <span className="w-1 h-4 rounded-full" style={{ background: categoryColor }} />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: categoryColor }}>
                {blog.category}
              </span>
            </div>

            {/* Title */}
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-5"
              style={{ fontFamily: 'Playfair Display, serif', color: '#FFFCF7', letterSpacing: '-0.01em' }}
            >
              {blog.title}
            </h1>

            {/* Excerpt */}
            {blog.excerpt && (
              <p className="text-lg leading-relaxed mb-8 max-w-2xl" style={{ color: 'rgba(255,252,247,0.6)' }}>
                {blog.excerpt}
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-5 pb-10">
              <span className="flex items-center gap-2.5">
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #C5A46D, #8B1A4A)' }}
                >
                  {blog.author.charAt(0).toUpperCase()}
                </span>
                <span className="text-sm font-semibold" style={{ color: '#E8D4A0' }}>{blog.author}</span>
              </span>
              {blog.publishedAt && (
                <span className="flex items-center gap-1.5 text-sm" style={{ color: 'rgba(232,212,160,0.6)' }}>
                  <Calendar className="w-3.5 h-3.5" style={{ color: '#C5A46D' }} />
                  {formatDate(blog.publishedAt)}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-sm" style={{ color: 'rgba(232,212,160,0.6)' }}>
                <Clock className="w-3.5 h-3.5" style={{ color: '#C5A46D' }} />
                {blog.readTime} min read
              </span>
            </div>
          </div>

          {/* Bottom fade to ivory */}
          <div
            className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent, #FFFCF7)' }}
          />
        </div>

        {/* ── Cover image ── */}
        {blog.coverImage && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-1 pb-8">
            <div
              className="relative aspect-[16/9] rounded-2xl overflow-hidden"
              style={{ boxShadow: '0 24px 80px rgba(139,26,74,0.18), 0 8px 32px rgba(0,0,0,0.12)' }}
            >
              <Image
                src={blog.coverImage}
                alt={blog.title}
                fill
                className="object-cover"
                priority
                unoptimized
              />
              {/* subtle gold border */}
              <div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{ boxShadow: 'inset 0 0 0 1px rgba(197,164,109,0.25)' }}
              />
            </div>
          </div>
        )}

        {/* ── Article content ── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
          <div
            className="rounded-2xl px-6 sm:px-12 py-10"
            style={{
              background: '#FFFFFF',
              border: '1px solid rgba(232,212,160,0.25)',
              boxShadow: '0 4px_32px rgba(197,164,109,0.06)',
            }}
          >
            <div
              className="blog-prose"
              dangerouslySetInnerHTML={{ __html: blog.content }}
            />
          </div>

          {/* Tags */}
          {blog.tags && blog.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {blog.tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs font-medium px-3 py-1.5 rounded-full cursor-default transition-colors"
                  style={{
                    background: 'rgba(197,164,109,0.08)',
                    border: '1px solid rgba(197,164,109,0.3)',
                    color: '#9A7A4A',
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Gold divider */}
          <div className="flex items-center gap-3 mt-12 mb-10">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(197,164,109,0.5))' }} />
            <span className="text-[10px] tracking-[0.3em]" style={{ color: '#C5A46D' }}>✦</span>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(197,164,109,0.5))' }} />
          </div>

          {/* Author card */}
          <div
            className="rounded-2xl p-6 flex items-start gap-5"
            style={{
              background: 'linear-gradient(135deg, rgba(197,164,109,0.05), rgba(139,26,74,0.03))',
              border: '1px solid rgba(197,164,109,0.2)',
            }}
          >
            <span
              className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #C5A46D, #8B1A4A)' }}
            >
              {blog.author.charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: '#C5A46D' }}>Written by</p>
              <p className="font-bold text-lg mb-1" style={{ fontFamily: 'Playfair Display, serif', color: '#1C0A12' }}>{blog.author}</p>
              <p className="text-sm leading-relaxed" style={{ color: '#6B5B4D' }}>
                Wedding planning expert at ShaadiShopping — helping couples plan their dream weddings across India.
              </p>
            </div>
          </div>

          {/* Back link */}
          <div className="mt-8">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
              style={{ color: '#9A7A4A' }}
            >
              <ArrowLeft className="w-4 h-4" /> Back to all posts
            </Link>
          </div>
        </div>

        {/* ── Related Posts ── */}
        {related.length > 0 && (
          <section
            className="py-16"
            style={{ background: 'linear-gradient(180deg, #FFFCF7 0%, rgba(197,164,109,0.05) 100%)' }}
          >
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Section header */}
              <div className="flex items-end justify-between mb-10">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] mb-2" style={{ color: '#C5A46D' }}>
                    Keep Reading
                  </p>
                  <h2
                    className="text-2xl sm:text-3xl font-bold"
                    style={{ fontFamily: 'Playfair Display, serif', color: '#1C0A12' }}
                  >
                    More in {blog.category}
                  </h2>
                </div>
                <Link
                  href={`/blog?category=${encodeURIComponent(blog.category)}`}
                  className="hidden sm:flex items-center gap-1.5 text-sm font-semibold transition-all hover:gap-2.5"
                  style={{ color: '#8B1A4A' }}
                >
                  View all <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Gold divider */}
              <div className="flex items-center gap-3 mb-10">
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(197,164,109,0.5))' }} />
                <span className="text-[10px] tracking-[0.3em]" style={{ color: '#C5A46D' }}>✦</span>
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(197,164,109,0.5))' }} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {related.map(post => {
                  const postCatColor = CATEGORY_COLOR[post.category] ?? '#C5A46D';
                  return (
                    <Link
                      key={post.slug}
                      href={`/blog/${post.slug}`}
                      className="group rounded-2xl overflow-hidden transition-all duration-500"
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid rgba(232,212,160,0.4)',
                        boxShadow: '0 4px 24px rgba(197,164,109,0.07)',
                      }}
                    >
                      {/* Image */}
                      <div className="relative aspect-[16/10] overflow-hidden">
                        {post.coverImage ? (
                          <Image
                            src={post.coverImage}
                            alt={post.title}
                            fill
                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                            unoptimized
                          />
                        ) : (
                          <div
                            className="absolute inset-0 flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, rgba(197,164,109,0.1), rgba(139,26,74,0.05))' }}
                          >
                            <BookOpen className="w-8 h-8" style={{ color: 'rgba(197,164,109,0.3)' }} />
                          </div>
                        )}
                        {/* gold shine on hover */}
                        <div
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                          style={{ background: 'linear-gradient(135deg, rgba(197,164,109,0.08), transparent 60%)' }}
                        />
                      </div>

                      {/* Content */}
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: postCatColor }} />
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: postCatColor }}>
                            {post.category}
                          </span>
                        </div>
                        <h3
                          className="font-bold text-sm leading-snug mb-3 line-clamp-2 transition-colors duration-300"
                          style={{ fontFamily: 'Playfair Display, serif', color: '#1C0A12' }}
                        >
                          {post.title}
                        </h3>
                        <div className="flex items-center gap-2 text-[11px]" style={{ color: '#9A8A7A' }}>
                          <span>{formatDate(post.publishedAt)}</span>
                          <span style={{ color: '#C5A46D' }}>✦</span>
                          <Clock className="w-3 h-3" style={{ color: '#C5A46D' }} />
                          <span>{post.readTime} min read</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
