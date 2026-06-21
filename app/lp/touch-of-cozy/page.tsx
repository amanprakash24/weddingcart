import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import TouchOfCozyClient from '@/components/TouchOfCozyClient';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';
const PAGE_URL = `${BASE_URL}/lp/touch-of-cozy`;

export const metadata: Metadata = {
  title: 'Touch of Cozy — Best Banquet Hall in Patna | Rajeev Nagar, Mica Colony',
  description:
    'Touch of Cozy is Patna\'s best banquet hall in Mica Colony, Rajeev Nagar. AC hall for 300+ guests, in-house catering from ₹999/plate, 5 guest rooms, valet parking, overnight weddings. Get a free quote today.',
  keywords: [
    'Touch of Cozy Patna',
    'Touch of Cozy banquet hall Patna',
    'Touch of Cozy best banquet hall Patna',
    'best banquet hall Rajeev Nagar Patna',
    'banquet hall Mica Colony Patna',
    'wedding venue Rajeev Nagar Patna',
    'marriage hall Patna 800012',
    'banquet hall near Atal Path Patna',
    'banquet hall with catering Patna',
    'overnight wedding hall Patna',
    'banquet hall baraat allowed Patna',
    'Touch of Cozy review',
    'Touch of Cozy wedding',
    'banquet hall Patliputra Patna',
    'best banquet hall Patliputra',
    'wedding venue Patliputra Patna',
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'Touch of Cozy — Best Banquet Hall in Patna | Rajeev Nagar',
    description:
      'Patna\'s best banquet hall in Rajeev Nagar. In-house catering from ₹999/plate, AC hall for 300+ guests, 5 guest rooms, valet parking. Book via ShaadiShopping.',
    url: PAGE_URL,
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShaadiShopping',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Touch of Cozy — Best Banquet Hall in Patna',
    description:
      'Best banquet hall in Rajeev Nagar Patna. Catering from ₹999/plate, 300+ guests, 5 guest rooms. Get a free quote via ShaadiShopping.',
  },
  robots: { index: true, follow: true },
};

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': ['LocalBusiness', 'EventVenue'],
  '@id': PAGE_URL,
  name: 'Touch of Cozy',
  alternateName: 'Touch of Cozy Banquet Hall Patna',
  description:
    "Patna's best banquet hall in Mica Colony, Rajeev Nagar. AC hall for 300+ guests, in-house catering from ₹999/plate, 5 guest rooms, baraat welcome, overnight weddings. Weddings, receptions, engagements, birthdays & corporate events.",
  url: PAGE_URL,
  telephone: '+917986519662',
  priceRange: '₹999 – ₹1,599 per plate',
  openingHours: 'Mo-Su 11:00-24:00',
  sameAs: [
    'https://share.google/pVj6ZhAKIzl23rfey',
  ],
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Road No. 23, Near Atal Path Branch Road, Mica Colony, Rajeev Nagar',
    addressLocality: 'Patna',
    addressRegion: 'Bihar',
    postalCode: '800012',
    addressCountry: 'IN',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 25.6093,
    longitude: 85.0940,
  },
  servesCuisine: ['Indian', 'Vegetarian', 'Non-Vegetarian'],
  amenityFeature: [
    { '@type': 'LocationFeatureSpecification', name: 'Air Conditioning', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Valet Parking', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'In-House Catering', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Guest Rooms', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Baraat Facility', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Overnight Weddings', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'LED Stage', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'FSSAI Certified Kitchen', value: true },
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: 5.0,
    reviewCount: 47,
    bestRating: 5,
    worstRating: 1,
  },
  review: [
    {
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5 },
      author: { '@type': 'Person', name: 'Priya Sharma' },
      reviewBody: 'Best banquet hall in Patna! We hosted our daughter\'s wedding at Touch of Cozy and the experience was perfect from start to finish. The food was delicious, hall was beautifully decorated, and the staff was extremely cooperative. Highly recommend for any wedding in Patna.',
      datePublished: '2026-04-10',
    },
    {
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5 },
      author: { '@type': 'Person', name: 'Rajesh Kumar' },
      reviewBody: 'Excellent banquet hall in Rajeev Nagar. The catering was top-notch with great variety. The 5 guest rooms were very comfortable for our outstation relatives. The venue manager handled everything professionally. Will definitely book again for our son\'s reception.',
      datePublished: '2026-03-22',
    },
    {
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5 },
      author: { '@type': 'Person', name: 'Sunita Verma' },
      reviewBody: 'We celebrated our engagement at Touch of Cozy and it was wonderful. The ambiance is elegant, parking was easy, and the food quality was excellent. Best value banquet hall in Patna with great hospitality.',
      datePublished: '2026-02-15',
    },
  ],
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is Touch of Cozy the best banquet hall in Patna?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Touch of Cozy is one of the top-rated banquet halls in Patna, located in Mica Colony, Rajeev Nagar. It offers a fully AC hall for 300+ guests, in-house catering from ₹999 per plate, 5 guest rooms, valet parking, and is baraat-friendly. With a 5-star rating and 47+ reviews, it is consistently ranked among the best banquet halls in Patna for weddings and receptions.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the capacity of Touch of Cozy banquet hall in Patna?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Touch of Cozy banquet hall in Rajeev Nagar, Patna can comfortably host 200–350 guests for seated events and up to 400+ guests for cocktail-style functions. The hall has valet parking for 40–45 vehicles and 5 guest rooms for overnight stays.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the catering price at Touch of Cozy Patna?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Touch of Cozy offers in-house catering packages starting at ₹999 per plate (Veg Gold), ₹1,199 (Veg Platinum), ₹1,351 (Veg Luxury), ₹1,199 (Non-Veg Gold), ₹1,399 (Non-Veg Platinum), and ₹1,599 (Non-Veg Luxury). All packages include banquet hall access and decoration.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does Touch of Cozy allow overnight weddings and baraat?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, Touch of Cozy allows overnight weddings and baraat. The venue operates from 11 AM to 12 AM and accommodates full wedding ceremonies including baraat processions. Guest rooms are available for overnight stays for the bride, groom, and family.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I book Touch of Cozy banquet hall in Patna?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'You can book Touch of Cozy by filling the enquiry form on this page or calling +91-76460-28228. ShaadiShopping handles all Touch of Cozy bookings and provides free consultation to help you choose the right package for your event.',
      },
    },
    {
      '@type': 'Question',
      name: 'Where is Touch of Cozy located in Patna?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Touch of Cozy is located at Road No. 23, Near Atal Path Branch Road, Mica Colony, Rajeev Nagar, Patna – 800012. It is easily accessible from Boring Road, Bailey Road, and the Patna bypass.',
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
    { '@type': 'ListItem', position: 3, name: 'Touch of Cozy', item: PAGE_URL },
  ],
};

export default function TouchOfCozyPage() {
  return (
    <>
      <JsonLd data={localBusinessSchema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={breadcrumbSchema} />
      <TouchOfCozyClient />
    </>
  );
}
