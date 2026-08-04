import type { Metadata } from 'next';
import AboutClient from '@/components/AboutClient';
import { JsonLd } from '@/components/JsonLd';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

export const metadata: Metadata = {
  title: "About ShaadiShopping — Patna's Trusted Wedding Planning Platform",
  description:
    "Learn about ShaadiShopping — founded by Anisha Kumari in Patna, Bihar. Every couple gets one dedicated Wedding Expert from booking to vidaai, completely free.",
  alternates: { canonical: `${BASE_URL}/about` },
  openGraph: {
    title: "About ShaadiShopping — Patna's Trusted Wedding Planning Platform",
    description:
      "Our story, mission, and the team behind Patna's trusted wedding planning platform. Helping couples plan their dream weddings since day one.",
    url: `${BASE_URL}/about`,
    type: 'website',
    locale: 'en_IN',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: "About ShaadiShopping — Patna's Wedding Planning Platform" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "About ShaadiShopping — Patna's Trusted Wedding Planning Platform",
    description: "Our story, mission, and the team behind Patna's trusted wedding planning platform.",
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
    email: 'shaadi.shopping51@gmail.com',
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
        text: "ShaadiShopping is Patna's trusted wedding planning platform, connecting couples with verified wedding vendors. Every couple gets one dedicated Wedding Expert from booking to vidaai, completely free. Founded by Anisha Kumari in Patna, Bihar.",
      },
    },
    {
      '@type': 'Question',
      name: 'How does ShaadiShopping work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Browse verified vendors across every wedding category, compare packages and pricing, book consultations, and plan your entire wedding through one platform. Our expert team also offers personalised planning assistance.',
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
      name: 'Which cities does ShaadiShopping serve?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Patna is the primary and most deeply covered market, with expansion across other Bihar cities served from the same vendor network.',
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
