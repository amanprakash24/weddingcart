import { Suspense } from 'react';
import type { Metadata } from 'next';
import PlanPageClient from '@/components/PlanPageClient';
import { JsonLd } from '@/components/JsonLd';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

export const metadata: Metadata = {
  title: 'Plan Your Wedding — Free Wedding Planning Wizard | ShaadiShopping',
  description:
    'Use our free step-by-step wedding planning wizard to organize every detail of your dream wedding in Patna, Bihar & across India. Tell us your date, guest count, and budget — get a personalised vendor shortlist in minutes.',
  keywords: [
    'wedding planning wizard', 'free wedding planner India', 'wedding planning tool',
    'plan my wedding India', 'shaadi planning wizard', 'wedding consultation India',
    'wedding budget planner', 'wedding vendor shortlist', 'plan wedding Patna',
    'wedding planning checklist India',
  ],
  alternates: { canonical: `${BASE_URL}/plan` },
  openGraph: {
    title: 'Plan Your Wedding — Free Wedding Planning Wizard | ShaadiShopping',
    description:
      'Tell us your date, guest count & budget — get a personalised vendor shortlist and free expert consultation for your dream wedding in India.',
    url: `${BASE_URL}/plan`,
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShaadiShopping',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'ShaadiShopping — Free Wedding Planning Wizard' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Plan Your Wedding — Free Wedding Planning Wizard | ShaadiShopping',
    description: 'Tell us your date, guest count & budget — get a personalised vendor shortlist and free expert consultation.',
    images: ['/opengraph-image'],
  },
};

const planPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Wedding Planning Wizard — ShaadiShopping',
  description: 'Free wedding planning tool to shortlist vendors, estimate budget, and book a free expert consultation.',
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
