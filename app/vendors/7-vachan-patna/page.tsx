import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import SevenVachanVendorPageClient from '@/components/SevenVachanVendorPageClient';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';
const PAGE_URL = `${BASE_URL}/vendors/7-vachan-patna`;

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
  // ShaadiShopping's own number, not the venue's — all booking enquiries route through us.
  telephone: '+917646028228',
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

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is 7 Vachan a good banquet hall in Patna?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '7 Vachan is a trusted banquet hall in Judges Colony, near Saguna Mor, Patna, rated 4.6★ across 55 reviews. It offers a fully AC hall, in-house catering, 7 guest rooms, an in-house DJ, and parking, making it popular for weddings, receptions, engagements, and corporate events since 2016.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the catering price at 7 Vachan Patna?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '7 Vachan offers in-house catering starting from ₹1,100 per plate, with packages ranging up to ₹1,300 per plate depending on the menu selected.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does 7 Vachan have guest rooms for outstation family?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. 7 Vachan has 7 guest rooms available for outstation family members, which is useful for multi-day wedding functions.',
      },
    },
    {
      '@type': 'Question',
      name: 'Where is 7 Vachan located in Patna?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '7 Vachan is located near Fashion Factory Godawari Complex, opposite Purise Hospital, Saguna Mor, Danapur Khagaul Road, Judges Colony, Patna – 801503.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does 7 Vachan have an in-house DJ and parking?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. 7 Vachan includes an in-house DJ, on-site parking, wheelchair accessibility, a play area, and a rooftop venue option as part of its amenities.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I book a venue visit at 7 Vachan through ShaadiShopping?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Fill the free quote form on the 7 Vachan page, WhatsApp us, or call +91 76460 28228. ShaadiShopping is the authorised booking partner and will confirm date availability, arrange a venue visit, and share pricing at no cost to couples.',
      },
    },
  ],
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
    { '@type': 'ListItem', position: 2, name: 'Venues', item: `${BASE_URL}/venues/patna` },
    { '@type': 'ListItem', position: 3, name: 'Saguna Mor', item: `${BASE_URL}/venues/patna/saguna-mor` },
    { '@type': 'ListItem', position: 4, name: '7 Vachan', item: PAGE_URL },
  ],
};

export default function SevenVachanVendorPage() {
  return (
    <>
      <JsonLd data={localBusinessSchema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={breadcrumbSchema} />
      <SevenVachanVendorPageClient />
    </>
  );
}
