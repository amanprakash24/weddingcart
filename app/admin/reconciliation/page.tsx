import ReconciliationAdminClient from '@/components/admin/ReconciliationAdminClient';

export const metadata = {
  title: 'Money check — Admin',
  robots: { index: false, follow: false },
};

// The founder's money reconciliation (money design v1, PR 2). The API refuses everyone but the founder.
export default function AdminReconciliationPage() {
  return <ReconciliationAdminClient />;
}
