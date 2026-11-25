import AdminWorkOrderClient from '@/components/workOrder/AdminWorkOrderClient';

export const metadata = {
  title: 'Work order — Admin',
  robots: { index: false, follow: false },
};

// A vendor work order as the team sees it (money design v1, PR 4). The API checks money access; commission and margin: founder only.
export default async function AdminWorkOrderPage({ params }: { params: Promise<{ id: string; woId: string }> }) {
  const { id, woId } = await params;
  return <AdminWorkOrderClient weddingId={id} workOrderId={woId} />;
}
