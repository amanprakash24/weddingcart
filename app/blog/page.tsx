import { Suspense } from 'react';
import type { Metadata } from 'next';
import BlogListClient from '@/components/BlogListClient';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

export const metadata: Metadata = {
  title: 'Wedding Blog — Tips, Trends & Real Weddings | ShaadiShopping',
  description:
    'Explore wedding tips, venue guides, bridal fashion trends, real wedding stories, and budget planning advice from India\'s top wedding planning experts.',
  alternates: { canonical: `${BASE_URL}/blog` },
  openGraph: {
    title: 'Wedding Blog — Tips, Trends & Real Weddings | ShaadiShopping',
    description:
      'Expert wedding advice, trends, and inspiration for couples planning their dream wedding in India.',
    url: `${BASE_URL}/blog`,
    type: 'website',
    locale: 'en_IN',
  },
};

export default function BlogPage() {
  return (
    <Suspense>
      <BlogListClient />
    </Suspense>
  );
}
