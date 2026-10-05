import BusinessSettingsForm from '@/components/vendor/settings/BusinessSettingsForm';

// "Settings" in Vendor OS (Phase C). The form loads and saves through the venue-scoped API; this page reads no data itself.
export const metadata = { title: 'Settings | Vivah OS', robots: { index: false, follow: false } };

export default function VendorSettingsPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <BusinessSettingsForm />
    </div>
  );
}
