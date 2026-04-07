import { Suspense } from 'react';
import AdminVendorDetailClient from '@/components/AdminVendorDetailClient';

export default async function AdminVendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <AdminVendorDetailClient vendorId={id} />
    </Suspense>
  );
}
