import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/JsonLd';
import CityPageClient from '@/components/CityPageClient';
import { connectDB } from '@/lib/mongodb';
import VendorModel from '@/lib/models/Vendor';
import { BIHAR_CITIES } from '@/data/biharCities';
import type { Vendor } from '@/types';

export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

// ── City registry ────────────────────────────────────────────────────────────

const CITIES: Record<string, { name: string; state: string; heroImage: string }> = {
  patna:     { name: 'Patna',     state: 'Bihar',        heroImage: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1920&q=80' },
  delhi:     { name: 'Delhi',     state: 'Delhi',        heroImage: 'https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=1920&q=80' },
  mumbai:    { name: 'Mumbai',    state: 'Maharashtra',  heroImage: 'https://images.unsplash.com/photo-1502635385003-ee1e6a1a742d?w=1920&q=80' },
  jaipur:    { name: 'Jaipur',    state: 'Rajasthan',    heroImage: 'https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=1920&q=80' },
  bangalore: { name: 'Bangalore', state: 'Karnataka',    heroImage: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1920&q=80' },
  chennai:   { name: 'Chennai',   state: 'Tamil Nadu',   heroImage: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1920&q=80' },
  hyderabad: { name: 'Hyderabad', state: 'Telangana',    heroImage: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1920&q=80' },
  kolkata:   { name: 'Kolkata',   state: 'West Bengal',  heroImage: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1920&q=80' },
  udaipur:   { name: 'Udaipur',   state: 'Rajasthan',    heroImage: 'https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=1920&q=80' },
  goa:       { name: 'Goa',       state: 'Goa',          heroImage: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1920&q=80' },
  // Bihar expansion cities — served from the Patna vendor network, fully indexed
  ...BIHAR_CITIES,
};

// ── City-specific FAQs ───────────────────────────────────────────────────────

const CITY_FAQS: Record<string, { q: string; a: string }[]> = {
  patna: [
    {
      q: 'What are the best wedding venues in Patna?',
      a: 'Top wedding venues in Patna include Sayamwar Hall & Homestay in Danapur, premium banquet halls on Bailey Road, garden lawns in Phulwari Sharif, and riverside properties. ShaadiShopping lists all verified venues with real packages and pricing.',
    },
    {
      q: 'How much does a wedding cost in Patna, Bihar?',
      a: 'A mid-range wedding in Patna for 300–500 guests costs ₹8–20 lakh including venue, catering, décor, and photography. Budget weddings start from ₹3–5 lakh. Grand celebrations for 700+ guests with full décor, live entertainment, and SFX can reach ₹30–50 lakh.',
    },
    {
      q: 'What is the best wedding season in Bihar?',
      a: 'The peak wedding season in Bihar runs from October to February, with the most auspicious muhurat dates in November, December, and January. Weddings in this window enjoy pleasant weather and the full availability of baraat bands and outdoor venues.',
    },
    {
      q: 'Can I find all wedding vendors in Patna on ShaadiShopping?',
      a: 'Yes — ShaadiShopping lists verified wedding vendors across all categories in Patna: venues, makeup artists, mehndi artists, caterers, decorators, photographers, DJs, and wedding planners. Compare packages and get free quotes from all vendors in one place.',
    },
    {
      q: 'Does ShaadiShopping cover Danapur and surrounding areas of Patna?',
      a: 'Yes. Our Patna listings include vendors and venues from Danapur, Phulwari Sharif, Patna Sahib, Kankarbagh, Boring Road, Bailey Road, and all major localities within the Patna district.',
    },
  ],
};

function biharCityFaqs(slug: string, name: string) {
  const info = BIHAR_CITIES[slug];
  return [
    {
      q: `Does ShaadiShopping provide wedding services in ${name}?`,
      a: `Yes. ShaadiShopping is headquartered in Patna and coordinates weddings across all of Bihar, including ${name} — ${info?.knownFor ?? 'a key wedding market in Bihar'}. ${info?.serviceNote ?? ''}`,
    },
    {
      q: `How much does a wedding cost in ${name}, Bihar?`,
      a: `A mid-range wedding in ${name} for 300–500 guests typically costs ₹6–18 lakh including venue, catering, décor, and photography — generally more affordable than metro cities. Budget weddings start from ₹3–5 lakh. Call ShaadiShopping for a free custom estimate.`,
    },
    {
      q: `Do Patna wedding vendors travel to ${name}?`,
      a: `Yes — our verified decorators, photographers, makeup artists, caterers, DJs and baraat bands regularly serve weddings in ${name} and across Bihar. Travel and logistics are included in your quote upfront, with no hidden charges.`,
    },
    {
      q: `What is the best wedding season in ${name}?`,
      a: `The peak wedding season in Bihar runs from October to February, aligned with the most auspicious muhurat dates in November, December and January. Book vendors 4–6 months ahead for weddings in ${name} during this window.`,
    },
    {
      q: `How do I start planning my wedding in ${name} with ShaadiShopping?`,
      a: `Call or WhatsApp +91-76460-28228 for a free consultation. Our wedding expert will understand your date, guest count and budget, then shortlist verified vendors for your ${name} wedding — venue, catering, décor, photography and more.`,
    },
  ];
}

function defaultFaqs(name: string, state: string) {
  return [
    {
      q: `What are the best wedding venues in ${name}?`,
      a: `ShaadiShopping lists the top verified wedding venues in ${name}, ${state} with real pricing, photos, and packages. Browse banquet halls, garden lawns, hotel ballrooms, and heritage properties.`,
    },
    {
      q: `How much does a wedding cost in ${name}?`,
      a: `Wedding costs in ${name} vary by guest count and services selected. A mid-range wedding for 300–500 guests typically costs ₹10–25 lakh including venue, catering, décor, and photography. Use ShaadiShopping's free planning wizard to get a custom budget estimate.`,
    },
    {
      q: `Can I find all wedding vendors in ${name} on ShaadiShopping?`,
      a: `Yes — ShaadiShopping lists verified wedding vendors across 20+ categories in ${name} including venues, makeup artists, mehndi, caterers, decorators, photographers, DJs, and planners. Compare packages and get free quotes in one place.`,
    },
  ];
}

// ── SSR: pre-fetch initial vendors ───────────────────────────────────────────

async function getInitialVendors(cityName: string, isBihar: boolean): Promise<{ vendors: Vendor[]; fromNetwork: boolean }> {
  try {
    await connectDB();
    const vendors = await VendorModel.find({ city: cityName })
      .sort({ isFeatured: -1, rating: -1 })
      .limit(6)
      .lean();
    if (vendors.length > 0) {
      return { vendors: JSON.parse(JSON.stringify(vendors)) as Vendor[], fromNetwork: false };
    }
    // Bihar cities without local listings: show the Patna network vendors that
    // serve them, so the page is never an empty soft-404.
    if (isBihar && cityName !== 'Patna') {
      const network = await VendorModel.find({ city: 'Patna' })
        .sort({ isFeatured: -1, rating: -1 })
        .limit(6)
        .lean();
      return { vendors: JSON.parse(JSON.stringify(network)) as Vendor[], fromNetwork: true };
    }
    return { vendors: [], fromNetwork: false };
  } catch {
    return { vendors: [], fromNetwork: false };
  }
}

// ── Static params (pre-renders all city pages at build time) ─────────────────

export function generateStaticParams() {
  return Object.keys(CITIES).map((city) => ({ city }));
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const meta = CITIES[city.toLowerCase()];
  if (!meta) return { title: 'City Not Found' };

  const { name, state } = meta;
  const url = `${BASE_URL}/cities/${city}`;
  const isPatna = city.toLowerCase() === 'patna';
  const isBihar = state === 'Bihar';
  const title = isPatna
    ? `Wedding Vendors in Patna, Bihar — Venues, Makeup, Catering & More | ShaadiShopping`
    : isBihar
      ? `Wedding Vendors in ${name}, Bihar — Venues, Makeup, Catering & More | ShaadiShopping`
      : `Wedding Vendors in ${name} — Venues, Makeup, Catering & More | ShaadiShopping`;
  const description = isPatna
    ? `Plan your shaadi in Patna, Bihar with India's most trusted wedding platform. Compare verified wedding venues, makeup artists, caterers, decorators & photographers. Get free quotes from 50+ vendors in Patna.`
    : isBihar
      ? `Plan your shaadi in ${name}, Bihar with ShaadiShopping — Bihar's most trusted wedding platform. Verified venues, makeup artists, caterers, decorators & photographers serving ${name}. Free expert consultation.`
      : `Find the best wedding vendors in ${name}, ${state}. Compare verified venues, makeup artists, caterers, decorators & more. Get free quotes from 50+ wedding vendors in ${name}.`;
  const ogImage = meta.heroImage.split('?')[0] + '?w=1200&h=630&fit=crop&q=80';

  // Non-Bihar cities: noindex until we have real vendor listings there.
  // Bihar cities are indexed — they are genuinely served from the Patna network.
  if (!isBihar) {
    return {
      title,
      description,
      robots: { index: false, follow: false },
    };
  }

  return {
    title,
    description,
    keywords: [
      `wedding vendors ${name}`, `wedding venues ${name}`,
      `wedding planning ${name}`, `bridal makeup ${name}`,
      `wedding caterers ${name}`, `wedding photographers ${name}`,
      `wedding decorators ${name}`, `${name} wedding services`,
      `shaadi vendors ${name}`, `shaadi planning ${name}`,
      `vivah vendors ${name}`, `shadi planning ${name}`,
      `marriage vendors ${name}`, `wedding vendors Bihar`,
      `marriage hall ${name}`, `banquet hall ${name}`,
      `shaadi ${name}`, `wedding planner ${name}`,
    ],
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      locale: 'en_IN',
      images: [{ url: ogImage, width: 1200, height: 630, alt: `Wedding vendors in ${name}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const meta = CITIES[city.toLowerCase()];
  if (!meta) notFound();

  const { name, state, heroImage } = meta;
  const url = `${BASE_URL}/cities/${city}`;
  const citySlug = city.toLowerCase();
  const isBihar = state === 'Bihar';
  const faqs =
    CITY_FAQS[citySlug] ??
    (isBihar ? biharCityFaqs(citySlug, name) : defaultFaqs(name, state));
  const { vendors: initialVendors, fromNetwork } = await getInitialVendors(name, isBihar);

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Cities', item: `${BASE_URL}/cities` },
      { '@type': 'ListItem', position: 3, name: name, item: url },
    ],
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  const localBusinessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: `ShaadiShopping — Wedding Vendors in ${name}`,
    description: `Verified wedding vendors in ${name}, ${state}. Compare venues, makeup artists, caterers, decorators, photographers & more.`,
    url,
    areaServed: {
      '@type': 'City',
      name,
      containedInPlace: {
        '@type': 'State',
        name: state,
        containedInPlace: { '@type': 'Country', name: 'India' },
      },
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: name,
      addressRegion: state,
      addressCountry: 'IN',
    },
    telephone: '+91-76460-28228',
    '@id': url,
  };

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={faqJsonLd} />
      <JsonLd data={localBusinessJsonLd} />
      <Suspense>
        <CityPageClient
          cityName={name}
          stateName={state}
          faqs={faqs}
          heroImage={heroImage}
          initialVendors={initialVendors}
          networkFallback={fromNetwork ? 'Patna' : undefined}
        />
      </Suspense>
    </>
  );
}
