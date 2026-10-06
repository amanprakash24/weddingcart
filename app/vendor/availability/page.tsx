import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { venuePortalService } from '@/services/venuePortal.service';
import { groupAvailabilityByMonth } from '@/lib/vendor/availabilityView';
import VendorAvailabilityScreen from '@/components/vendor/VendorAvailabilityScreen';
import { platformScoped } from '@/lib/ownership/entry';

export const metadata = {
  title: 'Availability | Vendor OS',
  robots: { index: false, follow: false },
};

// Same defense-in-depth pattern and same vendor-scoped data source as the other Vendor OS pages. Read-only:
// there is no existing API route to write/update a vendor's own VendorAvailability rows (audited — only
// venuePortalService and founderDashboard.service.ts read this model, nothing writes it on the vendor's
// behalf), so this screen doesn't offer one either. See docs/wedding-os/11-vivah-os-ux-architecture.md §12.
async function VendorAvailabilityPage() {
  const session = await requireRole([Role.VENDOR]);
  if (!session?.user?.id) return null;
  const dashboard = await venuePortalService.getDashboard(session.user.id);
  const months = groupAvailabilityByMonth(dashboard.availability);
  return <VendorAvailabilityScreen months={months} />;
}

// Record ownership: this page works as Shaadi Shopping (lib/ownership/entry.ts).
export default platformScoped(VendorAvailabilityPage);
