import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Playfair_Display, Cormorant_Garamond, DM_Sans } from 'next/font/google';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';
import CartFAB from '@/components/CartFAB';
import ContactBanner from '@/components/ContactBanner';
import ScrollToTop from '@/components/ScrollToTop';
import LeadCapturePopup from '@/components/LeadCapturePopup';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-cormorant',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com'),
  title: {
    default: "ShaadiShopping — India's Expert Wedding Planning & Coordination Platform",
    template: '%s | ShaadiShopping',
  },
  description:
    "India's managed wedding planning & coordination platform. Expert consultants, trusted vendors, personalized planning wizard, and stress-free execution — from Venue to Vidaai.",
  keywords: [
    'wedding vendors India', 'wedding venue booking', 'bridal makeup artist',
    'wedding photographer', 'wedding catering', 'wedding decorator',
    'mehndi artist', 'wedding DJ', 'wedding band', 'wedding planning',
    'shaadi planning India', 'wedding marketplace India',
  ],
  openGraph: {
    title: "ShaadiShopping — India's Expert Wedding Coordination Platform",
    description: "Expert-guided wedding planning from Venue to Vidaai. Trusted vendors, personal consultants, stress-free coordination across India.",
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShaadiShopping',
    url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ShaadiShopping — India\'s Expert Wedding Coordination Platform',
    description: "Expert-guided wedding planning from Venue to Vidaai. Trusted vendors, personal consultants, stress-free coordination across India.",
    site: '@ShaadiShopping',
  },
  robots: { index: true, follow: true },
  alternates: { canonical: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${cormorant.variable} ${dmSans.variable}`}>
      <body className="bg-[#FFFAF5] text-[#2D2D2D] min-h-screen antialiased" suppressHydrationWarning>
        <CartProvider>

          <Suspense><ScrollToTop /></Suspense>
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <Footer />
          <CartDrawer />
          <CartFAB />
          <ContactBanner />
          <Suspense><LeadCapturePopup /></Suspense>
        </CartProvider>
      </body>
    </html>
  );
}
