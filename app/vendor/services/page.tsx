import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { venuePortalService } from '@/services/venuePortal.service';
import { buildVendorServicesView } from '@/lib/vendor/servicesView';
import { isVenueCategory } from '@/lib/quotation/terms';
import VendorServicesScreen from '@/components/vendor/VendorServicesScreen';

export const metadata = {
  title: 'Services | Vendor OS',
  robots: { index: false, follow: false },
};

// Same defense-in-depth pattern as app/vendor/page.tsx and app/vendor/weddings/page.tsx, and the exact same
// vendor-scoped data source (services/venuePortal.service.ts) — no new query, just a different grouping.
//
// Venue Owner specialization (docs/wedding-os/11-vivah-os-ux-architecture.md §3/§20): reuses this exact
// screen, detected via the same isVenueCategory() the quotation-terms code already uses — not a new role,
// not a new route, not a separate shell.
export default async function VendorServicesPage() {
  const session = await requireRole([Role.VENDOR]);
  if (!session?.user?.id) return null;
  const dashboard = await venuePortalService.getDashboard(session.user.id);
  const services = buildVendorServicesView(dashboard.bookings);
  return <VendorServicesScreen services={services} isVenue={isVenueCategory(dashboard.vendor.category.name)} />;
}
