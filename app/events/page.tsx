import Link from 'next/link';
import { eventService } from '@/services/event.service';

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const events = await eventService.listPublished();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-900">Events</h1>
      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {events.map((event) => (
          <Link key={event.id} href={`/events/${event.slug}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300">
            <div className="text-xs uppercase tracking-[0.2em] text-[#8B1A4A]">{event.status}</div>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">{event.name}</h2>
            <div className="mt-2 text-sm text-slate-600">
              {new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            <div className="mt-4 text-sm text-slate-600">{event.venueName}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
