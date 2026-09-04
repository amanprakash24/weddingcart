import EventForm from '@/components/admin/EventForm';

export const dynamic = 'force-dynamic';

export default function NewEventPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-900">Create Event</h1>
      <div className="mt-6">
        <EventForm />
      </div>
    </main>
  );
}
