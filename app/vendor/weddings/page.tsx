import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { venuePortalService } from '@/services/venuePortal.service';
import { buildVendorWeddingsView } from '@/lib/vendor/weddingsView';
import { isVenueCategory } from '@/lib/quotation/terms';
import VendorWeddingsScreen from '@/components/vendor/VendorWeddingsScreen';

export const metadata = {
  title: 'Weddings | Vendor OS',
  robots: { index: false, follow: false },
};

// Second auth check on top of proxy.ts's middleware gate — same defense-in-depth pattern as app/vendor/page.tsx.
// Data comes from the same vendor-scoped query that page already uses (services/venuePortal.service.ts),
// just grouped by wedding instead of by booking — no new Prisma query, no new model.
//
// Venue Owner specialization (docs/wedding-os/11-vivah-os-ux-architecture.md §3/§20): same isVenueCategory()
// detection as the Services screen — not a new role, route, or shell.
export default async function VendorWeddingsPage() {
  const session = await requireRole([Role.VENDOR]);
  if (!session?.user?.id) return null;
  const dashboard = await venuePortalService.getDashboard(session.user.id);
  const weddings = buildVendorWeddingsView(dashboard.bookings);
  return <VendorWeddingsScreen weddings={weddings} isVenue={isVenueCategory(dashboard.vendor.category.name)} />;
}
