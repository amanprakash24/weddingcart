import { redirect } from 'next/navigation';
import ClientPortalClient from '@/components/ClientPortalClient';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { clientPortalService } from '@/services/clientPortal.service';
import { platformScoped } from '@/lib/ownership/entry';

export const metadata = {
  title: 'Customer Portal | ShaadiShopping',
  robots: { index: false, follow: false },
};

async function CustomerHomePage() {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) redirect('/customer/login');
  const events = await clientPortalService.getEventsForClient(session.user.id);
  return <ClientPortalClient events={events} />;
}

// Record ownership: this page works as Shaadi Shopping (lib/ownership/entry.ts).
export default platformScoped(CustomerHomePage);
