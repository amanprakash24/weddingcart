import { Suspense } from 'react';
import type { Metadata } from 'next';
import CategoryPageClient from '@/components/CategoryPageClient';
import { JsonLd } from '@/components/JsonLd';
import { connectDB } from '@/lib/mongodb';
import CategoryModel from '@/lib/models/Category';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

const SLUG_TO_NAME: Record<string, string> = {
  venue: 'Venues', makeup: 'Makeup Artists', mehndi: 'Mehndi Artists',
  decorator: 'Decorators', band: 'Band & Music', dj: 'DJ Services',
  catering: 'Catering Services', 'photo-video': 'Photographers & Videographers',
  accommodation: 'Accommodation', gifts: 'Gifts & Favours', invitations: 'Invitations',
  transport: 'Transport', legal: 'Legal Services', hospitality: 'Hospitality',
  planning: 'Wedding Planners', astro: 'Astrology', 'bridal-lehenga': 'Bridal Lehenga',
  'bridal-jewellery': 'Bridal Jewellery', sherwani: 'Sherwani', trousseau: 'Trousseau',
};

interface CategoryMeta {
  name: string;
  description: string;
  image: string;
  updatedAt?: Date;
}

async function getCategoryMeta(slug: string): Promise<CategoryMeta | null> {
  try {
    await connectDB();
    const cat = await CategoryModel.findOne({ id: slug })
      .select('name description image updatedAt')
      .lean<CategoryMeta>();
    return cat ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cat = await getCategoryMeta(slug);
  const name = cat?.name ?? SLUG_TO_NAME[slug] ?? slug;
  const url = `${BASE_URL}/categories/${slug}`;

  const title = `${name} — Book Top Wedding ${name} in India`;
  const description =
    cat?.description ||
    `Compare and book the best wedding ${name.toLowerCase()} in India. Browse packages, read reviews, and get free quotes from verified vendors.`;

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
      images: cat?.image ? [{ url: cat.image, width: 1200, height: 630, alt: name }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: cat?.image ? [cat.image] : [],
    },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = await getCategoryMeta(slug);
  const name = cat?.name ?? SLUG_TO_NAME[slug] ?? slug;
  const url = `${BASE_URL}/categories/${slug}`;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: name, item: url },
    ],
  };

  const collectionPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${name} — ShaadiShopping`,
    description: cat?.description ?? `Top wedding ${name.toLowerCase()} in India`,
    url,
    ...(cat?.image && { image: cat.image }),
  };

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={collectionPageJsonLd} />
      <Suspense>
        <CategoryPageClient
          slug={slug}
          initialCoverImage={cat?.image}
          initialName={cat?.name}
          initialDescription={cat?.description}
        />
      </Suspense>
    </>
  );
}
