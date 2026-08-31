import VenuePortalClient from '@/components/VenuePortalClient';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { venuePortalService } from '@/services/venuePortal.service';

export const metadata = {
  title: 'Vendor Portal | ShaadiShopping',
  robots: { index: false, follow: false },
};

export default async function VendorHomePage() {
  const session = await requireRole([Role.VENDOR]);
  if (!session?.user?.id) return null;
  const dashboard = await venuePortalService.getDashboard(session.user.id);
  return <VenuePortalClient dashboard={dashboard} />;
}
