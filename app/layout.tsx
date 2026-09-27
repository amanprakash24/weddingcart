import type { Metadata } from 'next';
import { Suspense } from 'react';
import Script from 'next/script';
import { Playfair_Display, Cormorant_Garamond, DM_Sans } from 'next/font/google';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import AuthSessionProvider from '@/components/AuthSessionProvider';
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

const DEFAULT_SITE_URL = 'https://www.shaadishopping.com';

function resolveSiteUrl(): URL {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}

export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(),
  title: {
    default: "ShaadiShopping — Patna's Trusted Wedding Planning Platform",
    template: '%s | ShaadiShopping',
  },
  description:
    "Patna's trusted wedding planning platform with one dedicated Wedding Expert from booking to vidaai. Book verified venues, catering, décor & more.",
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
    title: "ShaadiShopping — Patna's Trusted Wedding Planning Platform",
    description: "Patna's trusted wedding planning platform with one dedicated Wedding Expert from booking to vidaai. Book verified venues, catering, décor & more.",
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShaadiShopping',
    url: resolveSiteUrl().toString(),
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: "ShaadiShopping — Patna's Trusted Wedding Planning Platform" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "ShaadiShopping — Patna's Trusted Wedding Planning Platform",
    description: "Patna's trusted wedding planning platform with one dedicated Wedding Expert from booking to vidaai. Book verified venues, catering, décor & more.",
    site: '@ShaadiShopping',
    images: ['/opengraph-image'],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: resolveSiteUrl().toString() },
};

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-XNP0999R4W';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${playfair.variable} ${cormorant.variable} ${dmSans.variable}`}>
      <head>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}
        </Script>
      </head>
      <body className="bg-[#FFFAF5] text-[#2D2D2D] min-h-screen antialiased" suppressHydrationWarning>
        <AuthSessionProvider>
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
        </AuthSessionProvider>
      </body>
    </html>
  );
}
