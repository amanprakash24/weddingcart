import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./lib/securityHeaders";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Security-hardening audit finding (P2) — no security headers were
  // configured anywhere (this file had no headers() block, proxy.ts only
  // does auth redirects). Applied to every route via the catch-all source,
  // same as this app has no per-route header needs today.
  async headers() {
    return [{ source: '/:path*', headers: buildSecurityHeaders(process.env.NODE_ENV) }];
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'shaadishopping.com' }],
        destination: 'https://www.shaadishopping.com/:path*',
        permanent: true,
      },
      {
        source: '/venues/patna',
        destination: '/cities/patna/venue',
        permanent: true,
      },
      {
        source: '/venues-in-patna',
        destination: '/cities/patna/venue',
        permanent: true,
      },
      {
        source: '/lp/swayamvar-hall',
        destination: '/vendors/swayamvar-hall-patna',
        permanent: true,
      },
      {
        // Pre-existing DB-backed vendor record (id: "swayamvar-hall") was rendering
        // a separate, lower-quality generic page via app/vendors/[id] — redirect it
        // into the canonical page so there's exactly one URL for this venue.
        source: '/vendors/swayamvar-hall',
        destination: '/vendors/swayamvar-hall-patna',
        permanent: true,
      },
      {
        source: '/lp/touch-of-cozy',
        destination: '/vendors/touch-of-cozy-patna',
        permanent: true,
      },
      {
        source: '/lp/7-vachan-patna',
        destination: '/vendors/7-vachan-patna',
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'drive.google.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'content.jdmagicbox.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
