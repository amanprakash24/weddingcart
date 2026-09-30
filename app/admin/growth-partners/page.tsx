import GrowthPartnersAdminClient from '@/components/admin/GrowthPartnersAdminClient';

export const metadata = {
  title: 'Growth Partners — Admin',
  robots: { index: false, follow: false },
};

export default function AdminGrowthPartnersPage() {
  return <GrowthPartnersAdminClient />;
}
