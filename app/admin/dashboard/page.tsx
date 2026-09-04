import { Suspense } from 'react';
import FounderDashboardClient from '@/components/crm/dashboard/FounderDashboardClient';

export const metadata = {
  title: 'Vivah OS Command Center | ShaadiShopping Admin',
  robots: { index: false, follow: false },
};

export default function FounderDashboardPage() {
  return (
    <Suspense fallback={null}>
      <FounderDashboardClient />
    </Suspense>
  );
}
