import { Suspense } from 'react';
import type { Metadata } from 'next';
import HomepageClient from '@/components/HomepageClient';
import { JsonLd } from '@/components/JsonLd';
import { blogRepository } from '@/repositories/blog.repository';
import type { BlogHighlight } from '@/components/homepage/BlogHighlightsSection';
import type { HomeCategory } from '@/components/homepage/CategoriesSection';
import { categoryRepository } from '@/repositories/category.repository';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

// Highest-value guides, in display priority order
const TOP_BLOG_SLUGS = [
  'best-wedding-venues-patna-bihar-2025',
  'wedding-cost-patna-bihar-budget-guide',
  'court-marriage-registration-patna-bihar',
  'best-banquet-halls-patna-wedding-marriage-hall',
];

async function getTopBlogPosts(): Promise<BlogHighlight[]> {
  try {
    const { data } = await blogRepository.findMany({
      where: { slug: { in: TOP_BLOG_SLUGS }, status: 'PUBLISHED' },
    });
    const bySlug = new Map(data.map((p) => [p.slug, p]));
    return TOP_BLOG_SLUGS.map((slug) => bySlug.get(slug))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        coverImage: p.coverImage,
        category: p.category,
        readTime: p.readTime,
      }));
  } catch {
    return [];
  }
}

// Pictures for the category cards, from the photographs already in /public — used in place of the stock picture stored on the
// category where we have a better, Indian-wedding one. They illustrate the CATEGORY; none is presented as a particular venue or
// vendor. Add a line here when a better photograph for a category is added to /public.
const CATEGORY_PICTURES: Record<string, string> = {
  venue: '/cat-venue-guides.jpg',
  decorator: '/guide-decor.jpg',
  makeup: '/guide-bridal.jpg',
  'photo-video': '/cat-photography.jpg',
};

// Does this picture address still answer with an image? (Two stored category pictures were dead links on 14 Oct 2026.)
async function pictureLoads(url: string): Promise<boolean> {
  if (url.startsWith('/')) return true; // our own file
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(4000), next: { revalidate: 3600 } });
    return res.ok && (res.headers.get('content-type') ?? '').startsWith('image/');
  } catch {
    return false;
  }
}

// "Explore Wedding Categories": the everyday categories that have published vendors today, busiest first — straight from the
// database. A category is shown only if it has a picture that really loads; one without is left out until it is given a picture
// (admin → Categories), rather than shown as a broken card. If the read fails the whole section is simply left out.
async function getHomeCategories(): Promise<{ cards: HomeCategory[]; count: number }> {
  try {
    const { data } = await categoryRepository.findMany({
      where: { isSpecial: false, vendors: { some: { status: 'PUBLISHED' } } },
      orderBy: { vendors: { _count: 'desc' } },
      take: 8,
    });
    // The count on the facts row: every category (special ones too) that has a published vendor.
    const { total } = await categoryRepository.findMany({ where: { vendors: { some: { status: 'PUBLISHED' } } }, take: 1 });
    const withPictures = data.map((c) => ({ slug: c.slug, name: c.name, image: CATEGORY_PICTURES[c.slug] ?? c.image }));
    const usable = await Promise.all(withPictures.map((c) => (c.image ? pictureLoads(c.image) : false)));
    return { cards: withPictures.filter((_, i) => usable[i]), count: total };
  } catch {
    return { cards: [], count: 0 };
  }
}

// Re-read the categories (and re-check their pictures) at most once an hour.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Shaadi Shopping | Trusted Wedding Planning & Wedding Vendors in Patna",
  description:
    'Plan your wedding with confidence. Compare banquet halls, photographers, caterers, decorators and more in Patna. Get a dedicated Wedding Expert from planning to vidai—free of cost.',
  alternates: { canonical: BASE_URL },
  openGraph: {
    title: "ShaadiShopping — Wedding Planning in Patna",
    description: 'Your trusted wedding planner in Patna. Find wedding vendors and wedding services, with a dedicated expert guiding you from planning to vidai.',
    url: BASE_URL,
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShaadiShopping',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'ShaadiShopping — Wedding Planning in Patna' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "ShaadiShopping — Wedding Planning in Patna",
    description: 'Your trusted wedding planner in Patna. Find wedding vendors and wedding services, with a dedicated expert guiding you from planning to vidai.',
    images: ['/opengraph-image'],
  },
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'ShaadiShopping',
  alternateName: ['Shaadi Shopping', 'ShaadiShopping.com', 'शादी शॉपिंग'],
  url: BASE_URL,
  description: 'Shaadi Shopping helps families plan weddings in Patna with wedding venues, trusted vendors, written quotations, and one dedicated Wedding Expert from planning to vidai.',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${BASE_URL}/cities/patna/venue?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ShaadiShopping',
  alternateName: ['Shaadi Shopping', 'शादी शॉपिंग'],
  url: BASE_URL,
  logo: `${BASE_URL}/logo.png`,
  sameAs: [
    'https://www.shaadishopping.com',
    'https://www.instagram.com/shaadishopping',
    'https://www.facebook.com/shaadishopping',
    'https://wa.me/917646028228',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+91-76460-28228',
    contactType: 'customer service',
    areaServed: 'IN',
    availableLanguage: ['Hindi', 'English'],
  },
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Gola Road, Adarsh Vihar Colony, Lane 5, near T Point, beside Hotel King Regency',
    addressLocality: 'Patna',
    addressRegion: 'Bihar',
    postalCode: '801503',
    addressCountry: 'IN',
  },
  email: 'shaadi.shopping51@gmail.com',
  foundingLocation: {
    '@type': 'Place',
    name: 'Patna, Bihar, India',
  },
  areaServed: [
    { '@type': 'City', name: 'Patna' },
    { '@type': 'City', name: 'Muzaffarpur' },
    { '@type': 'City', name: 'Gaya' },
    { '@type': 'City', name: 'Bhagalpur' },
    { '@type': 'City', name: 'Darbhanga' },
    { '@type': 'City', name: 'Purnia' },
    { '@type': 'City', name: 'Arrah' },
    { '@type': 'City', name: 'Begusarai' },
    { '@type': 'City', name: 'Chhapra' },
    { '@type': 'City', name: 'Hajipur' },
    { '@type': 'City', name: 'Bihar Sharif' },
    { '@type': 'City', name: 'Motihari' },
    { '@type': 'City', name: 'Samastipur' },
    { '@type': 'State', name: 'Bihar' },
    { '@type': 'Country', name: 'India' },
  ],
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What wedding services does ShaadiShopping provide in Patna?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'ShaadiShopping provides complete wedding planning services in Patna including wedding venues, banquet halls, bridal makeup artists, wedding photographers, mehndi artists, wedding decorators, caterers, DJ services, wedding bands, and wedding planners. The first expert consultation is free.',
      },
    },
    {
      '@type': 'Question',
      name: 'How much does a wedding cost in Patna?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A wedding in Patna typically costs between ₹5 lakh to ₹50 lakh depending on guest count, venue, and services. Budget weddings for 200–300 guests start around ₹5–10 lakh. ShaadiShopping helps you plan within your budget with vendors to fit it.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which are the best banquet halls in Patna for weddings?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Top banquet halls in Patna for weddings include Swayamvar Hall & Homestay (Danapur, up to 700 guests), Touch of Cozy (Rajeev Nagar), and 7 Vachan (Saguna Mor). ShaadiShopping verifies every venue it lists, with pricing from ₹999/plate.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is ShaadiShopping free to use?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, ShaadiShopping is completely free for couples. You can browse vendors, get quotes, and consult with our wedding experts at no charge. We offer a free wedding planning consultation to help you shortlist the best vendors within your budget.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I book a wedding venue through ShaadiShopping?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Simply visit shaadishopping.com, click "Begin Your Journey" or call +91-76460-28228. Our wedding expert will understand your requirements, shortlist venues matching your guest count and budget, arrange site visits, and help you finalise the booking — all for free.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does ShaadiShopping plan weddings outside Patna?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "ShaadiShopping is Patna's trusted wedding planning platform, currently expanding across Bihar. Couples in cities like Muzaffarpur, Gaya, Bhagalpur, and Darbhanga are served from our Patna vendor network, with the same dedicated Wedding Expert guiding every booking.",
      },
    },
    {
      '@type': 'Question',
      name: 'What is the difference between ShaadiShopping and other wedding platforms?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Unlike listing-only platforms, ShaadiShopping assigns you a dedicated wedding expert who personally guides your entire wedding — from vendor selection to final execution. We don\'t just list vendors; we coordinate, negotiate, and manage every detail so you can enjoy your wedding stress-free.',
      },
    },
  ],
};

export default async function HomePage() {
  const [topBlogPosts, categories] = await Promise.all([getTopBlogPosts(), getHomeCategories()]);

  return (
    <>
      <JsonLd data={websiteSchema} />
      <JsonLd data={organizationSchema} />
      <JsonLd data={faqSchema} />
      <Suspense>
        <HomepageClient topBlogPosts={topBlogPosts} categories={categories.cards} categoryCount={categories.count} />
      </Suspense>
    </>
  );
}
