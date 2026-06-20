import type { Metadata } from 'next';
import { Suspense } from 'react';
import Script from 'next/script';
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
    "Patna's top-ranked wedding planning platform — #1 for best banquet halls in Patna. Book verified venues, catering, décor & more. Expert wedding coordination from Venue to Vidaai.",
  keywords: [
    'shaadi', 'shadi', 'shaadi planning', 'shaadi vendors', 'online shaadi booking',
    'vivah', 'byah', 'vivah planning India',
    'wedding vendors India', 'wedding venue booking', 'bridal makeup artist',
    'wedding photographer', 'wedding catering', 'wedding decorator',
    'mehndi artist', 'wedding DJ', 'wedding band', 'wedding planning',
    'shaadi planning India', 'wedding platform India',
    'wedding vendors Patna', 'wedding Bihar', 'shaadi Bihar',
    'banquet hall patna', 'best banquet hall patna', 'banquet hall in patna',
    'marriage hall patna', 'wedding hall patna',
  ],
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.ico',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: "ShaadiShopping — India's Expert Wedding Coordination Platform",
    description: "Patna's top-ranked wedding planning platform — #1 for best banquet halls in Patna. Book verified venues, catering, décor & more. Expert coordination from Venue to Vidaai.",
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShaadiShopping',
    url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: "ShaadiShopping — India's Expert Wedding Coordination Platform" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ShaadiShopping — India\'s Expert Wedding Coordination Platform',
    description: "Patna's top-ranked wedding planning platform — #1 for best banquet halls in Patna. Book verified venues, catering, décor & more. Expert coordination from Venue to Vidaai.",
    site: '@ShaadiShopping',
    images: ['/opengraph-image'],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${playfair.variable} ${cormorant.variable} ${dmSans.variable}`}>
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-2RRLZMSQ3R"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-2RRLZMSQ3R');
          `}
        </Script>
      </head>
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
