import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page Not Found — ShaadiShopping',
  description: 'The page you are looking for could not be found.',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFFAF5] px-4">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-amber-500 font-[Playfair_Display,serif] mb-4">404</p>
        <h1 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-3">
          Page Not Found
        </h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist. Let&apos;s get you back to planning your dream wedding.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold px-6 py-3 rounded-full hover:opacity-90 transition-all text-sm"
          >
            Go to Homepage
          </Link>
          <Link
            href="/plan"
            className="border border-amber-300 text-amber-700 font-semibold px-6 py-3 rounded-full hover:bg-amber-50 transition-all text-sm"
          >
            Begin Your Journey
          </Link>
        </div>
      </div>
    </div>
  );
}
