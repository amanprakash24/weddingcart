import PortalHomeClient from '@/components/PortalHomeClient';

export const metadata = {
  title: 'Customer Portal | ShaadiShopping',
  robots: { index: false, follow: false },
};

export default function CustomerHomePage() {
  return <PortalHomeClient portalName="Customer" />;
}
