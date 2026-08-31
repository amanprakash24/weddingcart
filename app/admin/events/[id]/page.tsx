import EventAdminClient from '@/components/admin/EventAdminClient';
import { eventService } from '@/services/event.service';

export const dynamic = 'force-dynamic';

export default async function AdminEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await eventService.getById(id);
  if (!event) {
    return <main className="p-8 text-slate-700">Event not found.</main>;
  }

  return <EventAdminClient eventId={id} />;
}
