import AdminBlogClient from '@/components/AdminBlogClient';

export const metadata = {
  title: 'Blog Posts — Admin',
  robots: { index: false, follow: false },
};

export default function AdminBlogsPage() {
  return <AdminBlogClient />;
}
