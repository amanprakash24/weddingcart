import { notFound, redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { NotFoundError } from '@/lib/errors';
import { vendorEnquiryService } from '@/services/vendorEnquiry.service';
import VendorEnquiriesClient from '@/components/vendor/VendorEnquiriesClient';

// Vendor OS — availability enquiries (docs/wedding-os/04-vendor-os.md §9). The vendor is always the logged-in user's
// own vendor; only their own enquiries are listed, reduced to operational facts.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Enquiries | Vendor Portal', robots: { index: false, follow: false } };

export default async function VendorEnquiriesPage() {
  const session = await requireRole([Role.VENDOR]);
  if (!session?.user?.id) redirect('/vendor/login');
  let enquiries;
  try {
    enquiries = await vendorEnquiryService.listForVendor(session.user.id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound(); // no vendor profile for this user
    throw err;
  }
  return <VendorEnquiriesClient initial={enquiries} />;
}
