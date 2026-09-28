import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./lib/securityHeaders";

// Metro cities whose listings were only ever demo vendors (unpublished 2026-09-28). Their pages were
// already noindex and outside the sitemap; these TEMPORARY (307) redirects stop visitors landing on empty
// pages. When real vendors exist in a city, remove it from this list and its pages come back as they were.
export const NON_BIHAR_CITY_SLUGS = ['delhi', 'mumbai', 'jaipur', 'bangalore', 'chennai', 'hyderabad', 'kolkata', 'udaipur', 'goa'];
const nonBiharCity = `:city(${NON_BIHAR_CITY_SLUGS.join('|')})`;

const nextConfig: NextConfig = {
  // AWS migration (docs/deployment/aws-migration-plan.md, Phase 1) — the Docker image
  // runs .next/standalone/server.js instead of `next start`, so it needs no node_modules.
  output: 'standalone',
  poweredByHeader: false,
  // Security-hardening audit finding (P2) — no security headers were
  // configured anywhere (this file had no headers() block, proxy.ts only
  // does auth redirects). Applied to every route via the catch-all source,
  // same as this app has no per-route header needs today.
  async headers() {
    return [
      { source: '/:path*', headers: buildSecurityHeaders(process.env.NODE_ENV) },
      // The couple's proposal page (docs/wedding-os/08-quotation.md §15): its URL is a secret link. Listed AFTER the
      // catch-all so these values win (the last matching header key overrides). Never indexed, and the URL is never
      // sent on as a Referer. (No-store caching comes from the page being force-dynamic — Next overrides Cache-Control
      // set here for pages.)
      {
        source: '/proposal/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
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
      { source: `/cities/${nonBiharCity}`, destination: '/cities/patna', permanent: false },
      { source: `/cities/${nonBiharCity}/:category`, destination: '/cities/patna/:category', permanent: false },
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
