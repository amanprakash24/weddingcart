import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import VendorDetailClient from '@/components/VendorDetailClient';
import { JsonLd } from '@/components/JsonLd';
import { connectDB } from '@/lib/mongodb';
import VendorModel from '@/lib/models/Vendor';

export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

const CATEGORY_LABELS: Record<string, string> = {
  venue: 'Wedding Venue',
  makeup: 'Bridal Makeup Artist',
  mehndi: 'Mehndi Artist',
  decorator: 'Wedding Decorator',
  band: 'Wedding Band',
  dj: 'DJ Services',
  catering: 'Wedding Caterer',
  'photo-video': 'Wedding Photographer & Videographer',
  accommodation: 'Wedding Accommodation',
  gifts: 'Wedding Gifts',
  invitations: 'Wedding Invitations',
  transport: 'Wedding Transport',
  legal: 'Legal Services',
  hospitality: 'Hospitality Services',
  planning: 'Wedding Planner',
  astro: 'Astrology Services',
  'bridal-lehenga': 'Bridal Lehenga',
  'bridal-jewellery': 'Bridal Jewellery',
  sherwani: 'Sherwani',
  trousseau: 'Trousseau',
  sfx: 'SFX Effects',
  security: 'Security Guards & Bouncers',
};

interface VendorMeta {
  id: string;
  name: string;
  city: string;
  address?: string;
  ownerPhone?: string;
  category: string;
  description: string;
  priceMin: number;
  priceMax: number;
  rating: number;
  reviewCount: number;
  image: string;
  faqs?: { q: string; a: string }[];
}

// Common local search terms people use for venues instead of "wedding venue"
const VENUE_SYNONYMS = ['banquet hall', 'marriage hall', 'shaadi hall', 'wedding hall', 'function hall'];

// Addresses are free-text (e.g. "Rajeev Nagar Road No 23, Near Atal Path Branch Road,
// Mica Colony, Patna-12"). The locality/area name is reliably the segment right before
// the city name — landmark segments before it ("Near X", "Opposite X") are more specific
// than a searchable area name, and segments after it are city/state/pincode.
function extractLocality(address: string | undefined, city: string): string | null {
  if (!address) return null;
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  const cityIdx = parts.findIndex((p) => p.toLowerCase().includes(city.toLowerCase()));
  if (cityIdx <= 0) return null;
  const candidate = parts[cityIdx - 1];
  if (/^(near|opposite)\b/i.test(candidate)) return null;
  return candidate;
}

export async function generateStaticParams() {
  try {
    await connectDB();
    const vendors = await VendorModel.find({}).select('id').lean<{ id: string }[]>();
    return vendors.map((v) => ({ id: v.id }));
  } catch {
    return [];
  }
}

async function getVendorMeta(id: string): Promise<VendorMeta | null> {
  try {
    await connectDB();
    const vendor = await VendorModel.findOne({ id })
      .select('id name city address ownerPhone category description priceMin priceMax rating reviewCount image faqs')
      .lean<VendorMeta>();
    return vendor;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const vendor = await getVendorMeta(id);

  if (!vendor) return { title: 'Not Found', robots: { index: false } };

  const isVenue = vendor.category === 'venue';
  const catLabel = CATEGORY_LABELS[vendor.category] ?? vendor.category;
  const displayLabel = isVenue ? 'Wedding Venue & Banquet Hall' : catLabel;
  const locality = extractLocality(vendor.address, vendor.city);
  const place = locality ? `${locality}, ${vendor.city}` : vendor.city;

  const title = `${vendor.name} — ${displayLabel} in ${place}`;
  const description = `Book ${vendor.name}, a top ${displayLabel.toLowerCase()} in ${place}. ${vendor.description.slice(0, 140)}... Packages starting from ₹${vendor.priceMin.toLocaleString('en-IN')}.`;
  const url = `${BASE_URL}/vendors/${id}`;

  const localityKeywords = locality
    ? [
        `${catLabel} in ${locality}`,
        `${catLabel} near ${locality}`,
        `${vendor.name} ${locality}`,
        ...(isVenue ? VENUE_SYNONYMS.map((s) => `${s} ${locality}`) : []),
      ]
    : [];

  return {
    title,
    description,
    keywords: [
      `${vendor.name}`, `${catLabel} in ${vendor.city}`,
      `${catLabel} ${vendor.city}`, `book ${catLabel} ${vendor.city}`,
      `wedding vendors ${vendor.city}`, `${vendor.city} wedding services`,
      ...(isVenue ? VENUE_SYNONYMS.map((s) => `${s} in ${vendor.city}`) : []),
      ...(isVenue ? [`wedding venue near me ${vendor.city}`] : []),
      ...localityKeywords,
    ],
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      locale: 'en_IN',
      images: vendor.image ? [{ url: vendor.image, width: 1200, height: 630, alt: vendor.name }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: vendor.image ? [vendor.image] : [],
    },
  };
}

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vendor = await getVendorMeta(id);

  if (!vendor) notFound();

  const jsonLd = vendor
    ? {
        '@context': 'https://schema.org',
        '@type': vendor.category === 'venue' ? ['LocalBusiness', 'EventVenue'] : 'LocalBusiness',
        name: vendor.name,
        description: vendor.description,
        image: vendor.image,
        url: `${BASE_URL}/vendors/${id}`,
        address: {
          '@type': 'PostalAddress',
          ...(vendor.address && { streetAddress: vendor.address }),
          addressLocality: vendor.city,
          addressCountry: 'IN',
        },
        ...(vendor.ownerPhone && { telephone: vendor.ownerPhone }),
        priceRange: `₹${vendor.priceMin.toLocaleString('en-IN')} – ₹${vendor.priceMax.toLocaleString('en-IN')}`,
        ...(vendor.reviewCount > 0 && {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: vendor.rating,
            reviewCount: vendor.reviewCount,
            bestRating: 5,
          },
        }),
        '@id': `${BASE_URL}/vendors/${id}`,
      }
    : null;

  const breadcrumbJsonLd = vendor
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: CATEGORY_LABELS[vendor.category] ?? vendor.category, item: `${BASE_URL}/categories/${vendor.category}` },
          { '@type': 'ListItem', position: 3, name: vendor.name, item: `${BASE_URL}/vendors/${id}` },
        ],
      }
    : null;

  // Mirrors the FAQ accordion rendered in VendorDetailClient — keep both in
  // sync so the visible answers match what's marked up as FAQPage schema.
  const faqJsonLd = vendor?.faqs && vendor.faqs.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: vendor.faqs.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      }
    : null;

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
      {breadcrumbJsonLd && <JsonLd data={breadcrumbJsonLd} />}
      {faqJsonLd && <JsonLd data={faqJsonLd} />}
      <Suspense>
        <VendorDetailClient id={id} />
      </Suspense>
    </>
  );
}
