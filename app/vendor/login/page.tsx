import VendorCodeLoginClient from '@/components/vendor/VendorCodeLoginClient';

export const metadata = {
  title: 'Vendor Login | Vivah OS', // the site template adds "| ShaadiShopping"
  robots: { index: false, follow: false },
};

// Vendors sign in with their registered mobile number + the 6-digit login code Shaadi Shopping issued (lib/auth/vendorCode.ts).
export default function VendorLoginPage() {
  return <VendorCodeLoginClient />;
}
