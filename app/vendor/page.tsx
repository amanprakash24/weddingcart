import { redirect } from 'next/navigation';
import { sharedPage } from '@/lib/auth/workingVendor';
import { platformScoped } from '@/lib/ownership/entry';

export const metadata = {
  title: 'Vendor OS',
  robots: { index: false, follow: false },
};

// /vendor opens where this person's workspace opens (Today for an owner). The older "Vendor Portal" page that used to live here
// was retired on 11 Nov 2026 (launch walkthrough): it showed different counts from Today and said payments were "not
// available". Its one action — moving a booking's setup status — is on the Services screen.
async function VendorHomePage() {
  const who = await sharedPage(null);
  redirect(who.home);
}

// Record ownership: this page works as Shaadi Shopping (lib/ownership/entry.ts).
export default platformScoped(VendorHomePage);
