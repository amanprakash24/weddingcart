import { Suspense } from 'react';
import type { Metadata } from 'next';
import HomepageClient from '@/components/HomepageClient';
import { JsonLd } from '@/components/JsonLd';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

export const metadata: Metadata = {
  title: "ShaadiShopping — India's #1 Wedding Planning & Vendor Booking Platform",
  description:
    'Book top wedding vendors across India — venues, photographers, caterers, makeup artists, mehndi, decorators & more. Specialising in Patna, Bihar weddings. Free quotes, verified vendors, expert coordination.',
  keywords: [
    'wedding vendors Patna', 'wedding venues Bihar', 'wedding planning Patna',
    'bridal makeup Patna', 'wedding caterers Patna', 'wedding decorators Patna',
    'shaadi vendors Patna', 'best wedding vendors India', 'wedding booking platform India',
  ],
  alternates: { canonical: BASE_URL },
  openGraph: {
    title: "ShaadiShopping — India's #1 Wedding Planning & Vendor Booking Platform",
    description: 'Book top wedding vendors across India — venues, photographers, caterers, makeup artists, mehndi, decorators & more. Specialising in Patna, Bihar weddings.',
    url: BASE_URL,
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShaadiShopping',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: "ShaadiShopping — India's #1 Wedding Planning Platform" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "ShaadiShopping — India's #1 Wedding Planning & Vendor Booking Platform",
    description: 'Book top wedding vendors across India — venues, photographers, caterers, makeup artists, mehndi, decorators & more.',
    images: ['/opengraph-image'],
  },
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'ShaadiShopping',
  url: BASE_URL,
  description: "India's #1 wedding planning & coordination platform — expert-guided from Venue to Vidaai.",
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ShaadiShopping',
  url: BASE_URL,
  logo: `${BASE_URL}/logo.png`,
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+91-76460-28228',
    contactType: 'customer service',
    areaServed: 'IN',
    availableLanguage: ['Hindi', 'English'],
  },
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'T Point, Gola Rd, near Danapur',
    addressLocality: 'Patna',
    addressRegion: 'Bihar',
    postalCode: '801503',
    addressCountry: 'IN',
  },
  email: 'shaadi.shopping51@gmail.com',
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
