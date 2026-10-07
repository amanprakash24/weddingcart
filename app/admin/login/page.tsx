import AdminLoginClient from '@/components/AdminLoginClient';
import VendorCodeLoginClient from '@/components/vendor/VendorCodeLoginClient';

export const metadata = {
  title: 'Admin Login | ShaadiShopping',
  robots: { index: false, follow: false },
};

// The Shaadi Shopping team signs in like everyone else — their own mobile number + their own 6-digit code (7 Oct 2026). Email and
// password stays available at /admin/login?with=password until the code sign-in is proven for the whole team.
export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ with?: string }> }) {
  if ((await searchParams).with === 'password') return <AdminLoginClient />;
  return <VendorCodeLoginClient team />;
}
