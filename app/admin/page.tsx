import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import AdminClient from '@/components/AdminClient';

export const metadata = {
  title: 'Admin Panel | ShaadiShopping',
  robots: { index: false, follow: false },
};

// /admin on its own lands on Today (the Command Center). /admin?tab=<id> still opens the older screens (Invoices,
// Vendor applications, …) that the shell's sidebar links to.
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams;
  if (!tab) redirect('/admin/dashboard');
  return (
    <Suspense>
      <AdminClient />
    </Suspense>
  );
}
