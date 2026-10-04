import { notFound, redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { NotFoundError } from '@/lib/errors';
import { vendorProposalService } from '@/services/vendorProposal.service';
import { VendorProposalDetail } from '@/components/vendor/VendorProposalView';
import { platformScoped } from '@/lib/ownership/entry';

// Vendor Proposal View — one accepted proposal, reduced to this vendor's own work. Any id the vendor may not see
// (another vendor's, not accepted, unknown) is the same 404, so the page never reveals whether a quotation exists.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Proposal | Vendor Portal', robots: { index: false, follow: false } };

async function VendorProposalPage({ params }: { params: Promise<{ quotationId: string }> }) {
  const session = await requireRole([Role.VENDOR]);
  if (!session?.user?.id) redirect('/vendor/login');
  const { quotationId } = await params;
  let proposal;
  try {
    proposal = await vendorProposalService.getForVendor(session.user.id, quotationId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound(); // not visible to this vendor, or no vendor profile
    throw err;
  }
  return <VendorProposalDetail proposal={proposal} />;
}

// Record ownership: this page works as Shaadi Shopping (lib/ownership/entry.ts).
export default platformScoped(VendorProposalPage);
