import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { vendorRepository } from '@/repositories/vendor.repository';
import { categoryRepository } from '@/repositories/category.repository';
import { JsonLd } from '@/components/JsonLd';
import VendorPortfolioClient from '@/components/VendorPortfolioClient';

export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

const CATEGORY_LABELS: Record<string, string> = {
  venue: 'Wedding Venue', makeup: 'Bridal Makeup Artist', mehndi: 'Mehndi Artist',
  decorator: 'Wedding Decorator', band: 'Wedding Band', dj: 'DJ Services',
  catering: 'Wedding Caterer', 'photo-video': 'Photographer & Videographer',
  accommodation: 'Accommodation', gifts: 'Gifts', invitations: 'Invitations',
  transport: 'Transport', legal: 'Legal Services', hospitality: 'Hospitality',
  planning: 'Wedding Planner', astro: 'Astrology', 'bridal-lehenga': 'Bridal Lehenga',
  'bridal-jewellery': 'Bridal Jewellery', sherwani: 'Sherwani', trousseau: 'Trousseau',
  sfx: 'SFX Effects', security: 'Security',
};

interface VendorMeta {
  id: string; name: string; city: string; category: string;
  description: string; priceMin: number; priceMax: number;
  rating: number; reviewCount: number; image: string;
}

export async function generateStaticParams() {
  try {
    const { data } = await vendorRepository.findMany({ where: { status: 'PUBLISHED' } });
    return data.map((v) => ({ id: v.slug }));
  } catch { return []; }
}

async function getVendor(id: string): Promise<VendorMeta | null> {
  try {
    const vendor = await vendorRepository.findBySlug(id);
    if (!vendor || vendor.status !== 'PUBLISHED') return null;
    const category = await categoryRepository.findById(vendor.categoryId);
    return {
      id: vendor.slug,
      name: vendor.name,
      city: vendor.city,
      category: category?.slug ?? '',
      description: vendor.description,
      priceMin: vendor.priceMin,
      priceMax: vendor.priceMax,
      rating: vendor.rating,
      reviewCount: vendor.reviewCount,
      image: vendor.image,
    };
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const vendor = await getVendor(id);
  if (!vendor) return { title: 'Portfolio Not Found', robots: { index: false, follow: false } };

  const cat = CATEGORY_LABELS[vendor.category] ?? vendor.category;
  const title = `${vendor.name} — ${cat} in ${vendor.city} | Portfolio`;
  const description = `View the portfolio of ${vendor.name}, a verified ${cat} in ${vendor.city}. ${vendor.description.slice(0, 130)}... Verified by ShaadiShopping.`;

  // Same vendor entity/content as /vendors/[id] (this page is a shareable,
  // admin-generated presentation of it, copied via AdminClient's "copy
  // portfolio link" — not a distinct browsing path; nothing in the public
  // site links here). Canonical points at /vendors/[id], the page every
  // category/city listing and the JSON-LD @id below already treat as
  // authoritative, so search engines consolidate ranking signal onto one
  // URL instead of splitting it across two near-identical pages.
  const canonicalUrl = `${BASE_URL}/vendors/${id}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'website',
      locale: 'en_IN',
      images: vendor.image ? [{ url: vendor.image, width: 1200, height: 630, alt: vendor.name }] : [],
    },
    twitter: { card: 'summary_large_image', title, description, images: vendor.image ? [vendor.image] : [] },
  };
}

export default async function PortfolioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vendor = await getVendor(id);
  if (!vendor) notFound();

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${BASE_URL}/vendors/${id}`,
    name: vendor.name,
    description: vendor.description,
    image: vendor.image,
    url: `${BASE_URL}/vendors/${id}`,
    address: { '@type': 'PostalAddress', addressLocality: vendor.city, addressCountry: 'IN' },
    priceRange: `₹${vendor.priceMin.toLocaleString('en-IN')} – ₹${vendor.priceMax.toLocaleString('en-IN')}`,
    ...(vendor.reviewCount > 0 && {
      aggregateRating: { '@type': 'AggregateRating', ratingValue: vendor.rating, reviewCount: vendor.reviewCount, bestRating: 5 },
    }),
  };

  return (
    <>
      <JsonLd data={schema} />
      <Suspense>
        <VendorPortfolioClient id={id} />
      </Suspense>
    </>
  );
}
