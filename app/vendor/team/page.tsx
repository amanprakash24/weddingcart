import TeamScreen from '@/components/vendor/team/TeamScreen';

// "Team" in Vendor OS (12 Oct 2026): the people who work in the business. The screen loads and saves through the venue-scoped API
// (/api/vendor-os/team, `team` permission); this page reads no data itself.
export const metadata = { title: 'Team | Vivah OS', robots: { index: false, follow: false } };

export default function VendorTeamPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <TeamScreen />
    </div>
  );
}
