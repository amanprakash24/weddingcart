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
      // Client invitations carry a family's names and phone number: shared by link, never listed by search engines.
      {
        source: '/invitations/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
  // Digital invitations made by Shaadi Shopping for clients are static pages in public/invitations/<slug>/
  // (index.html + assets/). This lets the short address /invitations/<slug> open that page.
  async rewrites() {
    return [
      { source: '/invitations/:slug', destination: '/invitations/:slug/index.html' },
    ];
  },
  async redirects() {
    return [
      // /admin on its own, and the retired admin screens, are answered here — before any page renders. Redirecting from inside the
      // admin page (it streams inside the admin layout's Suspense) reached visitors' browsers as React error #419 (18 Nov 2026).
      // app/admin/page.tsx keeps the same redirects as a fallback.
      { source: '/admin', missing: [{ type: 'query', key: 'tab' }], destination: '/admin/dashboard', permanent: false },
      ...['enquiries', 'consultations', 'leads'].map((tab) => ({ source: '/admin', has: [{ type: 'query' as const, key: 'tab', value: tab }], destination: '/admin/crm', permanent: false })),
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
      // Venues have one master page at /venues/<slug> (founder-approved design, 19 Nov 2026). The three hand-built
      // venue pages are retired; their old addresses forward to the venue's master page in one hop.
      // (Other /vendors/<venue-slug> links forward from app/vendors/[id]/page.tsx.)
      { source: '/lp/swayamvar-hall', destination: '/venues/swayamvar-hall', permanent: true },
      { source: '/vendors/swayamvar-hall-patna', destination: '/venues/swayamvar-hall', permanent: true },
      { source: '/vendors/swayamvar-hall', destination: '/venues/swayamvar-hall', permanent: true },
      { source: '/lp/touch-of-cozy', destination: '/venues/touch-of-cozy-patna', permanent: true },
      { source: '/vendors/touch-of-cozy-patna', destination: '/venues/touch-of-cozy-patna', permanent: true },
      { source: '/lp/7-vachan-patna', destination: '/venues/7-vachan-patna', permanent: true },
      { source: '/vendors/7-vachan-patna', destination: '/venues/7-vachan-patna', permanent: true },
      // No page of its own at /venues or /venue: the list of venues.
      { source: '/venues', destination: '/cities/patna/venue', permanent: false },
      { source: '/venue', destination: '/cities/patna/venue', permanent: false },
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
