import { MetadataRoute } from 'next';
import { connectDB } from '@/lib/mongodb';
import VendorModel from '@/lib/models/Vendor';
import CategoryModel from '@/lib/models/Category';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL,                          lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE_URL}/about`,               lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/plan`,                lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/vendor-onboarding`,   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];

  let categoryRoutes: MetadataRoute.Sitemap = [];
  let vendorRoutes: MetadataRoute.Sitemap = [];

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
  } catch (err) {
    console.error('Sitemap generation error:', err);
  }

  return [...staticRoutes, ...categoryRoutes, ...vendorRoutes];
}
