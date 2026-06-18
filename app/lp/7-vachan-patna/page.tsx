import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import SevenVachanClient from '@/components/SevenVachanClient';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';
const PAGE_URL = `${BASE_URL}/lp/7-vachan-patna`;

export const metadata: Metadata = {
  title: '7 Vachan — Banquet Hall & Wedding Venue in Judges Colony, Patna',
  description:
    'Book 7 Vachan, Patna\'s trusted banquet hall near Saguna Mor, Judges Colony. Rated 4.6★ across 55 reviews. AC hall, in-house catering from ₹1,100/plate, 7 guest rooms, in-house DJ, parking. Weddings, receptions & all events. Get a free quote today.',
  keywords: [
    '7 Vachan Patna',
    '7 Vachan banquet hall',
    'banquet hall Judges Colony Patna',
    'banquet hall Saguna Mor Patna',
    'wedding venue Patna',
    'marriage hall Danapur Patna',
    'event hall near Saguna Mor',
    'banquet hall with catering Patna',
    'AC banquet hall Patna 801503',
    'banquet hall Danapur Khagaul Road',
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: '7 Vachan — Banquet Hall & Wedding Venue in Judges Colony, Patna',
    description:
      'Trusted banquet hall near Saguna Mor, Patna. Rated 4.6★ · In-house catering from ₹1,100/plate · 7 guest rooms · AC hall · In-house DJ. Book now via ShaadiShopping.',
    url: PAGE_URL,
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShaadiShopping',
  },
  twitter: {
    card: 'summary_large_image',
    title: '7 Vachan — Banquet Hall & Wedding Venue in Patna',
    description:
      'Trusted banquet hall in Judges Colony, Saguna Mor, Patna. 4.6★ rated · Catering from ₹1,100/plate · 7 rooms. Get a free quote.',
  },
  robots: { index: true, follow: true },
};

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': ['LocalBusiness', 'EventVenue'],
  name: '7 Vachan',
  description:
    "Patna's trusted banquet hall and event venue in Judges Colony, near Saguna Mor, Danapur Khagaul Road. Hosting weddings, receptions, engagements, birthdays, baby showers, and corporate events since 2016. Rated 4.6★ across 55 reviews.",
  url: PAGE_URL,
  telephone: '+919980122191',
  priceRange: '₹1,100 – ₹1,300 per plate',
  openingHours: 'Mo-Su 09:00-22:00',
  foundingDate: '2016',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Near Fashion Factory Godawari Complex, Opposite Purise Hospital, Saguna Mor, Danapur Khagaul Road, Judges Colony',
    addressLocality: 'Patna',
    addressRegion: 'Bihar',
    postalCode: '801503',
    addressCountry: 'IN',
  },
  amenityFeature: [
    { '@type': 'LocationFeatureSpecification', name: 'Air Conditioning', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Parking', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'In-House Catering', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'In-House DJ', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Guest Rooms', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Rooftop Venue', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Wheelchair Accessible', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Play Area', value: true },
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: 4.6,
    reviewCount: 55,
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
    { '@type': 'ListItem', position: 3, name: '7 Vachan', item: PAGE_URL },
  ],
};

export default function SevenVachanPage() {
  return (
    <>
      <JsonLd data={localBusinessSchema} />
      <JsonLd data={breadcrumbSchema} />
      <SevenVachanClient />
    </>
  );
}
