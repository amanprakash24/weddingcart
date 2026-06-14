import { MetadataRoute } from 'next';
import { connectDB } from '@/lib/mongodb';
import VendorModel from '@/lib/models/Vendor';
import CategoryModel from '@/lib/models/Category';
import BlogModel from '@/lib/models/Blog';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://shaadishopping.com';

const CATEGORY_SLUGS = ['venue', 'makeup', 'mehndi', 'decorator', 'band', 'dj', 'catering', 'photo-video', 'planning'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Only Patna city+category combos — primary market, fully built out first
  const cityCategoryRoutes: MetadataRoute.Sitemap = CATEGORY_SLUGS.map((category) => ({
    url: `${BASE_URL}/cities/patna/${category}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.95,
  }));

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL,                        lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE_URL}/blog`,              lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE_URL}/about`,             lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/plan`,              lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/vendor-onboarding`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    // Only Patna city landing page — other cities added as we expand
    { url: `${BASE_URL}/cities/patna`,      lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.95 },
    // High-value blog posts pinned at top priority
    { url: `${BASE_URL}/blog/court-marriage-registration-patna-bihar`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.92 },
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

    const pinnedBlogSlugs = new Set(['court-marriage-registration-patna-bihar']);
    blogRoutes = blogs.map(blog => ({
      url: `${BASE_URL}/blog/${blog.slug}`,
      lastModified: blog.updatedAt ?? blog.publishedAt ?? new Date(),
      changeFrequency: 'monthly' as const,
      priority: pinnedBlogSlugs.has(blog.slug) ? 0.92 : 0.8,
    }));
  } catch (err) {
    console.error('Sitemap generation error:', err);
  }

  return [...cityCategoryRoutes, ...staticRoutes, ...categoryRoutes, ...vendorRoutes, ...blogRoutes];
}
