import AdminBlogEditorClient from '@/components/AdminBlogEditorClient';

export const metadata = {
  title: 'New Blog Post — Admin',
  robots: { index: false, follow: false },
};

export default function NewBlogPage() {
  return <AdminBlogEditorClient />;
}
