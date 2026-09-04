import WeddingWorkspaceClient from '@/components/wedding/workspace/WeddingWorkspaceClient';

export const metadata = {
  title: 'Event Workspace | ShaadiShopping Admin',
  robots: { index: false, follow: false },
};

export default async function WeddingWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WeddingWorkspaceClient id={id} />;
}
