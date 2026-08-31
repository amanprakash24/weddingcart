import AdminVendorFormClient from '@/components/AdminVendorFormClient';

export const metadata = {
  title: 'Edit Vendor — Admin',
  robots: { index: false, follow: false },
};

export default async function EditVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminVendorFormClient vendorId={id} />;
}
