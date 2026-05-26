import { Suspense } from 'react';
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
      .select('id name city address ownerPhone category description priceMin priceMax rating reviewCount image')
      .lean<VendorMeta>();
    return vendor;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const vendor = await getVendorMeta(id);

  if (!vendor) return { title: 'Vendor Not Found' };

  const catLabel = CATEGORY_LABELS[vendor.category] ?? vendor.category;
  const title = `${vendor.name} — ${catLabel} in ${vendor.city}`;
  const description = `Book ${vendor.name}, a top ${catLabel} in ${vendor.city}. ${vendor.description.slice(0, 140)}... Packages starting from ₹${vendor.priceMin.toLocaleString('en-IN')}.`;
  const url = `${BASE_URL}/vendors/${id}`;

  return {
    title,
    description,
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

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
      {breadcrumbJsonLd && <JsonLd data={breadcrumbJsonLd} />}
      <Suspense>
        <VendorDetailClient id={id} />
      </Suspense>
    </>
  );
}
