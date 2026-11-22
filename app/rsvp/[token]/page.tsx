import { notFound } from 'next/navigation';
import { guestService } from '@/services/guest.service';
import RsvpClient from '@/components/RsvpClient';
import { rsvpPageScoped } from '@/lib/guest/rsvpEntry';

export const metadata = { title: 'RSVP', robots: { index: false, follow: false } };

async function RsvpPage({ params }: { params: Promise<{ token: string }> }) {
  const guest = await guestService.getPublicByToken((await params).token);
  if (!guest) notFound();
  return <RsvpClient token={(await params).token} guest={guest} />;
}

// Record ownership: the page runs as the business whose wedding this guest is on (lib/guest/rsvpEntry.ts).
export default rsvpPageScoped(RsvpPage);
