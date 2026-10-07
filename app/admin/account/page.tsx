import MySignIn from '@/components/admin/MySignIn';

// "My sign-in" — a team member registers their own mobile number and gets their own 6-digit code. The card loads and saves
// through /api/admin/account/sign-in; this page reads no data itself.
export const metadata = { title: 'My sign-in | Admin', robots: { index: false, follow: false } };

export default function AdminAccountPage() {
  return (
    <div className="px-4 py-6 md:px-8">
      <h1 className="mb-5 text-xl font-bold text-gray-900">My sign-in</h1>
      <MySignIn />
    </div>
  );
}
