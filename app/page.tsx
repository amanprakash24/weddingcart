import { Suspense } from 'react';
import type { Metadata } from 'next';
import HomepageClient from '@/components/HomepageClient';
import { JsonLd } from '@/components/JsonLd';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

export const metadata: Metadata = {
  title: "Shaadi Shopping | Trusted Wedding Planning & Verified Vendors in Patna",
  description:
    'Plan your wedding with confidence. Compare verified banquet halls, photographers, caterers, decorators and more in Patna. Get a dedicated Wedding Expert from planning to vidai—free of cost.',
  alternates: { canonical: BASE_URL },
  openGraph: {
    title: "ShaadiShopping — Wedding Planning in Patna",
    description: 'Your trusted wedding planner in Patna. Find verified wedding vendors and wedding services, with a dedicated expert guiding you from planning to vidai.',
    url: BASE_URL,
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShaadiShopping',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'ShaadiShopping — Wedding Planning in Patna' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "ShaadiShopping — Wedding Planning in Patna",
    description: 'Your trusted wedding planner in Patna. Find verified wedding vendors and wedding services, with a dedicated expert guiding you from planning to vidai.',
    images: ['/opengraph-image'],
  },
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'ShaadiShopping',
  alternateName: ['Shaadi Shopping', 'ShaadiShopping.com', 'शादी शॉपिंग'],
  url: BASE_URL,
  description: 'Shaadi Shopping helps families plan weddings in Patna with verified venues, trusted vendors, transparent quotations, and one dedicated Wedding Expert from planning to vidai.',
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
    'https://www.instagram.com/shaadishopping',
    'https://www.facebook.com/shaadishopping',
    'https://wa.me/917646028228',
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
    streetAddress: 'Gola Road, Adarsh Vihar Colony, Lane 5, near T Point, beside Hotel King Regency',
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
    { '@type': 'City', name: 'Muzaffarpur' },
    { '@type': 'City', name: 'Gaya' },
    { '@type': 'City', name: 'Bhagalpur' },
    { '@type': 'City', name: 'Darbhanga' },
    { '@type': 'City', name: 'Purnia' },
    { '@type': 'City', name: 'Arrah' },
    { '@type': 'City', name: 'Begusarai' },
    { '@type': 'City', name: 'Chhapra' },
    { '@type': 'City', name: 'Hajipur' },
    { '@type': 'City', name: 'Bihar Sharif' },
    { '@type': 'City', name: 'Motihari' },
    { '@type': 'City', name: 'Samastipur' },
    { '@type': 'State', name: 'Bihar' },
    { '@type': 'Country', name: 'India' },
  ],
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What wedding services does ShaadiShopping provide in Patna?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'ShaadiShopping provides complete wedding planning services in Patna including wedding venues, banquet halls, bridal makeup artists, wedding photographers, mehndi artists, wedding decorators, caterers, DJ services, wedding bands, and wedding planners. All vendors are verified and we offer free expert consultation.',
      },
    },
    {
      '@type': 'Question',
      name: 'How much does a wedding cost in Patna?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A wedding in Patna typically costs between ₹5 lakh to ₹50 lakh depending on guest count, venue, and services. Budget weddings for 200–300 guests start around ₹5–10 lakh. ShaadiShopping helps you plan within your budget with verified vendors offering competitive rates.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which are the best banquet halls in Patna for weddings?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Top banquet halls in Patna for weddings include Swayamvar Hall & Homestay (Danapur, up to 700 guests), Touch of Cozy (Rajeev Nagar), and 7 Vachan (Saguna Mor). ShaadiShopping has verified 50+ venues across Patna with pricing from ₹999/plate.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is ShaadiShopping free to use?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, ShaadiShopping is completely free for couples. You can browse vendors, get quotes, and consult with our wedding experts at no charge. We offer a free wedding planning consultation to help you shortlist the best vendors within your budget.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I book a wedding venue through ShaadiShopping?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Simply visit shaadishopping.com, click "Begin Your Journey" or call +91-76460-28228. Our wedding expert will understand your requirements, shortlist venues matching your guest count and budget, arrange site visits, and help you finalise the booking — all for free.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does ShaadiShopping plan weddings outside Patna?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, ShaadiShopping plans weddings across India including Delhi, Mumbai, Jaipur, Bangalore, Udaipur, Goa, Hyderabad, Chennai, and Kolkata. We specialise in destination weddings and have a network of 500+ verified vendors across 25+ cities.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the difference between ShaadiShopping and other wedding platforms?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Unlike listing-only platforms, ShaadiShopping assigns you a dedicated wedding expert who personally guides your entire wedding — from vendor selection to final execution. We don\'t just list vendors; we coordinate, negotiate, and manage every detail so you can enjoy your wedding stress-free.',
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={websiteSchema} />
      <JsonLd data={organizationSchema} />
      <JsonLd data={faqSchema} />
      <Suspense>
        <HomepageClient />
      </Suspense>
    </>
  );
}
