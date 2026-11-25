import { notFound } from 'next/navigation';
import { sharedPage } from '@/lib/auth/workingVendor';
import { vendorWorkOrderService } from '@/services/vendorWorkOrder.service';
import WorkOrderDocument from '@/components/workOrder/WorkOrderDocument';
import { platformScoped } from '@/lib/ownership/entry';

export const metadata = {
  title: 'Work order | Shaadi Shopping',
  robots: { index: false, follow: false },
};

// The vendor's own work order (money design v1, PR 4): the scope for anyone who may manage the business's weddings; their amount only
// for those who may see its money. Never the couple's price, commission or margin — the service sends the vendor view only.
async function VendorWorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const who = await sharedPage('weddings');
  const { id } = await params;
  const wo = await vendorWorkOrderService.forVendor(who.vendorId, id).catch(() => null);
  if (!wo) notFound();
  return (
    <div className="px-3 py-6 sm:px-6 print:p-0">
      <WorkOrderDocument wo={wo} vendorName={wo.vendorName} showAmount={who.can('view_financials')} />
    </div>
  );
}

// Record ownership: this page works as Shaadi Shopping (lib/ownership/entry.ts).
export default platformScoped(VendorWorkOrderPage);
