import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { blogRepository } from '@/repositories/blog.repository';
import { categoryRepository } from '@/repositories/category.repository';
import { vendorService } from '@/services/vendor.service';
import { toLegacyVendors } from '@/lib/serializers/vendor';
import { buildCategoryTiles, type CategoryTile } from '@/lib/home/categoryTiles';
import { HOME_FAQ } from '@/lib/home/faq';
import type { Vendor } from '@/types';
import BlogHighlightsSection, { type BlogHighlight } from '@/components/homepage/BlogHighlightsSection';
import BudgetBands from '@/components/home/BudgetBands';
import HomeHero from '@/components/home/HomeHero';
import CategoryTiles from '@/components/home/CategoryTiles';
import VenuesByArea from '@/components/home/VenuesByArea';
import HowItWorks from '@/components/home/HowItWorks';
import FounderSection from '@/components/home/FounderSection';
import ForBusinesses from '@/components/home/ForBusinesses';
import HomeFaq from '@/components/home/HomeFaq';
import FinalCta from '@/components/home/FinalCta';
import HomeStickyBar from '@/components/home/HomeStickyBar';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

// Rebuilt at most once an hour. Before, the page was built once per deploy: if the database could not be reached
// at build time, the guides section stayed empty until the next deploy.
export const revalidate = 3600;

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

// Published Patna vendors, once, for the service tiles, the search box and the venue cards.
// Same query and order as the city pages (vendorService.search). On failure the sections hide, the page still renders.
async function getDiscovery(): Promise<{ tiles: CategoryTile[]; venues: Vendor[] }> {
  try {
    const [{ data }, categories] = await Promise.all([
      vendorService.search({ city: 'Patna', status: 'PUBLISHED' }),
      categoryRepository.findOptions(),
    ]);
    const vendors = await toLegacyVendors(data);
    return {
      tiles: buildCategoryTiles(vendors.map((v) => v.category), categories),
      venues: vendors.filter((v) => v.category === 'venue').slice(0, 6),
    };
  } catch {
    return { tiles: [], venues: [] };
  }
}

export const metadata: Metadata = {
  title: 'Shaadi Shopping | Trusted Wedding Planning & Venues in Patna',
  description:
    'Plan your wedding in Patna with one dedicated Wedding Expert, free for couples. Compare banquet halls, lawns, caterers, decorators, photographers and more, with visits and quotations arranged for you.',
  alternates: { canonical: BASE_URL },
  openGraph: {
    title: 'ShaadiShopping — Wedding Planning in Patna',
    description: 'Your wedding planner in Patna: venues and wedding services, with one dedicated expert guiding you from planning to vidai.',
    url: BASE_URL,
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShaadiShopping',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'ShaadiShopping — Wedding Planning in Patna' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ShaadiShopping — Wedding Planning in Patna',
    description: 'Your wedding planner in Patna: venues and wedding services, with one dedicated expert guiding you from planning to vidai.',
    images: ['/opengraph-image'],
  },
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'ShaadiShopping',
  alternateName: ['Shaadi Shopping', 'ShaadiShopping.com', 'शादी शॉपिंग'],
  url: BASE_URL,
  description: 'Shaadi Shopping helps families plan weddings in Patna with venues, wedding services, transparent quotations, and one dedicated Wedding Expert from planning to vidai.',
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
  founder: { '@type': 'Person', name: 'Anisha Kumari' },
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
  // City only: the office address is not published (founder's decision, 17 Oct 2026).
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Patna',
    addressRegion: 'Bihar',
    addressCountry: 'IN',
  },
  email: 'care@shaadishopping.com',
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

// Same questions and answers as the visible FAQ (components/home/HomeFaq.tsx).
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: HOME_FAQ.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

export default async function HomePage() {
  const [topBlogPosts, { tiles, venues }] = await Promise.all([getTopBlogPosts(), getDiscovery()]);
  const services = tiles.map((t) => ({ slug: t.slug, name: t.name, href: t.href }));

  return (
    <>
      <JsonLd data={websiteSchema} />
      <JsonLd data={organizationSchema} />
      <JsonLd data={faqSchema} />
      <HomeHero services={services} />
      <CategoryTiles tiles={tiles} />
      <VenuesByArea venues={venues} />
      <HowItWorks />
      <BudgetBands />
      <FounderSection />
      <BlogHighlightsSection posts={topBlogPosts} />
      <ForBusinesses />
      <HomeFaq />
      <FinalCta />
      <HomeStickyBar />
    </>
  );
}
