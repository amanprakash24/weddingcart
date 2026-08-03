import { MetadataRoute } from 'next';
import { connectDB } from '@/lib/mongodb';
import VendorModel from '@/lib/models/Vendor';
import CategoryModel from '@/lib/models/Category';
import BlogModel from '@/lib/models/Blog';
import { BIHAR_CITY_SLUGS } from '@/data/biharCities';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

const CATEGORY_SLUGS = ['venue', 'makeup', 'mehndi', 'decorator', 'band', 'dj', 'catering', 'photo-video', 'planning'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Patna city+category combos — primary market, highest priority
  const cityCategoryRoutes: MetadataRoute.Sitemap = CATEGORY_SLUGS.map((category) => ({
    url: `${BASE_URL}/cities/patna/${category}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.95,
  }));

  // Bihar expansion cities — indexed, served from the Patna vendor network
  const biharCityRoutes: MetadataRoute.Sitemap = BIHAR_CITY_SLUGS.map((city) => ({
    url: `${BASE_URL}/cities/${city}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  const biharCityCategoryRoutes: MetadataRoute.Sitemap = BIHAR_CITY_SLUGS.flatMap((city) =>
    CATEGORY_SLUGS.map((category) => ({
      url: `${BASE_URL}/cities/${city}/${category}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
  );

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL,                        lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE_URL}/blog`,              lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE_URL}/about`,             lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/plan`,              lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/vendor-onboarding`,      lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    // Patna city landing page (other Bihar cities added via biharCityRoutes above)
    { url: `${BASE_URL}/cities/patna`,            lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.95 },
    // Venue landing pages — indexed per robots.ts and each page's own metadata
    { url: `${BASE_URL}/venues/patna`,               lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.97 },
    { url: `${BASE_URL}/venues/patna/danapur`,       lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/venues/patna/saguna-mor`,    lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/venues/patna/boring-road`,   lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/venues/patna/bailey-road`,   lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/venues/patna/kankarbagh`,    lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/lp/touch-of-cozy`,        lastModified: new Date(), changeFrequency: 'monthly', priority: 0.85 },
    { url: `${BASE_URL}/vendors/swayamvar-hall-patna`,       lastModified: new Date(), changeFrequency: 'monthly', priority: 0.85 },
    { url: `${BASE_URL}/lp/7-vachan-patna`,       lastModified: new Date(), changeFrequency: 'monthly', priority: 0.85 },
    // High-value blog posts pinned at top priority
    { url: `${BASE_URL}/blog/court-marriage-registration-patna-bihar`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.92 },
    { url: `${BASE_URL}/blog/best-banquet-hall-in-patna`,              lastModified: new Date(), changeFrequency: 'monthly', priority: 0.92 },
    { url: `${BASE_URL}/blog/ashiyana-resort-banquet-hall-digha-patna`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.92 },
  ];

  let categoryRoutes: MetadataRoute.Sitemap = [];
  let vendorRoutes: MetadataRoute.Sitemap = [];
  let portfolioRoutes: MetadataRoute.Sitemap = [];
  let blogRoutes: MetadataRoute.Sitemap = [];

  // Slugs already pinned in staticRoutes — skip in dynamic to avoid duplicates
  const PINNED_BLOG_SLUGS = new Set([
    'court-marriage-registration-patna-bihar',
    'best-banquet-hall-in-patna',
    'ashiyana-resort-banquet-hall-digha-patna',
  ]);

  try {
    await connectDB();

    const categories = await CategoryModel.find({})
      .select('id updatedAt')
      .lean<{ id: string; updatedAt?: Date }[]>();

    // /categories/[slug] permanently redirects to /cities/patna/[slug] for the
    // main categories — those city URLs are already in the sitemap, so only
    // list category pages that actually render content.
    const REDIRECTING_SLUGS = new Set(CATEGORY_SLUGS);

    categoryRoutes = categories
      .filter(cat => !REDIRECTING_SLUGS.has(cat.id))
      .map(cat => ({
        url: `${BASE_URL}/categories/${cat.id}`,
        lastModified: cat.updatedAt ?? new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      }));

    const vendors = await VendorModel.find({})
      .select('id updatedAt')
      .lean<{ id: string; updatedAt?: Date }[]>();

    vendorRoutes = vendors.map(vendor => ({
      url: `${BASE_URL}/vendors/${vendor.id}`,
      lastModified: vendor.updatedAt ?? new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    }));

    portfolioRoutes = vendors.map(vendor => ({
      url: `${BASE_URL}/portfolio/${vendor.id}`,
      lastModified: vendor.updatedAt ?? new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    }));

    const blogs = await BlogModel.find({ status: 'published' })
      .select('slug updatedAt publishedAt')
      .lean<{ slug: string; updatedAt?: Date; publishedAt?: Date }[]>();

    blogRoutes = blogs
      .filter(blog => !PINNED_BLOG_SLUGS.has(blog.slug))
      .map(blog => ({
        url: `${BASE_URL}/blog/${blog.slug}`,
        lastModified: blog.updatedAt ?? blog.publishedAt ?? new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      }));
  } catch (err) {
    console.error('Sitemap generation error:', err);
  }

  return [...cityCategoryRoutes, ...biharCityRoutes, ...biharCityCategoryRoutes, ...staticRoutes, ...categoryRoutes, ...vendorRoutes, ...portfolioRoutes, ...blogRoutes];
}
