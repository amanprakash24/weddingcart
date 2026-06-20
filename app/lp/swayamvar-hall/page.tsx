import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import SwayamvarLandingClient from '@/components/SwayamvarLandingClient';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

export const metadata: Metadata = {
  title: 'Sayamwar Hall & Homestay — Premium Banquet & Wedding Venue in Patna',
  description: 'Book Sayamwar Hall & Homestay in Patna for your wedding, reception or corporate event. AC banquet hall, in-house catering, home stay accommodation. Get a free quote today.',
  keywords: [
    'Sayamwar Hall Patna', 'banquet hall Patna', 'wedding venue Patna',
    'Sayamwar Hall & Homestay', 'marriage hall Patna', 'event venue Patna Bihar',
    'banquet hall near Danapur', 'wedding hall Gola Road Patna',
  ],
  alternates: { canonical: `${BASE_URL}/lp/swayamvar-hall` },
  openGraph: {
    title: 'Sayamwar Hall & Homestay — Premium Banquet Venue in Patna',
    description: 'Premium banquet hall for weddings & receptions in Patna. AC hall, in-house catering, home stay. Book now via ShaadiShopping.',
    url: `${BASE_URL}/lp/swayamvar-hall`,
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShaadiShopping',
  },
  robots: { index: true, follow: true },
};

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': ['LocalBusiness', 'EventVenue'],
  name: 'Sayamwar Hall & Homestay',
  description: 'Premium banquet hall and home stay for weddings, receptions and events in Patna, Bihar.',
  url: `${BASE_URL}/lp/swayamvar-hall`,
  telephone: '+91-76460-28228',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Gola Road, Adarsh Vihar Colony, Lane 5, near T Point, beside Hotel King Regency',
    addressLocality: 'Patna',
    addressRegion: 'Bihar',
    postalCode: '801503',
    addressCountry: 'IN',
  },
};

export default function SwayamvarLandingPage() {
  return (
    <>
      <JsonLd data={localBusinessSchema} />
      <SwayamvarLandingClient />
    </>
  );
}
