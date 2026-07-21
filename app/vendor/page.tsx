import PortalHomeClient from '@/components/PortalHomeClient';

export const metadata = {
  title: 'Vendor Portal | ShaadiShopping',
  robots: { index: false, follow: false },
};

export default function VendorHomePage() {
  return <PortalHomeClient portalName="Vendor" />;
}
