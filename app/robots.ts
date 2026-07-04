import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/admin/*',
        '/api',
        '/api/*',
        '/cart',
        '/vendor-onboarding',
        // Legacy landing pages superseded by canonical /vendors/[id] and /cities/... routes (see next.config.ts redirects)
        '/lp/*',
        '/venues-in-patna',
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
