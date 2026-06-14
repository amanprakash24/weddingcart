import { Suspense } from 'react';
import VendorOnboardingClient from '@/components/VendorOnboardingClient';

export const metadata = {
  title: 'Join as a Wedding Vendor — List Your Business on ShaadiShopping',
  description:
    'List your wedding business on ShaadiShopping and reach thousands of couples planning their dream wedding across India. Free registration for venues, makeup artists, photographers, caterers & more.',
  robots: { index: true, follow: true },
  alternates: { canonical: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://shaadishopping.com'}/vendor-onboarding` },
};

export default function VendorOnboardingPage() {
  return (
    <Suspense>
      <VendorOnboardingClient />
    </Suspense>
  );
}
