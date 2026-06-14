import { Suspense } from 'react';
import type { Metadata } from 'next';
import HomepageClient from '@/components/HomepageClient';
import { JsonLd } from '@/components/JsonLd';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

export const metadata: Metadata = {
  title: "ShaadiShopping — #1 Shaadi Planning & Wedding Vendor Booking in India",
  description:
    'Plan your shaadi with India\'s most trusted wedding platform. Book venues, photographers, caterers, makeup artists, mehndi & decorators in Patna, Bihar & across India. Free quotes, verified vendors, expert coordination.',
  keywords: [
    'shaadi', 'shaadi planning', 'shadi planning', 'shaadi vendors', 'online shaadi booking',
    'wedding vendors Patna', 'wedding venues Bihar', 'wedding planning Patna',
    'bridal makeup Patna', 'wedding caterers Patna', 'wedding decorators Patna',
    'shaadi vendors Patna', 'best wedding vendors India', 'wedding booking platform India',
    'vivah planning India', 'byah planning Bihar', 'wedding platform Bihar',
    'shaadi ki tayari', 'wedding vendors near me', 'top wedding vendors Patna',
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
  alternateName: ['Shaadi Shopping', 'ShaadiShopping.com', 'शादी शॉपिंग'],
  url: BASE_URL,
  description: "India's #1 shaadi planning & wedding vendor booking platform — expert-guided from Venue to Vidaai.",
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${BASE_URL}/cities/patna/venue?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ShaadiShopping',
  alternateName: ['Shaadi Shopping', 'शादी शॉपिंग'],
  url: BASE_URL,
  logo: `${BASE_URL}/logo.png`,
  sameAs: [
    'https://www.shaadishopping.com',
  ],
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
  foundingLocation: {
    '@type': 'Place',
    name: 'Patna, Bihar, India',
  },
  areaServed: [
    { '@type': 'City', name: 'Patna' },
    { '@type': 'State', name: 'Bihar' },
    { '@type': 'Country', name: 'India' },
  ],
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
