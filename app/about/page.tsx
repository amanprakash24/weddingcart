import type { Metadata } from 'next';
import AboutClient from '@/components/AboutClient';
import { JsonLd } from '@/components/JsonLd';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

export const metadata: Metadata = {
  title: "About ShaadiShopping — India's Most Trusted Wedding Planning Platform",
  description:
    'Learn about ShaadiShopping — founded by Anisha Kumari in Patna, Bihar. We connect 10,000+ couples with 500+ verified wedding vendors across 25+ cities in India.',
  alternates: { canonical: `${BASE_URL}/about` },
  openGraph: {
    title: "About ShaadiShopping — India's Most Trusted Wedding Planning Platform",
    description:
      "Our story, mission, and the team behind India's favourite wedding planning platform. Helping couples plan their dream weddings since day one.",
    url: `${BASE_URL}/about`,
    type: 'website',
    locale: 'en_IN',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: "About ShaadiShopping — India's Wedding Planning Platform" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "About ShaadiShopping — India's Most Trusted Wedding Planning Platform",
    description: "Our story, mission, and the team behind India's favourite wedding planning platform.",
    images: ['/opengraph-image'],
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ShaadiShopping',
  url: BASE_URL,
  logo: `${BASE_URL}/logo.png`,
  founder: {
    '@type': 'Person',
    name: 'Anisha Kumari',
    jobTitle: 'Founder & CEO',
  },
  foundingLocation: {
    '@type': 'Place',
    name: 'Patna, Bihar, India',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+91-76460-28228',
    email: 'hello@shaadishopping.com',
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
};

const aboutFaqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is ShaadiShopping?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "ShaadiShopping is India's most trusted wedding planning platform, connecting couples with 500+ verified wedding vendors across 25+ cities. Founded by Anisha Kumari in Patna, Bihar.",
      },
    },
    {
      '@type': 'Question',
      name: 'How does ShaadiShopping work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Browse verified vendors across 20+ categories, compare packages and pricing, book consultations, and plan your entire wedding through one platform. Our expert team also offers personalised planning assistance.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is ShaadiShopping free to use?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes — browsing vendors, comparing quotes, and booking consultations on ShaadiShopping is completely free for couples.',
      },
    },
    {
      '@type': 'Question',
      name: 'How many cities does ShaadiShopping serve?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'ShaadiShopping serves couples across 25+ cities in India including Delhi, Mumbai, Bangalore, Hyderabad, Chennai, Kolkata, Jaipur, Patna, Lucknow, and more.',
      },
    },
  ],
};

export default function AboutPage() {
  return (
    <>
      <JsonLd data={organizationJsonLd} />
      <JsonLd data={aboutFaqJsonLd} />
      <AboutClient />
    </>
  );
}
