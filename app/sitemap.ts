import { MetadataRoute } from 'next';
import { connectDB } from '@/lib/mongodb';
import VendorModel from '@/lib/models/Vendor';
import CategoryModel from '@/lib/models/Category';
import BlogModel from '@/lib/models/Blog';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

const CITY_SLUGS = ['patna', 'delhi', 'mumbai', 'jaipur', 'bangalore', 'chennai', 'hyderabad', 'kolkata', 'udaipur', 'goa'];
const CATEGORY_SLUGS = ['venue', 'makeup', 'mehndi', 'decorator', 'band', 'dj', 'catering', 'photo-video', 'planning'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // City+category combo pages — highest SEO priority after homepage
  const cityCategoryRoutes: MetadataRoute.Sitemap = CITY_SLUGS.flatMap((city) =>
    CATEGORY_SLUGS.map((category) => ({
      url: `${BASE_URL}/cities/${city}/${category}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: city === 'patna' ? 0.95 : 0.85,
    }))
  );

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL,                          lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE_URL}/blog`,                lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE_URL}/about`,               lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/plan`,                lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/vendor-onboarding`,   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    // City landing pages — Patna is the primary market
    { url: `${BASE_URL}/cities/patna`,        lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/cities/delhi`,        lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/cities/mumbai`,       lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/cities/jaipur`,       lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/cities/bangalore`,    lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/cities/chennai`,      lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/cities/hyderabad`,    lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/cities/kolkata`,      lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/cities/udaipur`,      lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/cities/goa`,          lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
  ];

  let categoryRoutes: MetadataRoute.Sitemap = [];
  let vendorRoutes: MetadataRoute.Sitemap = [];
  let blogRoutes: MetadataRoute.Sitemap = [];

  try {
    await connectDB();

    const categories = await CategoryModel.find({})
      .select('id updatedAt')
      .lean<{ id: string; updatedAt?: Date }[]>();

    categoryRoutes = categories.map(cat => ({
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

    const blogs = await BlogModel.find({ status: 'published' })
      .select('slug updatedAt publishedAt')
      .lean<{ slug: string; updatedAt?: Date; publishedAt?: Date }[]>();

    blogRoutes = blogs.map(blog => ({
      url: `${BASE_URL}/blog/${blog.slug}`,
      lastModified: blog.updatedAt ?? blog.publishedAt ?? new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    }));
  } catch (err) {
    console.error('Sitemap generation error:', err);
  }

  return [...cityCategoryRoutes, ...staticRoutes, ...categoryRoutes, ...vendorRoutes, ...blogRoutes];
}
