import { notFound } from 'next/navigation';
import { guestService } from '@/services/guest.service';
import RsvpClient from '@/components/RsvpClient';
import { platformScoped } from '@/lib/ownership/entry';

export const metadata = { title: 'RSVP | ShaadiShopping', robots: { index: false, follow: false } };

async function RsvpPage({ params }: { params: Promise<{ token: string }> }) {
  const guest = await guestService.getPublicByToken((await params).token);
  if (!guest) notFound();
  return <RsvpClient token={(await params).token} guest={guest} />;
}

// Record ownership: this page works as Shaadi Shopping (lib/ownership/entry.ts).
export default platformScoped(RsvpPage);
