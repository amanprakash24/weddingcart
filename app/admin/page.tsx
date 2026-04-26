import { Suspense } from 'react';
import AdminClient from '@/components/AdminClient';

export const metadata = {
  title: 'Admin Panel | ShaadiShopping',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <Suspense>
      <AdminClient />
    </Suspense>
  );
}
