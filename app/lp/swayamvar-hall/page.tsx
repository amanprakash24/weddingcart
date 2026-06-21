import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import SwayamvarLandingClient from '@/components/SwayamvarLandingClient';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';
const PAGE_URL = `${BASE_URL}/lp/swayamvar-hall`;

export const metadata: Metadata = {
  title: 'Swayamvar Hall & Homestay — Best Banquet Hall in Danapur, Patna',
  description:
    'Swayamvar Hall & Homestay is Patna\'s trusted banquet hall in Danapur. AC hall for 500+ guests, in-house catering from ₹1,000/plate, homestay accommodation, ample parking. Get a free quote today.',
  keywords: [
    'Swayamvar Hall Patna',
    'Swayamvar Hall & Homestay',
    'banquet hall Danapur Patna',
    'best banquet hall Danapur',
    'wedding venue Danapur Patna',
    'banquet hall Gola Road Patna',
    'banquet hall near Chanakya Puri Patna',
    'marriage hall Danapur Patna',
    'wedding hall Patna 500 guests',
    'banquet hall with homestay Patna',
    'large banquet hall Patna',
    'Swayamvar Hall review',
    'Swayamvar Hall wedding',
    'banquet hall Patna Bihar',
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'Swayamvar Hall & Homestay — Best Banquet Hall in Danapur, Patna',
    description:
      'Trusted banquet hall in Danapur, Patna. AC hall for 500+ guests, in-house catering from ₹1,000/plate, homestay accommodation. Book via ShaadiShopping.',
    url: PAGE_URL,
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShaadiShopping',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Swayamvar Hall & Homestay — Best Banquet Hall in Danapur, Patna',
    description:
      'Best banquet hall in Danapur Patna. 500+ guests, catering from ₹1,000/plate, homestay included. Get a free quote via ShaadiShopping.',
  },
  robots: { index: true, follow: true },
};

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': ['LocalBusiness', 'EventVenue'],
  '@id': PAGE_URL,
  name: 'Swayamvar Hall & Homestay',
  alternateName: 'Swayamvar Banquet Hall Patna',
  description:
    "Patna's trusted banquet hall in Danapur. AC hall for 500+ guests, in-house catering from ₹1,000/plate, homestay accommodation, dedicated event coordinator. Ideal for weddings, receptions, engagements & corporate events.",
  url: PAGE_URL,
  telephone: '+917646028228',
  priceRange: '₹1,000 – ₹1,300 per plate',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'T Point, Gola Road, near Chanakya Puri',
    addressLocality: 'Danapur, Patna',
    addressRegion: 'Bihar',
    postalCode: '801503',
    addressCountry: 'IN',
  },
  amenityFeature: [
    { '@type': 'LocationFeatureSpecification', name: 'Air Conditioning', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Parking', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'In-House Catering', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Homestay Accommodation', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Power Backup', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Stage & Sound Setup', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Décor & Floral Arrangements', value: true },
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: 4.8,
    reviewCount: 500,
    bestRating: 5,
    worstRating: 1,
  },
  review: [
    {
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5 },
      author: { '@type': 'Person', name: 'Amit Kumar' },
      reviewBody: 'Swayamvar Hall is the best banquet hall in Danapur, Patna. We hosted our son\'s wedding here and everything was flawless. The decoration was beautiful, catering was excellent, and the staff was very professional throughout.',
      datePublished: '2025-05-10',
    },
    {
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5 },
      author: { '@type': 'Person', name: 'Neha Singh' },
      reviewBody: 'Wonderful experience at Swayamvar Hall! The homestay facility was a lifesaver for our outstation family members. Spacious hall, great food, and the coordinator handled every detail.',
      datePublished: '2025-03-22',
    },
    {
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5 },
      author: { '@type': 'Person', name: 'Rakesh Prasad' },
      reviewBody: 'Hosted my daughter\'s reception at Swayamvar Hall. Easily accommodated 400+ guests with proper seating and parking. The in-house catering quality was top notch.',
      datePublished: '2025-01-18',
    },
  ],
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is Swayamvar Hall the best banquet hall in Danapur, Patna?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Swayamvar Hall & Homestay is one of the top-rated banquet halls in Danapur, Patna, with 4.8★ across 500+ events. Located on Gola Road near Chanakya Puri, it offers a fully AC hall for up to 500 guests, in-house catering, homestay accommodation, and a dedicated event coordinator.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the capacity of Swayamvar Hall?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Swayamvar Hall can accommodate up to 500 guests for weddings and large receptions. It is one of the larger banquet halls in the Danapur-Patna area, making it ideal for grand weddings and multi-day celebrations.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the per plate price at Swayamvar Hall Patna?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Swayamvar Hall offers in-house catering starting at ₹1,000 per plate (Vegetarian) and ₹1,300 per plate (Non-Vegetarian). Packages include hall access, basic décor, parking, and a dedicated event coordinator.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does Swayamvar Hall have homestay accommodation?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Swayamvar Hall has homestay accommodation available for outstation guests and family members. This is a significant advantage for multi-day wedding functions where out-of-town relatives need comfortable overnight stays.',
      },
    },
    {
      '@type': 'Question',
      name: 'Where is Swayamvar Hall located in Patna?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Swayamvar Hall is located at T Point, Gola Road, near Chanakya Puri, Danapur, Patna – 801503. It is well connected from all parts of Patna and easily accessible from the Patna bypass.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I book Swayamvar Hall through ShaadiShopping?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Fill the free quote form on the Swayamvar Hall page or call +91 76460 28228. ShaadiShopping is the authorised booking partner. Our Patna team will check date availability and share pricing — completely free for couples.',
      },
    },
  ],
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
    { '@type': 'ListItem', position: 2, name: 'Wedding Venues in Patna', item: `${BASE_URL}/categories/venue` },
    { '@type': 'ListItem', position: 3, name: 'Swayamvar Hall & Homestay', item: PAGE_URL },
  ],
};

export default function SwayamvarLandingPage() {
  return (
    <>
      <JsonLd data={localBusinessSchema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={breadcrumbSchema} />
      <SwayamvarLandingClient />
    </>
  );
}
