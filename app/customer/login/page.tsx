import CoupleLoginClient from '@/components/customer/CoupleLoginClient';

export const metadata = {
  title: 'Sign in to My Wedding',
  robots: { index: false, follow: false },
};

// The couple's sign-in to My Wedding on Vivah OS (28 Oct 2026): mobile number + their 6-digit login code, like everyone on Vivah OS.
export default function CustomerLoginPage() {
  return <CoupleLoginClient redirectPath="/my-wedding" />;
}
