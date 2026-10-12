import { redirect } from 'next/navigation';
import { workingVendor } from '@/lib/auth/workingVendor';
import { vendorEnquiryService } from '@/services/vendorEnquiry.service';
import VendorEnquiriesClient from '@/components/vendor/VendorEnquiriesClient';
import YourEnquiries from '@/components/vendor/enquiries/YourEnquiries';
import { platformScoped } from '@/lib/ownership/entry';

// Vendor OS — availability enquiries (docs/wedding-os/04-vendor-os.md §9). The vendor is always the one the signed-in person is
// working in (lib/auth/workingVendor.ts); only its enquiries are listed, reduced to operational facts.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Enquiries | Vendor Portal', robots: { index: false, follow: false } };

// Shaadi Shopping's availability requests to this vendor are shown to the owner and to anyone in the business who may work its
// enquiries (13 Oct 2026) — until then only to the vendor's own linked owner.
async function VendorEnquiriesPage() {
  const who = await workingVendor();
  if (!who) redirect('/workspace');
  const enquiries = who.vendorId && who.can('enquiries') ? await vendorEnquiryService.listForVendor(who.vendorId) : null;
  // The venue's OWN enquiries first (their business, loaded venue-scoped from /api/vendor-os/enquiries); Shaadi Shopping's
  // availability requests below (Shaadi Shopping's records, shared with this vendor — this page's own scope).
  return (
    <div className="mx-auto max-w-2xl space-y-10 px-4 py-6">
      <YourEnquiries />
      {enquiries && <VendorEnquiriesClient initial={enquiries} embedded />}
    </div>
  );
}

// Record ownership: this page works as Shaadi Shopping (lib/ownership/entry.ts).
export default platformScoped(VendorEnquiriesPage);
