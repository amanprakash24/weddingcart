import OurTeam from '@/components/admin/OurTeam';

// "Our team" — the founder's own details first, then Shaadi Shopping's people: add, name, re-code, remove. The card loads and
// saves through /api/admin/team (founder only); this page reads no data itself.
export const metadata = { title: 'Our team | Admin', robots: { index: false, follow: false } };

export default function AdminTeamPage() {
  return (
    <div className="px-4 py-6 md:px-8">
      <h1 className="mb-1 text-xl font-bold text-gray-900">Our team</h1>
      <p className="mb-5 text-sm text-gray-600">Who works at Shaadi Shopping, and how each person signs in.</p>
      <OurTeam />
    </div>
  );
}
