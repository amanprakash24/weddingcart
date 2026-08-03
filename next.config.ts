import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'shaadishopping.com' }],
        destination: 'https://www.shaadishopping.com/:path*',
        permanent: true,
      },
      {
        source: '/venues-in-patna',
        destination: '/venues/patna',
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
