import { Suspense } from 'react';
import type { Metadata } from 'next';
import PlanPageClient from '@/components/PlanPageClient';
import { JsonLd } from '@/components/JsonLd';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

export const metadata: Metadata = {
  title: 'Plan Your Wedding in Patna — Free Wedding Shortlist',
  description:
    'Tell us your name, wedding date and guest count in under a minute. A Wedding Expert from our Patna team calls you with venues and vendors that fit your guests and budget. Free for families.',
  keywords: [
    'wedding planning wizard', 'free wedding planner India', 'wedding planning tool',
    'plan my wedding India', 'shaadi planning wizard', 'wedding consultation India',
    'wedding budget planner', 'wedding vendor shortlist', 'plan wedding Patna',
    'wedding planning checklist India',
  ],
  alternates: { canonical: `${BASE_URL}/plan` },
  openGraph: {
    title: 'Plan Your Wedding in Patna — Free Wedding Shortlist | ShaadiShopping',
    description:
      'Tell us your date, guest count & budget — get a personalised vendor shortlist and free expert consultation for your dream wedding in India.',
    url: `${BASE_URL}/plan`,
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShaadiShopping',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'ShaadiShopping — Free Wedding Shortlist' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Plan Your Wedding in Patna — Free Wedding Shortlist | ShaadiShopping',
    description: 'Tell us your date, guest count & budget — get a personalised vendor shortlist and free expert consultation.',
    images: ['/opengraph-image'],
  },
};

const planPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Plan your wedding — ShaadiShopping',
  description: 'A short form for a free wedding shortlist and a call with a Wedding Expert in Patna.',
  url: `${BASE_URL}/plan`,
  provider: {
    '@type': 'Organization',
    name: 'ShaadiShopping',
    url: BASE_URL,
  },
};

export default function PlanPage() {
  return (
    <>
      <JsonLd data={planPageJsonLd} />
      <Suspense>
        <PlanPageClient />
      </Suspense>
    </>
  );
}
