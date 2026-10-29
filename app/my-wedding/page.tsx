import { redirect } from 'next/navigation';
import MyWeddingDashboard from '@/components/customer/MyWeddingDashboard';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';
import { clientPortalService } from '@/services/clientPortal.service';
import { platformScoped } from '@/lib/ownership/entry';

export const metadata = {
  title: 'My Wedding on Vivah OS',
  robots: { index: false, follow: false },
};

// My Wedding — the couple's own dashboard on Vivah OS (28 Oct 2026). Signed in with their mobile + 6-digit login code (/customer/login).
async function MyWeddingPage() {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) redirect('/customer/login');
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { phone: true, loginCodeGiven: true } });
  const events = await clientPortalService.getEventsForClient(session.user.id);
  return <MyWeddingDashboard events={events} phone={user?.phone ?? null} codeGiven={user?.loginCodeGiven ?? false} />;
}

// Record ownership: entered as Shaadi Shopping (lib/ownership/entry.ts); each wedding is then read as its own business
// (lib/customer/coupleEntry.ts).
export default platformScoped(MyWeddingPage);
