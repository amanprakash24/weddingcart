import ReviewsAdminClient from '@/components/admin/ReviewsAdminClient';

export const metadata = {
  title: 'Reviews — Admin',
  robots: { index: false, follow: false },
};

export default function AdminReviewsPage() {
  return <ReviewsAdminClient />;
}
