import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { NotFoundError } from '@/lib/errors';
import { vendorEnquiryService } from '@/services/vendorEnquiry.service';
import { venueBusinessService } from '@/services/venueBusiness.service';
import { chosenWorkspace } from '@/lib/auth/workspace';
import VendorEnquiriesClient from '@/components/vendor/VendorEnquiriesClient';
import YourEnquiries from '@/components/vendor/enquiries/YourEnquiries';
import { platformScoped } from '@/lib/ownership/entry';

// Vendor OS — availability enquiries (docs/wedding-os/04-vendor-os.md §9). The vendor is always the logged-in user's
// own vendor; only their own enquiries are listed, reduced to operational facts.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Enquiries | Vendor Portal', robots: { index: false, follow: false } };

// Shaadi Shopping's availability requests are read through the person's OWN vendor (the owner link), so they are shown only when
// the business this person is working in IS that vendor (12 Oct 2026). A team member with no vendor of their own used to get a 404
// here — their home screen — and someone who owns another vendor would have seen that vendor's requests in this business.
async function ownVendorIsThisWorkspace(userId: string, ownVendorId: string | null | undefined): Promise<boolean> {
  if (!ownVendorId) return false;
  const vendorSide = (await venueBusinessService.workspaces(userId)).filter((w) => w.kind === 'VENDOR');
  const chosen = await chosenWorkspace();
  const current = (chosen ? vendorSide.find((w) => w.businessId === chosen) : undefined) ?? (vendorSide.length === 1 ? vendorSide[0] : undefined);
  return !!current && current.vendorId === ownVendorId;
}

async function VendorEnquiriesPage() {
  const session = await requireRole([Role.VENDOR]);
  if (!session?.user?.id) redirect('/vendor/login');
  let enquiries = null;
  if (await ownVendorIsThisWorkspace(session.user.id, session.user.vendorId)) {
    try {
      enquiries = await vendorEnquiryService.listForVendor(session.user.id);
    } catch (err) {
      if (!(err instanceof NotFoundError)) throw err; // no vendor profile after all: nothing of Shaadi Shopping's to show
    }
  }
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
