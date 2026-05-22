import { Suspense } from 'react';
import type { Metadata } from 'next';
import HomepageClient from '@/components/HomepageClient';
import { JsonLd } from '@/components/JsonLd';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

export const metadata: Metadata = {
  title: "ShaadiShopping — India's #1 Wedding Planning Marketplace",
  description:
    'Discover, compare, and book top wedding vendors across India. Find perfect venues, photographers, caterers, makeup artists, and more for your dream wedding.',
  alternates: { canonical: BASE_URL },
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'ShaadiShopping',
  url: BASE_URL,
  description: "India's #1 wedding planning marketplace — discover and book trusted vendors.",
  potentialAction: {
    '@type': 'SearchAction',
    target: `${BASE_URL}/categories/{search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ShaadiShopping',
  url: BASE_URL,
  logo: `${BASE_URL}/logo.png`,
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+91-70704-86987',
    contactType: 'customer service',
    areaServed: 'IN',
    availableLanguage: ['Hindi', 'English'],
  },
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Patna',
    addressRegion: 'Bihar',
    addressCountry: 'IN',
  },
  email: 'hello@shaadishopping.com',
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={websiteSchema} />
      <JsonLd data={organizationSchema} />
      <Suspense>
        <HomepageClient />
      </Suspense>
    </>
  );
}
