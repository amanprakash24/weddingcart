import OtpLoginClient from '@/components/OtpLoginClient';

export const metadata = {
  title: 'Vendor Login | ShaadiShopping',
  robots: { index: false, follow: false },
};

export default function VendorLoginPage() {
  return <OtpLoginClient portalName="Vendor" redirectPath="/vendor" />;
}
