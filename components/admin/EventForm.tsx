'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PassInput {
  name: string;
  description: string;
  price: number;
  peopleIncluded: number;
  foodIncluded: boolean;
  salesLimit: number | null;
}

const defaultPasses: PassInput[] = [
  { name: 'Couple', description: 'For two people', price: 599, peopleIncluded: 2, foodIncluded: false, salesLimit: null },
  { name: 'Couple + Food', description: 'For two people with food', price: 1199, peopleIncluded: 2, foodIncluded: true, salesLimit: null },
  { name: 'Family (3)', description: 'For a family of three', price: 799, peopleIncluded: 3, foodIncluded: false, salesLimit: null },
  { name: 'Family + Food', description: 'For a family of three with food', price: 1499, peopleIncluded: 3, foodIncluded: true, salesLimit: null },
];

export default function EventForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    slug: 'dandiya-nights-2026',
    name: 'Dandiya Nights 2026',
    date: '2026-11-15',
    time: '19:30',
    venueName: 'Sayamwar Hall',
    venueAddress: 'Patna, Bihar',
    description: 'A reusable event module for live music, food, and community celebration.',
    coverImage: '',
    capacity: '200',
    status: 'DRAFT',
  });
  const [passTypes, setPassTypes] = useState<PassInput[]>(defaultPasses);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          capacity: form.capacity ? Number(form.capacity) : null,
          passTypes,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error ?? 'Unable to create event');
      }
      router.push(`/admin/events/${payload.data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create event');
    } finally {
      setSaving(false);
    }
  }

  function updatePass(index: number, field: keyof PassInput, value: string | number | boolean | null) {
    setPassTypes((current) => current.map((pass, i) => i === index ? { ...pass, [field]: value } : pass));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Event name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2" required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Slug</label>
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2" required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2" required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Time</label>
          <input value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Venue</label>
          <input value={form.venueName} onChange={(e) => setForm({ ...form, venueName: e.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2" required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Capacity</label>
          <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Venue address</label>
        <input value={form.venueAddress} onChange={(e) => setForm({ ...form, venueAddress: e.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Cover image URL</label>
        <input value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2">
          <option value="DRAFT">DRAFT</option>
          <option value="PUBLISHED">PUBLISHED</option>
        </select>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Pass types</h3>
        {passTypes.map((pass, index) => (
          <div key={`${pass.name}-${index}`} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
              <input value={pass.name} onChange={(e) => updatePass(index, 'name', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Price</label>
              <input type="number" min={0} value={pass.price} onChange={(e) => updatePass(index, 'price', Number(e.target.value) || 0)} className="w-full rounded-xl border border-slate-300 px-3 py-2" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">People included</label>
              <input type="number" min={1} value={pass.peopleIncluded} onChange={(e) => updatePass(index, 'peopleIncluded', Number(e.target.value) || 1)} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
            </div>
            <div className="md:col-span-2 xl:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
              <input value={pass.description} onChange={(e) => updatePass(index, 'description', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Sales limit</label>
              <input type="number" min={0} value={pass.salesLimit ?? ''} onChange={(e) => updatePass(index, 'salesLimit', e.target.value ? Number(e.target.value) : null)} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={pass.foodIncluded} onChange={(e) => updatePass(index, 'foodIncluded', e.target.checked)} />
              Food included
            </label>
          </div>
        ))}
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <button type="submit" disabled={saving} className="rounded-xl bg-[#8B1A4A] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {saving ? 'Saving...' : 'Create event'}
      </button>
    </form>
  );
}
