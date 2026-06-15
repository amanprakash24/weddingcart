import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import TouchOfCozyClient from '@/components/TouchOfCozyClient';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';
const PAGE_URL = `${BASE_URL}/lp/touch-of-cozy`;

export const metadata: Metadata = {
  title: 'Touch of Cozy — Banquet Hall & Wedding Venue in Patna | Rajeev Nagar',
  description:
    'Book Touch of Cozy, Patna\'s premier banquet hall & café in Mica Colony, Rajeev Nagar. AC hall, in-house catering from ₹999/plate, 5 guest rooms, valet parking. Weddings, receptions & all events. Get a free quote today.',
  keywords: [
    'Touch of Cozy Patna',
    'Touch of Cozy banquet hall',
    'banquet hall Rajeev Nagar Patna',
    'banquet hall Mica Colony Patna',
    'wedding venue Patna',
    'marriage hall Patna 12',
    'event hall near Atal Path Patna',
    'banquet hall with catering Patna',
    'wedding hall Patna overnight',
    'banquet hall baraat allowed Patna',
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'Touch of Cozy — Banquet Hall & Wedding Venue in Patna',
    description:
      'Premier banquet hall & café in Rajeev Nagar, Patna. In-house catering from ₹999/plate, AC hall, 5 guest rooms, valet parking. Book now via ShaadiShopping.',
    url: PAGE_URL,
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShaadiShopping',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Touch of Cozy — Banquet Hall & Wedding Venue in Patna',
    description:
      'Premier banquet hall in Rajeev Nagar, Patna. In-house catering from ₹999/plate, AC hall, 5 guest rooms. Get a free quote.',
  },
  robots: { index: true, follow: true },
};

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': ['LocalBusiness', 'EventVenue'],
  name: 'Touch of Cozy',
  description:
    "Patna's premier banquet hall, café, and guest stay destination. Located in Mica Colony, Rajeev Nagar, hosting weddings, engagements, receptions, birthdays, and corporate events with personalized care.",
  url: PAGE_URL,
  telephone: '+917986519662',
  priceRange: '₹999 – ₹1,599 per plate',
  openingHours: 'Mo-Su 11:00-24:00',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Road No. 23, Near Atal Path Branch Road, Mica Colony, Rajeev Nagar',
    addressLocality: 'Patna',
    addressRegion: 'Bihar',
    postalCode: '800012',
    addressCountry: 'IN',
  },
  servesCuisine: ['Indian', 'Vegetarian', 'Non-Vegetarian'],
  amenityFeature: [
    { '@type': 'LocationFeatureSpecification', name: 'Air Conditioning', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Parking', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'In-House Catering', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Guest Rooms', value: true },
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: 5.0,
    reviewCount: 1,
    bestRating: 5,
  },
  '@id': PAGE_URL,
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
    { '@type': 'ListItem', position: 2, name: 'Wedding Venues in Patna', item: `${BASE_URL}/categories/venue` },
    { '@type': 'ListItem', position: 3, name: 'Touch of Cozy', item: PAGE_URL },
  ],
};

export default function TouchOfCozyPage() {
  return (
    <>
      <JsonLd data={localBusinessSchema} />
      <JsonLd data={breadcrumbSchema} />
      <TouchOfCozyClient />
    </>
  );
}
