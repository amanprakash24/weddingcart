import ProfileScreen from '@/components/vendor/profile/ProfileScreen';

// "Your business profile" in Vendor OS (6 Oct 2026). The screen loads and saves through the venue-scoped API; this page reads no
// data itself. Until the profile is complete, VendorShell keeps the rest of Vendor OS behind this page.
export const metadata = { title: 'Your business profile | Vivah OS', robots: { index: false, follow: false } };

export default function VendorProfilePage() {
  return <ProfileScreen />;
}
