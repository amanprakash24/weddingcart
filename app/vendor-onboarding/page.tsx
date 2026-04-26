import { Suspense } from 'react';
import VendorOnboardingClient from '@/components/VendorOnboardingClient';

export const metadata = {
  title: 'Join as a Vendor | WeddingCart',
  description: 'List your wedding business on WeddingCart and reach thousands of couples.',
};

export default function VendorOnboardingPage() {
  return (
    <Suspense>
      <VendorOnboardingClient />
    </Suspense>
  );
}
