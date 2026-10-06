import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import AdminClient from '@/components/AdminClient';
import { OLD_TAB_REDIRECTS } from '@/components/admin/adminNav';

export const metadata = {
  title: 'Admin Panel | ShaadiShopping',
  robots: { index: false, follow: false },
};

// /admin on its own lands on Today (the Command Center). /admin?tab=<id> still opens the older screens (Invoices,
// Vendor applications, …) that the shell's sidebar links to.
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams;
  if (!tab) redirect('/admin/dashboard');
  // The removed Enquiries / Consultations / Leads screens open the CRM instead (one status — MASTER-GAP-ANALYSIS §2.4.2).
  const target = typeof tab === 'string' ? OLD_TAB_REDIRECTS[tab] : undefined;
  if (target) redirect(target);
  return (
    <Suspense>
      <AdminClient />
    </Suspense>
  );
}
