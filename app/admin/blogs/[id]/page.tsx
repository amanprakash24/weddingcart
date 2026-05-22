import AdminBlogEditorClient from '@/components/AdminBlogEditorClient';

export const metadata = {
  title: 'Edit Blog Post — Admin',
  robots: { index: false, follow: false },
};

export default async function EditBlogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminBlogEditorClient blogId={id} />;
}
