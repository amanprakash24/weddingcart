'use client';

import { useMemo, useState } from 'react';

interface PassType {
  id: string;
  name: string;
  price: number;
  description: string;
  peopleIncluded: number;
  foodIncluded: boolean;
  salesLimit: number | null;
}

interface EventData {
  id: string;
  slug: string;
  name: string;
  date: string;
  time: string | null;
  venueName: string;
  venueAddress: string | null;
  description: string;
  coverImage: string;
  capacity: number | null;
  passTypes: PassType[];
}

export default function EventPublicClient({ event }: { event: EventData }) {
  const firstPassId = event.passTypes[0]?.id ?? '';
  const [selectedPassId, setSelectedPassId] = useState<string>(firstPassId);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedPass = useMemo(
    () => event.passTypes.find((pass) => pass.id === selectedPassId) ?? event.passTypes[0] ?? null,
    [event.passTypes, selectedPassId],
  );

  const total = selectedPass ? selectedPass.price * quantity : 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedPass) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/events/${event.id}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerEmail,
          passTypeId: selectedPass.id,
          quantity,
          paymentProvider: 'RAZORPAY',
          paymentReference: 'dev-mode',
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error ?? 'Order failed');
      }

      const paymentUrl = payload.data?.paymentUrl;
      if (paymentUrl) window.location.assign(paymentUrl);
      setSuccess('Your order is pending payment. Tickets are issued after Razorpay confirms payment.');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setQuantity(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 text-slate-800">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {event.coverImage ? (
              <img src={event.coverImage} alt={event.name} className="h-72 w-full object-cover" />
            ) : null}
            <div className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8B1A4A]">Event</p>
              <h1 className="mt-2 text-4xl font-bold text-slate-900">{event.name}</h1>
              <p className="mt-3 text-slate-600">{event.description || 'A curated event experience designed for memorable nights.'}</p>
              <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-700">
                <span>{new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span>{event.time ?? 'Schedule to be announced'}</span>
                <span>{event.venueName}</span>
                {event.capacity ? <span>Capacity: {event.capacity}</span> : null}
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">Pass types</h2>
            {event.passTypes.map((pass) => (
              <button
                key={pass.id}
                type="button"
                onClick={() => setSelectedPassId(pass.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  selectedPassId === pass.id
                    ? 'border-[#8B1A4A] bg-[#FFF2F7] shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">{pass.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">{pass.description || 'Event pass'}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-[#8B1A4A]">₹{pass.price.toLocaleString('en-IN')}</div>
                    <div className="text-xs text-slate-500">{pass.peopleIncluded} people</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-white px-2 py-1">{pass.foodIncluded ? 'Food included' : 'No food'}</span>
                  {pass.salesLimit ? <span className="rounded-full bg-white px-2 py-1">Limit: {pass.salesLimit}</span> : null}
                </div>
              </button>
            ))}
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Book passes</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required className="w-full rounded-xl border border-slate-300 px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} required className="w-full rounded-xl border border-slate-300 px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} type="email" className="w-full rounded-xl border border-slate-300 px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Quantity</label>
              <input value={quantity} min={1} onChange={(e) => setQuantity(Number(e.target.value) || 1)} type="number" className="w-full rounded-xl border border-slate-300 px-3 py-2" />
            </div>

            <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
              <div className="flex items-center justify-between"><span>Selected pass</span><span>{selectedPass?.name ?? '—'}</span></div>
              <div className="mt-2 flex items-center justify-between"><span>Amount</span><span>₹{total.toLocaleString('en-IN')}</span></div>
            </div>

            {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
            {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}

            <button type="submit" disabled={submitting || !selectedPass} className="w-full rounded-xl bg-[#8B1A4A] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {submitting ? 'Processing...' : 'Pay now'}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
