import SiteErrorsAdminClient from '@/components/admin/SiteErrorsAdminClient';

export const metadata = {
  title: 'Site errors — Admin',
  robots: { index: false, follow: false },
};

export default function AdminSiteErrorsPage() {
  return <SiteErrorsAdminClient />;
}
