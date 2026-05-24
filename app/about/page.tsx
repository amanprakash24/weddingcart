import type { Metadata } from 'next';
import AboutClient from '@/components/AboutClient';
import { JsonLd } from '@/components/JsonLd';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

export const metadata: Metadata = {
  title: 'About ShaadiShopping — India\'s Most Trusted Wedding Marketplace',
  description:
    'Learn about ShaadiShopping — founded by Anisha Kumari in Patna, Bihar. We connect 10,000+ couples with 500+ verified wedding vendors across 25+ cities in India.',
  alternates: { canonical: `${BASE_URL}/about` },
  openGraph: {
    title: 'About ShaadiShopping — India\'s Most Trusted Wedding Marketplace',
    description:
      'Our story, mission, and the team behind India\'s favourite wedding planning platform. Helping couples plan their dream weddings since day one.',
    url: `${BASE_URL}/about`,
    type: 'website',
    locale: 'en_IN',
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

export default function AboutPage() {
  return (
    <>
      <JsonLd data={organizationJsonLd} />
      <AboutClient />
    </>
  );
}
