import { Suspense } from 'react';
import VendorDetailClient from '@/components/VendorDetailClient';

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <VendorDetailClient id={id} />
    </Suspense>
  );
}
