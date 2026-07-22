import { notFound } from 'next/navigation';
import LeadWorkspaceClient from '@/components/crm/workspace/LeadWorkspaceClient';
import { isSourceType } from '@/lib/crm/subject';

export const metadata = {
  title: 'Lead Workspace | ShaadiShopping Admin',
  robots: { index: false, follow: false },
};

export default async function LeadWorkspacePage({ params }: { params: Promise<{ sourceType: string; id: string }> }) {
  const { sourceType, id } = await params;
  if (!isSourceType(sourceType)) notFound();

  return <LeadWorkspaceClient sourceType={sourceType} id={id} />;
}
