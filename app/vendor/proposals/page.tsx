import { notFound, redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { NotFoundError } from '@/lib/errors';
import { vendorProposalService } from '@/services/vendorProposal.service';
import { VendorProposalList } from '@/components/vendor/VendorProposalView';
import { platformScoped } from '@/lib/ownership/entry';

// Vendor Proposal View — the list (docs/wedding-os/04-vendor-os.md "Proposal view"). Read-only; the vendor is always
// the logged-in user's own vendor.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Accepted proposals | Vendor Portal', robots: { index: false, follow: false } };

async function VendorProposalsPage() {
  const session = await requireRole([Role.VENDOR]);
  if (!session?.user?.id) redirect('/vendor/login');
  let proposals;
  try {
    proposals = await vendorProposalService.listForVendor(session.user.id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound(); // no vendor profile for this user
    throw err;
  }
  return <VendorProposalList proposals={proposals} />;
}

// Record ownership: this page works as Shaadi Shopping (lib/ownership/entry.ts).
export default platformScoped(VendorProposalsPage);
