import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { venuePortalService } from '@/services/venuePortal.service';
import { buildVendorPaymentsView } from '@/lib/vendor/paymentsView';
import VendorPaymentsScreen from '@/components/vendor/VendorPaymentsScreen';

export const metadata = {
  title: 'Payments | Vendor OS',
  robots: { index: false, follow: false },
};

// Same defense-in-depth pattern and vendor-scoped data source as app/vendor/services/page.tsx —
// docs/wedding-os/11-vivah-os-ux-architecture.md §14/§23: the one new read this screen needed
// (vendor-scoped Payout rows) now lives in venuePortalService.getDashboard alongside everything else.
export default async function VendorPaymentsPage() {
  const session = await requireRole([Role.VENDOR]);
  if (!session?.user?.id) return null;
  const dashboard = await venuePortalService.getDashboard(session.user.id);
  const payments = buildVendorPaymentsView(dashboard.bookings, dashboard.payouts);
  return <VendorPaymentsScreen payments={payments} />;
}
