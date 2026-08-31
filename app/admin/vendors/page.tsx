import AdminVendorListClient from '@/components/AdminVendorListClient';

export const metadata = {
  title: 'Vendors — Admin',
  robots: { index: false, follow: false },
};

export default function AdminVendorsPage() {
  return <AdminVendorListClient />;
}
