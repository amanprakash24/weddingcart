import { Suspense } from 'react';
import AdminCategoryDetailClient from '@/components/AdminCategoryDetailClient';

export default async function AdminCategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <AdminCategoryDetailClient categoryId={id} />
    </Suspense>
  );
}
