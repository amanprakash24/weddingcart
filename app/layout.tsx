import type { Metadata } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';
import CartFAB from '@/components/CartFAB';
import ContactBanner from '@/components/ContactBanner';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: "WeddingCart — India's Premier Wedding Planning Marketplace",
    template: '%s | WeddingCart',
  },
  description:
    "Discover, compare, and book top wedding vendors — venues, photographers, caterers, makeup artists, decorators, DJs, and more across India. Start planning your dream wedding today.",
  keywords: [
    'wedding vendors India', 'wedding venue booking', 'bridal makeup artist',
    'wedding photographer', 'wedding catering', 'wedding decorator',
    'mehndi artist', 'wedding DJ', 'wedding band', 'wedding planning',
  ],
  openGraph: {
    title: "WeddingCart — India's Premier Wedding Planning Marketplace",
    description: "Book top wedding vendors across India. Venues, photographers, caterers, makeup artists and more.",
    type: 'website',
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WeddingCart',
    description: "Plan your dream wedding with India's best vendors.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body className="bg-[#FFFAF5] text-[#2D2D2D] min-h-screen antialiased" suppressHydrationWarning>
        <CartProvider>
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <Footer />
          <CartDrawer />
          <CartFAB />
          <ContactBanner />
        </CartProvider>
      </body>
    </html>
  );
}
