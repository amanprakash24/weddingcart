import { sharedPage } from '@/lib/auth/workingVendor';
import { venuePortalService } from '@/services/venuePortal.service';
import { buildVendorServicesView } from '@/lib/vendor/servicesView';
import { isVenueCategory } from '@/lib/quotation/terms';
import VendorServicesScreen from '@/components/vendor/VendorServicesScreen';
import { platformScoped } from '@/lib/ownership/entry';

export const metadata = {
  title: 'Services | Vendor OS',
  robots: { index: false, follow: false },
};

// For the owner and anyone in the business who may manage its weddings, like app/vendor/weddings/page.tsx, and the exact same
// vendor-scoped data source (services/venuePortal.service.ts) — no new query, just a different grouping.
//
// Venue Owner specialization (docs/wedding-os/11-vivah-os-ux-architecture.md §3/§20): reuses this exact
// screen, detected via the same isVenueCategory() the quotation-terms code already uses — not a new role,
// not a new route, not a separate shell.
async function VendorServicesPage() {
  const who = await sharedPage('weddings');
  const dashboard = await venuePortalService.getDashboard(who.vendorId, { seesMoney: who.can('view_financials') });
  const services = buildVendorServicesView(dashboard.bookings);
  return <VendorServicesScreen services={services} isVenue={isVenueCategory(dashboard.vendor.category.name)} />;
}

// Record ownership: this page works as Shaadi Shopping (lib/ownership/entry.ts).
export default platformScoped(VendorServicesPage);
