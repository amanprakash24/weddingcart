import { Suspense } from 'react';
import type { Metadata } from 'next';
import CategoryPageClient from '@/components/CategoryPageClient';
import { JsonLd } from '@/components/JsonLd';
import { vendorRepository } from '@/repositories/vendor.repository';
import { toLegacyVendors } from '@/lib/serializers/vendor';
import type { Vendor } from '@/types';

export const revalidate = 3600; // ISR: rebuild every hour

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

const PAGE_NAME = 'Wedding Vendors in Patna';
const PAGE_DESCRIPTION =
  'Browse and compare verified wedding vendors in Patna — venues, makeup artists, decorators, caterers, photographers and more. Real reviews, transparent pricing, free quotes.';
const HERO_IMAGE = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1920&q=80';

// Same PUBLISHED-only gate as app/categories/[slug]/page.tsx's getInitialVendors —
// this is only the SSR/ISR seed; the client's live refetches go through
// GET /api/vendors, which forces anonymous callers to PUBLISHED itself.
async function getInitialVendors(): Promise<Vendor[]> {
  try {
    const { data } = await vendorRepository.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ sortOrder: 'asc' }, { isFeatured: 'desc' }, { rating: 'desc' }],
      take: 24,
    });
    return toLegacyVendors(data);
  } catch {
    return [];
  }
}

export function generateMetadata(): Metadata {
  const url = `${BASE_URL}/vendors`;
  const title = `${PAGE_NAME} — Compare & Book Top Wedding Vendors`;

  return {
    title,
    description: PAGE_DESCRIPTION,
    keywords: [
      'wedding vendors Patna', 'wedding vendors India', 'best wedding vendors Patna',
      'book wedding vendors Patna', 'verified wedding vendors', 'ShaadiShopping',
    ],
    alternates: { canonical: url },
    openGraph: {
      title,
      description: PAGE_DESCRIPTION,
      url,
      type: 'website',
      locale: 'en_IN',
      images: [{ url: HERO_IMAGE, width: 1200, height: 630, alt: PAGE_NAME }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: PAGE_DESCRIPTION,
      images: [HERO_IMAGE],
    },
  };
}

export default async function VendorsPage() {
  const initialVendors = await getInitialVendors();
  const url = `${BASE_URL}/vendors`;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: PAGE_NAME, item: url },
    ],
  };

  const collectionPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${PAGE_NAME} — ShaadiShopping`,
    description: PAGE_DESCRIPTION,
    url,
    image: HERO_IMAGE,
  };

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={collectionPageJsonLd} />
      <Suspense>
        <CategoryPageClient
          initialCoverImage={HERO_IMAGE}
          initialName={PAGE_NAME}
          initialDescription={PAGE_DESCRIPTION}
          initialVendors={initialVendors}
        />
      </Suspense>
    </>
  );
}
