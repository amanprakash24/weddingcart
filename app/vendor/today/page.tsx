import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
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
// prove the component system on a second role before any Vendor OS data flow existed. Same defense-in-depth
// pattern and vendor-scoped data source as the other Vendor OS pages; no new Prisma query.
//
// Accept/decline on a booking request has no backing endpoint yet (only venueStatus is currently
// PATCH-able — see docs/wedding-os/11-vivah-os-ux-architecture.md §21), so the screen offers no Accept / Decline
// buttons: it lists the requests and opens them in Services.
async function VendorTodayPage() {
  const session = await requireRole([Role.VENDOR]);
  if (!session?.user?.id) return null;
  const dashboard = await venuePortalService.getDashboard(session.user.id);
  const isVenue = isVenueCategory(dashboard.vendor.category.name);
  const view = buildVendorTodayView(dashboard.bookings, isVenue);
  return <VendorTodayScreen vendor={{ businessName: dashboard.vendor.name, category: dashboard.vendor.category.name }} {...view} />;
}

// Record ownership: this page works as Shaadi Shopping (lib/ownership/entry.ts).
export default platformScoped(VendorTodayPage);
