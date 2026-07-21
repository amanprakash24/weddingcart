import CrmDashboardClient from '@/components/crm/CrmDashboardClient';

export const metadata = {
  title: 'CRM | ShaadiShopping Admin',
  robots: { index: false, follow: false },
};

export default function CrmPage() {
  return <CrmDashboardClient />;
}
