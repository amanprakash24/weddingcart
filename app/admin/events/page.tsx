import Link from 'next/link';
import { eventService } from '@/services/event.service';

export const dynamic = 'force-dynamic';

export default async function AdminEventsPage() {
  const events = await eventService.listAll();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Admin</p>
          <h1 className="text-3xl font-bold text-slate-900">Events</h1>
        </div>
        <Link href="/admin/events/new" className="rounded-lg bg-[#8B1A4A] px-4 py-2 text-sm font-semibold text-white">Create Event</Link>
      </div>

      <div className="space-y-3">
        {events.map((event) => (
          <Link key={event.id} href={`/admin/events/${event.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{event.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{event.venueName}</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate-700">{event.status}</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
