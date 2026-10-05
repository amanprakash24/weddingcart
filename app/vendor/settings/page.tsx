import BusinessSettingsForm from '@/components/vendor/settings/BusinessSettingsForm';
import LoginCodeCard from '@/components/vendor/settings/LoginCodeCard';

// "Settings" in Vendor OS (Phase C). The form loads and saves through the venue-scoped API; this page reads no data itself.
export const metadata = { title: 'Settings | Vivah OS', robots: { index: false, follow: false } };

export default function VendorSettingsPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <BusinessSettingsForm />
      {/* Its own card and its own save: changing the code has nothing to do with the business settings above. */}
      <div id="login-code" className="mt-6 scroll-mt-24">
        <LoginCodeCard />
      </div>
    </div>
  );
}
