import { redirect } from 'next/navigation';
import { platformScoped } from '@/lib/ownership/entry';

// The couple's portal moved to My Wedding (28 Oct 2026). Old links and bookmarks still land there.
async function CustomerHomePage() {
  redirect('/my-wedding');
}

export default platformScoped(CustomerHomePage);
