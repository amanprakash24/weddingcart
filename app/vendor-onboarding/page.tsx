import { Suspense } from 'react';
import VendorOnboardingClient from '@/components/VendorOnboardingClient';

export const metadata = {
  title: 'Join as a Vendor | ShaadiShopping',
  description: 'List your wedding business on ShaadiShopping and reach thousands of couples.',
};

export default function VendorOnboardingPage() {
  return (
    <Suspense>
      <VendorOnboardingClient />
    </Suspense>
  );
}
