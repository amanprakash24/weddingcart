import WeddingDetail from '@/components/vendor/weddings/WeddingDetail';

// One of the business's own weddings. Loaded through the venue-scoped API — another business's wedding is simply not found.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Wedding | Vivah OS', robots: { index: false, follow: false } };

export default async function VenueWeddingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <WeddingDetail id={id} />
    </div>
  );
}
