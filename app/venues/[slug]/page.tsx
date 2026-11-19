import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import VenuePage from '@/components/listing/VenuePage';
import { vendorRepository, type VendorWithRelations } from '@/repositories/vendor.repository';
import { categoryRepository } from '@/repositories/category.repository';
import { reviewService } from '@/services/review.service';
import { toLegacyVendor } from '@/lib/serializers/vendor';
import { withoutOwnerContact } from '@/lib/vendor/publicVendor';
import { toVenueView } from '@/lib/listing/venueView';
import { toListing } from '@/lib/listing/venueListing';
import type { Vendor } from '@/types';

// The master venue page (founder-approved design, 19 Nov 2026): every published venue, at /venues/<slug>, rendered by
// the one template in components/listing/VenuePage.tsx from its own listing. A new venue needs no new page.
// Old /vendors/<venue-slug> links forward here permanently (app/vendors/[id]/page.tsx, next.config.ts).
export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

export async function generateStaticParams() {
  try {
    const venue = await categoryRepository.findBySlug('venue');
    if (!venue) return [];
    const { data } = await vendorRepository.findMany({ where: { status: 'PUBLISHED', categoryId: venue.id } });
    return data.map((v) => ({ slug: v.slug }));
  } catch {
    return [];
  }
}

// A published venue, or null (unknown slug, not published yet, or not a venue).
async function loadVenue(slug: string): Promise<VendorWithRelations | null> {
  try {
    const row = await vendorRepository.findBySlug(slug);
    if (!row || row.status !== 'PUBLISHED') return null;
    const category = await categoryRepository.findById(row.categoryId);
    return category?.slug === 'venue' ? row : null;
  } catch {
    return null;
  }
}


export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const row = await loadVenue(slug);
  if (!row) return { title: 'Not Found', robots: { index: false, follow: false } };
  const v = toVenueView(toListing(row));
  const url = `${BASE_URL}/venues/${v.slug}`;
  const title = `${v.name} — Wedding Venue & Banquet Hall in ${v.place}`;
  const starting = v.facts.find((f) => f.label === 'Starting price')?.value;
  const description = `${v.name} in ${v.place}: ${v.about.slice(0, 140)}${v.about.length > 140 ? '…' : ''}${starting && starting !== 'Ask us' ? ` From ${starting}.` : ''} Check your date free with a Wedding Expert.`;
  const image = v.photos[0];
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { title, description, url, type: 'website', locale: 'en_IN', images: image ? [{ url: image, width: 1200, height: 630, alt: v.name }] : [] },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : [] },
  };
}

export default async function VenueSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const row = await loadVenue(slug);
  if (!row) notFound();

  const view = toVenueView(toListing(row));
  // Only public fields reach the browser: no owner name, phone or email.
  const vendor = withoutOwnerContact(toLegacyVendor(row, 'venue')) as Vendor;
  const verified = await reviewService.publicForVendor(row.id).catch(() => null);
  const url = `${BASE_URL}/venues/${view.slug}`;

  const venueJsonLd = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'EventVenue'],
    '@id': url,
    name: view.name,
    description: view.about || undefined,
    image: view.photos.length > 0 ? view.photos : undefined,
    url,
    address: { '@type': 'PostalAddress', streetAddress: view.address, addressLocality: row.city, addressCountry: 'IN' },
    ...(row.guestCapacity ? { maximumAttendeeCapacity: row.guestCapacity } : {}),
    ...(row.reviewCount > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: row.rating, reviewCount: row.reviewCount, bestRating: 5 } } : {}),
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Venues in Patna', item: `${BASE_URL}/cities/patna/venue` },
      { '@type': 'ListItem', position: 3, name: view.name, item: url },
    ],
  };
  // The same questions and answers the page shows.
  const faqJsonLd = view.faqs.length > 0
    ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: view.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
    : null;

  return (
    <>
      <JsonLd data={venueJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      {faqJsonLd && <JsonLd data={faqJsonLd} />}
      <VenuePage view={view} vendor={vendor} verified={verified} />
    </>
  );
}
