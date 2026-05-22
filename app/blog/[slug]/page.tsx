import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { connectDB } from '@/lib/mongodb';
import BlogModel from '@/lib/models/Blog';
import { JsonLd } from '@/components/JsonLd';
import { Calendar, Clock, ArrowLeft, BookOpen } from 'lucide-react';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

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
  const blog = await getBlog(slug);
  if (!blog) notFound();

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

      <article className="min-h-screen bg-[#FFFAF5]">
        {/* Cover */}
        <div className="relative h-72 sm:h-96 bg-gradient-to-br from-amber-100 to-rose-100">
          {blog.coverImage ? (
            <Image
              src={blog.coverImage}
              alt={blog.title}
              fill
              className="object-cover"
              priority
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-950 via-rose-950 to-gray-950">
              <BookOpen className="w-16 h-16 text-white/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 pb-8 max-w-3xl mx-auto">
            <span className="inline-block bg-amber-500 text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
              {blog.category}
            </span>
            <h1 className="text-2xl sm:text-4xl font-bold text-white font-[Playfair_Display,serif] leading-tight">
              {blog.title}
            </h1>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-8 pb-6 border-b border-gray-100">
            <span className="font-medium text-gray-700">{blog.author}</span>
            {blog.publishedAt && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> {formatDate(blog.publishedAt)}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> {blog.readTime} min read
            </span>
          </div>

          {/* Content */}
          <div
            className="blog-prose"
            dangerouslySetInnerHTML={{ __html: blog.content }}
          />

          {/* Tags */}
          {blog.tags && blog.tags.length > 0 && (
            <div className="mt-10 pt-6 border-t border-gray-100">
              <div className="flex flex-wrap gap-2">
                {blog.tags.map(tag => (
                  <span key={tag} className="bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1 rounded-full border border-amber-100">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Back */}
          <div className="mt-10">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm text-amber-700 font-semibold hover:text-amber-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Blog
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}
