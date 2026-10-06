import OfferingsScreen from '@/components/vendor/offerings/OfferingsScreen';

// "What we offer" in Vendor OS (Phase C). The screen loads and saves through the venue-scoped API; this page reads no data itself.
export const metadata = { title: 'What we offer | Vivah OS', robots: { index: false, follow: false } };

export default function VendorOfferingsPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <OfferingsScreen />
    </div>
  );
}
