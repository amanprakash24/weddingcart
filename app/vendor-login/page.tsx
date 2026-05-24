import type { Metadata } from 'next';
import VendorLoginClient from '@/components/VendorLoginClient';

export const metadata: Metadata = {
  title: 'Vendor Login | ShaadiShopping',
  description: 'Login to your ShaadiShopping vendor account to manage enquiries and your business profile.',
};

export default function VendorLoginPage() {
  return <VendorLoginClient />;
}
