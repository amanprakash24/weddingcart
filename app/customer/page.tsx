import { redirect } from 'next/navigation';
import ClientPortalClient from '@/components/ClientPortalClient';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { clientPortalService } from '@/services/clientPortal.service';

export const metadata = {
  title: 'Customer Portal | ShaadiShopping',
  robots: { index: false, follow: false },
};

export default async function CustomerHomePage() {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) redirect('/customer/login');
  const events = await clientPortalService.getEventsForClient(session.user.id);
  return <ClientPortalClient events={events} />;
}
