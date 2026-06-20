import { Suspense } from 'react';
import type { Metadata } from 'next';
import BlogListClient from '@/components/BlogListClient';
import { JsonLd } from '@/components/JsonLd';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

export const metadata: Metadata = {
  title: 'Wedding Blog — Tips, Trends & Real Weddings | ShaadiShopping',
  description:
    'Explore wedding tips, venue guides, bridal fashion trends, real wedding stories, and budget planning advice from India\'s top wedding planning experts.',
  keywords: [
    'wedding tips India', 'wedding planning advice', 'bridal fashion trends',
    'real wedding stories', 'wedding budget planning', 'venue guides India',
    'wedding traditions India', 'wedding photography tips',
  ],
  alternates: { canonical: `${BASE_URL}/blog` },
  openGraph: {
    title: 'Wedding Blog — Tips, Trends & Real Weddings | ShaadiShopping',
    description:
      'Expert wedding advice, trends, and inspiration for couples planning their dream wedding in India.',
    url: `${BASE_URL}/blog`,
    type: 'website',
    locale: 'en_IN',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'ShaadiShopping Wedding Blog' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wedding Blog — Tips, Trends & Real Weddings | ShaadiShopping',
    description: 'Expert wedding advice, trends, and inspiration for couples planning their dream wedding in India.',
    images: ['/opengraph-image'],
  },
};

const blogCollectionJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Wedding Blog — ShaadiShopping',
  description:
    'Expert wedding advice, trends, and inspiration for couples planning their dream wedding in India.',
  url: `${BASE_URL}/blog`,
  publisher: {
    '@type': 'Organization',
    name: 'ShaadiShopping',
    url: BASE_URL,
  },
};

export default function BlogPage() {
  return (
    <>
      <JsonLd data={blogCollectionJsonLd} />
      <Suspense>
        <BlogListClient />
      </Suspense>
    </>
  );
}
