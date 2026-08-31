import AdminVendorFormClient from '@/components/AdminVendorFormClient';

export const metadata = {
  title: 'Add Vendor — Admin',
  robots: { index: false, follow: false },
};

export default function NewVendorPage() {
  return <AdminVendorFormClient />;
}
