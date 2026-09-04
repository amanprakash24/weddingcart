import type { Metadata } from 'next';
import AboutClient from '@/components/AboutClient';
import { JsonLd } from '@/components/JsonLd';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

export const metadata: Metadata = {
  title: 'About ShaadiShopping — The Wedding Ecosystem, Powered by Vivah OS',
  description:
    "ShaadiShopping is Patna's trusted wedding planning platform — discovery, planning, booking, and execution for couples, venues, and vendors, run on our own technology platform, Vivah OS. Founded by Anisha Kumari, co-founded by Gaurav Sudhanshu.",
  alternates: { canonical: `${BASE_URL}/about` },
  openGraph: {
    title: 'About ShaadiShopping — The Wedding Ecosystem, Powered by Vivah OS',
    description:
      "Our story, our mission, and the team building Patna's trusted wedding planning platform — from the first Shaadi conversation to the final Vidaai.",
    url: `${BASE_URL}/about`,
    type: 'website',
    locale: 'en_IN',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: "About ShaadiShopping — The Wedding Ecosystem Powered by Vivah OS" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About ShaadiShopping — The Wedding Ecosystem, Powered by Vivah OS',
    description: "Our story, our mission, and the team behind Patna's trusted wedding planning platform.",
    images: ['/opengraph-image'],
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ShaadiShopping',
  url: BASE_URL,
  logo: `${BASE_URL}/logo.png`,
  founder: [
    {
      '@type': 'Person',
      name: 'Anisha Kumari',
      jobTitle: 'Founder',
    },
    {
      '@type': 'Person',
      name: 'Gaurav Sudhanshu',
      jobTitle: 'Co-founder',
    },
  ],
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
        text: "ShaadiShopping is a complete wedding ecosystem covering discovery, planning, booking, and execution for couples, venues, and vendors — connected by our own technology platform, Vivah OS. Every couple gets one dedicated Wedding Expert from booking to vidaai, completely free. Founded by Anisha Kumari, co-founded by Gaurav Sudhanshu, in Patna, Bihar.",
      },
    },
    {
      '@type': 'Question',
      name: 'What is Vivah OS?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Vivah OS is the technology and operations platform running behind every ShaadiShopping wedding — connecting the CRM/lead pipeline, Wedding Workspace, Vendor OS, finance, and customer portal on one system, so nothing gets lost between a couple, their venue, and their vendors.",
      },
    },
    {
      '@type': 'Question',
      name: 'How does ShaadiShopping work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Browse verified vendors across every wedding category, compare packages and pricing, book consultations, and plan your entire wedding through one platform. Our expert team also offers personalised planning assistance, coordinated end-to-end through Vivah OS.',
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
        text: 'Patna is the primary and most deeply covered market, with expansion across other Bihar cities served from the same vendor network — and a longer-term vision of serving couples across India and destination weddings beyond it.',
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
