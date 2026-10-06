import VenuePortalClient from '@/components/VenuePortalClient';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { venuePortalService } from '@/services/venuePortal.service';
import { platformScoped } from '@/lib/ownership/entry';

export const metadata = {
  title: 'Vendor Portal | ShaadiShopping',
  robots: { index: false, follow: false },
};

async function VendorHomePage() {
  const session = await requireRole([Role.VENDOR]);
  if (!session?.user?.id) return null;
  const dashboard = await venuePortalService.getDashboard(session.user.id);
  return <VenuePortalClient dashboard={dashboard} />;
}

// Record ownership: this page works as Shaadi Shopping (lib/ownership/entry.ts).
export default platformScoped(VendorHomePage);
