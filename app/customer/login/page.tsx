import OtpLoginClient from '@/components/OtpLoginClient';

export const metadata = {
  title: 'Customer Login | ShaadiShopping',
  robots: { index: false, follow: false },
};

export default function CustomerLoginPage() {
  return <OtpLoginClient portalName="Customer" redirectPath="/customer" />;
}
