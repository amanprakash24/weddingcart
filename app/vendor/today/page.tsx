import { sharedPage } from '@/lib/auth/workingVendor';
import { venuePortalService } from '@/services/venuePortal.service';
import { buildVendorTodayView } from '@/lib/vendor/todayView';
import { isVenueCategory } from '@/lib/quotation/terms';
import VendorTodayScreen from '@/components/vendor/VendorTodayScreen';
import { platformScoped } from '@/lib/ownership/entry';

export const metadata = {
  title: 'Today | Vendor OS',
  robots: { index: false, follow: false },
};

// Wired to real data for the first time — this shipped as a static mock spec-proof (see git history) to
// prove the component system on a second role before any Vendor OS data flow existed. Same vendor-scoped data source as the
// other Vendor OS pages; no new Prisma query.
//
// Open to every member of the business (13 Oct 2026), each part by its own permission: Shaadi Shopping's bookings only for
// someone who may manage weddings, their prices only for someone who may see money. The requests are answered in Services.
async function VendorTodayPage() {
  const who = await sharedPage(null);
  const dashboard = await venuePortalService.getDashboard(who.vendorId, { seesMoney: who.can('view_financials') });
  const isVenue = isVenueCategory(dashboard.vendor.category.name);
  const view = buildVendorTodayView(who.can('weddings') ? dashboard.bookings : [], isVenue);
  return <VendorTodayScreen vendor={{ businessName: dashboard.vendor.name, category: dashboard.vendor.category.name }} {...view} />;
}

// Record ownership: this page works as Shaadi Shopping (lib/ownership/entry.ts).
export default platformScoped(VendorTodayPage);
