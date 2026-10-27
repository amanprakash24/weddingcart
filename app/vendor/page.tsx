import VenuePortalClient from '@/components/VenuePortalClient';
import { redirect } from 'next/navigation';
import { sharedPage } from '@/lib/auth/workingVendor';
import { venuePortalService } from '@/services/venuePortal.service';
import { platformScoped } from '@/lib/ownership/entry';

export const metadata = {
  title: 'Vendor Portal',
  robots: { index: false, follow: false },
};

// The older portal, kept for the business's owner: everyone else is sent to where their workspace opens.
async function VendorHomePage() {
  const who = await sharedPage(null);
  if (who.role !== 'OWNER') redirect(who.home);
  const dashboard = await venuePortalService.getDashboard(who.vendorId, { seesMoney: true });
  return <VenuePortalClient dashboard={dashboard} />;
}

// Record ownership: this page works as Shaadi Shopping (lib/ownership/entry.ts).
export default platformScoped(VendorHomePage);
