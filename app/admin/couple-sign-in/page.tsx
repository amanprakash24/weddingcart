import CoupleSignInSearch from '@/components/admin/CoupleSignInSearch';

// "Couple sign-in" (29 Oct 2026) — the founder finds a couple's My Wedding sign-in by mobile number and, if they lost their code,
// gives them a new one. Loads and saves through /api/admin/couple-logins (founder only); this page reads no data itself.
export const metadata = { title: 'Couple sign-in | Admin', robots: { index: false, follow: false } };

export default function AdminCoupleSignInPage() {
  return (
    <div className="px-4 py-6 md:px-8">
      <h1 className="mb-1 text-xl font-bold text-gray-900">Couple sign-in</h1>
      <p className="mb-5 text-sm text-gray-600">Find a couple&apos;s My Wedding sign-in by mobile number, and give a new code if they lost theirs.</p>
      <CoupleSignInSearch />
    </div>
  );
}
