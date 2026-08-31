import { notFound } from 'next/navigation';
import { guestService } from '@/services/guest.service';
import RsvpClient from '@/components/RsvpClient';

export const metadata = { title: 'RSVP | ShaadiShopping', robots: { index: false, follow: false } };

export default async function RsvpPage({ params }: { params: Promise<{ token: string }> }) {
  const guest = await guestService.getPublicByToken((await params).token);
  if (!guest) notFound();
  return <RsvpClient token={(await params).token} guest={guest} />;
}
