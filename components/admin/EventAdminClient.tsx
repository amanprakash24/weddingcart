'use client';

import { useEffect, useState } from 'react';

interface PassType {
  id: string;
  name: string;
  price: number;
  description: string;
  peopleIncluded: number;
  foodIncluded: boolean;
  salesLimit: number | null;
}

interface Ticket {
  id: string;
  ticketCode: string;
  qrCode: string;
  checkInStatus: string;
  attendeeName: string | null;
  attendeePhone: string | null;
  passType?: PassType;
}

interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  amount: number;
  status: string;
  tickets: Ticket[];
}

interface EventData {
  id: string;
  name: string;
  slug: string;
  date: string;
  time: string | null;
  venueName: string;
  venueAddress: string | null;
  status: string;
  capacity: number | null;
  passTypes: PassType[];
  orders: Order[];
  tickets: Ticket[];
}

export default function EventAdminClient({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}`);
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error ?? 'Failed to load event');
      }
      setEvent(payload.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [eventId]);

  const handleCheckIn = async (ticketId: string) => {
    const res = await fetch(`/api/events/${eventId}/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId }),
    });
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      throw new Error(payload.error ?? 'Check-in failed');
    }
    await load();
  };

  if (loading) return <div className="p-6 text-slate-500">Loading event…</div>;
  if (error || !event) return <div className="p-6 text-red-600">{error ?? 'Event not found'}</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#8B1A4A]">Event</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">{event.name}</h1>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">{event.status}</span>
        </div>
        <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
          <div>{new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
          <div>{event.time ?? 'Time TBD'}</div>
          <div>{event.venueName}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Pass types</h2>
          <div className="mt-4 space-y-3">
            {event.passTypes.map((pass) => (
              <div key={pass.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{pass.name}</div>
                    <div className="text-sm text-slate-600">{pass.peopleIncluded} people · {pass.foodIncluded ? 'Food included' : 'No food'}</div>
                  </div>
                  <div className="text-lg font-bold text-[#8B1A4A]">₹{pass.price.toLocaleString('en-IN')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Orders overview</h2>
          <div className="mt-4 space-y-3">
            <div className="text-sm text-slate-600">Total tickets: {event.tickets.length}</div>
            <div className="text-sm text-slate-600">Total orders: {event.orders.length}</div>
            <div className="text-sm text-slate-600">Revenue: ₹{event.orders.reduce((sum, order) => sum + order.amount, 0).toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Attendees / check-in</h2>
        <div className="mt-4 space-y-3">
          {event.tickets.length === 0 ? <div className="text-sm text-slate-500">No tickets yet.</div> : null}
          {event.tickets.map((ticket) => (
            <div key={ticket.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-semibold text-slate-900">{ticket.attendeeName ?? 'Guest'}</div>
                <div className="text-sm text-slate-600">{ticket.ticketCode} · {ticket.checkInStatus}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-wide text-slate-500">{ticket.passType?.name ?? 'Pass'}</span>
                {ticket.checkInStatus !== 'CHECKED_IN' ? (
                  <button
                    type="button"
                    onClick={() => void handleCheckIn(ticket.id)}
                    className="rounded-xl bg-[#8B1A4A] px-3 py-2 text-xs font-semibold text-white"
                  >
                    Check in
                  </button>
                ) : (
                  <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Checked in</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
