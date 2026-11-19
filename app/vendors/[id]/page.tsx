import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import VendorListingPage from '@/components/listing/VendorListingPage';
import { reviewService } from '@/services/review.service';
import { JsonLd } from '@/components/JsonLd';
import { vendorRepository, type VendorWithRelations } from '@/repositories/vendor.repository';
import { categoryRepository } from '@/repositories/category.repository';
import { toLegacyVendor } from '@/lib/serializers/vendor';
import { withoutOwnerContact } from '@/lib/vendor/publicVendor';
import { toVendorView } from '@/lib/listing/vendorView';
import type { Vendor } from '@/types';

// Every non-venue listing (photographers, caterers, decorators, …) renders through ONE master page per category:
// components/listing/VendorListingPage.tsx with lib/listing/categoryTemplates.ts (founder-approved, 19 Nov 2026).
// Venues forward to /venues/<slug>. A new listing gets its page automatically.

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
  dbId: string; // the vendor row id (verified reviews are keyed on it)
  row: VendorWithRelations; // the listing itself, for the page
  name: string;
  city: string;
  address?: string;
  category: string;
  description: string;
  priceMin: number;
  priceMax: number;
  rating: number;
  reviewCount: number;
  image: string;
  faqs?: { q: string; a: string }[];
  locality?: string;
  openingHours?: string[];
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

// "saguna-more" -> "Saguna More" — turns the admin-set locality slug into display text
function humanizeSlug(slug: string): string {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export async function generateStaticParams() {
  try {
    const { data } = await vendorRepository.findMany({ where: { status: 'PUBLISHED' } });
    return data.map((v) => ({ id: v.slug }));
  } catch {
    return [];
  }
}

// locality/openingHours have no Prisma equivalent — they were Mongo-only
// fields, confirmed unset on every live vendor today (0 of 87), so both
// callers' existing fallback paths (extractLocality() from address; omit
// openingHours from JSON-LD when absent) already produce identical output.
async function getVendorMeta(id: string): Promise<VendorMeta | null> {
  try {
    const vendor = await vendorRepository.findBySlug(id);
    if (!vendor || vendor.status !== 'PUBLISHED') return null;
    const category = await categoryRepository.findById(vendor.categoryId);
    return {
      id: vendor.slug,
      dbId: vendor.id,
      row: vendor,
      name: vendor.name,
      city: vendor.city,
      address: vendor.address || undefined,
      category: category?.slug ?? '',
      description: vendor.description,
      priceMin: vendor.priceMin,
      priceMax: vendor.priceMax,
      rating: vendor.rating,
      reviewCount: vendor.reviewCount,
      image: vendor.image,
      faqs: vendor.faqs.map((f) => ({ q: f.question, a: f.answer })),
      locality: undefined,
      openingHours: undefined,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const vendor = await getVendorMeta(id);

  if (!vendor) return { title: 'Not Found', robots: { index: false, follow: false } };

  const isVenue = vendor.category === 'venue';
  const catLabel = CATEGORY_LABELS[vendor.category] ?? vendor.category;
  const displayLabel = isVenue ? 'Wedding Venue & Banquet Hall' : catLabel;
  const locality = vendor.locality ? humanizeSlug(vendor.locality) : extractLocality(vendor.address, vendor.city);
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
    robots: { index: true, follow: true },
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
  // Venues have one master page at /venues/<slug> (19 Nov 2026); old /vendors/<venue> links forward there permanently.
  if (vendor.category === 'venue') permanentRedirect(`/venues/${vendor.id}`);
  // Roadmap 1.4: published couple reviews only. A failure here never breaks the vendor page.
  const verified = await reviewService.publicForVendor(vendor.dbId).catch(() => null);
  const row = vendor.row;
  const view = toVendorView({
    slug: row.slug, name: row.name, category: vendor.category, city: row.city, address: row.address, area: row.area,
    priceMin: row.priceMin, priceMax: row.priceMax, priceUnit: row.priceUnit, rating: row.rating, reviewCount: row.reviewCount,
    image: row.image, images: row.images, virtualTourVideo: row.virtualTourVideo, description: row.description, features: row.features,
    packages: row.packages.map((p) => ({ id: p.id, name: p.name, price: p.price, features: p.features, isPerPlate: p.isPerPlate })),
    faqs: row.faqs.map((f) => ({ q: f.question, a: f.answer })),
  });
  // Only public fields reach the browser: no owner name, phone or email.
  const publicVendor = withoutOwnerContact(toLegacyVendor(row, vendor.category)) as Vendor;

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
        ...(vendor.openingHours && vendor.openingHours.length > 0 && { openingHours: vendor.openingHours }),
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

  // The same questions and answers the page shows.
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
      <VendorListingPage view={view} vendor={publicVendor} category={vendor.category} verified={verified} />
    </>
  );
}
