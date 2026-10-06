import EnquiryDetail from '@/components/vendor/enquiries/EnquiryDetail';

// One of the venue's own enquiries (Phase C). Loaded through the venue-scoped API — another business's enquiry is simply not found.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Enquiry | Vivah OS', robots: { index: false, follow: false } };

export default async function VenueEnquiryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string }> }) {
  const [{ id }, { added }] = await Promise.all([params, searchParams]);
  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <EnquiryDetail id={id} justAdded={added === '1'} />
    </div>
  );
}
