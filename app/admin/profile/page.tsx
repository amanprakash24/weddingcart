import MyProfile from '@/components/admin/MyProfile';

// "My profile" — the signed-in team member's own photo, name and designation. The card loads and saves through
// /api/admin/profile; this page reads no data itself.
export const metadata = { title: 'My profile | Admin', robots: { index: false, follow: false } };

export default function AdminProfilePage() {
  return (
    <div className="px-4 py-6 md:px-8">
      <h1 className="mb-1 text-xl font-bold text-gray-900">My profile</h1>
      <p className="mb-5 text-sm text-gray-600">Your photo, name and designation, as the team sees them.</p>
      <MyProfile />
    </div>
  );
}
