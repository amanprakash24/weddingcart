import { sharedPage } from '@/lib/auth/workingVendor';
import { vendorProposalService } from '@/services/vendorProposal.service';
import { VendorProposalList } from '@/components/vendor/VendorProposalView';
import { platformScoped } from '@/lib/ownership/entry';

// Vendor Proposal View — the list (docs/wedding-os/04-vendor-os.md "Proposal view"). Read-only; the vendor is always the one
// the signed-in person is working in. For the owner and anyone in the business who may manage its weddings; amounts only for
// someone who may see money (lib/auth/workingVendor.ts).
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Accepted proposals | Vendor Portal', robots: { index: false, follow: false } };

async function VendorProposalsPage() {
  const who = await sharedPage('weddings');
  return <VendorProposalList proposals={await vendorProposalService.listForVendor(who.vendorId, { seesMoney: who.can('view_financials') })} />;
}

// Record ownership: this page works as Shaadi Shopping (lib/ownership/entry.ts).
export default platformScoped(VendorProposalsPage);
