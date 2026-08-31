'use client';

import { useMemo, useState } from 'react';

type EventOption = { id: string; type: string; label: string | null };
type Guest = { id: string; name: string; phone: string | null; email: string | null; category: string | null; accompanyingGuests: number; rsvpStatus: string; rsvpToken: string; functionResponses: { status: string; weddingEvent: EventOption }[] };

const statuses = ['PENDING', 'ATTENDING', 'NOT_ATTENDING', 'MAYBE'];

export default function GuestRsvp({ weddingId, events, initialGuests, clientMode = false }: { weddingId: string; events: EventOption[]; initialGuests: Guest[]; clientMode?: boolean }) {
  const [guests, setGuests] = useState(initialGuests);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', category: '', accompanyingGuests: 0 });
  const base = clientMode ? `/api/customer/weddings/${weddingId}/guests` : `/api/weddings/${weddingId}/guests`;
  const filtered = useMemo(() => guests.filter((guest) => `${guest.name} ${guest.phone || ''} ${guest.category || ''}`.toLowerCase().includes(query.toLowerCase())), [guests, query]);
  const counts = statuses.map((status) => [status, guests.filter((guest) => guest.rsvpStatus === status).length] as const);
  const add = async (event: React.FormEvent) => {
    event.preventDefault(); if (!form.name.trim()) return; setSaving(true);
    const response = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const body = await response.json(); setSaving(false);
    if (response.ok && body.success) { setGuests((current) => [...current, body.data]); setForm({ name: '', phone: '', email: '', category: '', accompanyingGuests: 0 }); }
  };
  const updateStatus = async (guest: Guest, rsvpStatus: string) => {
    const response = await fetch(`${base}/${guest.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...guest, rsvpStatus, functionResponses: guest.functionResponses.map((item) => ({ weddingEventId: item.weddingEvent.id, status: item.status })) }) });
    const body = await response.json(); if (response.ok && body.success) setGuests((current) => current.map((item) => item.id === guest.id ? body.data : item));
  };
  const edit = async (guest: Guest) => {
    const name = window.prompt('Guest name', guest.name);
    if (!name?.trim()) return;
    const response = await fetch(`${base}/${guest.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...guest, name, functionResponses: guest.functionResponses.map((item) => ({ weddingEventId: item.weddingEvent.id, status: item.status })) }) });
    const body = await response.json(); if (response.ok && body.success) setGuests((current) => current.map((item) => item.id === guest.id ? body.data : item));
  };
  const remove = async (guest: Guest) => {
    if (!window.confirm(`Remove ${guest.name}?`)) return;
    const response = await fetch(`${base}/${guest.id}`, { method: 'DELETE' });
    if (response.ok) setGuests((current) => current.filter((item) => item.id !== guest.id));
  };
  return <section className="rounded-2xl border border-gray-100 bg-white p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-gray-900">Guests & RSVP</h2><p className="mt-1 text-xs text-gray-500">{events.length ? `${events.length} functions available for RSVP` : 'Functions can be added to this event later'}</p><div className="mt-2 flex flex-wrap gap-2">{counts.map(([status, count]) => <span key={status} className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600">{status.replaceAll('_', ' ')} {count}</span>)}</div></div><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search guests" className="rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div><form onSubmit={add} className="mb-5 grid gap-2 rounded-xl border border-dashed border-gray-200 p-3 sm:grid-cols-5"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Guest name" className="rounded-lg border border-gray-200 px-2 py-2 text-sm" /><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="rounded-lg border border-gray-200 px-2 py-2 text-sm" /><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category" className="rounded-lg border border-gray-200 px-2 py-2 text-sm" /><input type="number" min="0" max="20" value={form.accompanyingGuests} onChange={(e) => setForm({ ...form, accompanyingGuests: Number(e.target.value) })} placeholder="Companions" className="rounded-lg border border-gray-200 px-2 py-2 text-sm" /><button disabled={saving} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Add guest</button></form>{filtered.length === 0 ? <p className="text-sm text-gray-500">No guests added yet.</p> : <div className="space-y-2">{filtered.map((guest) => <div key={guest.id} className="rounded-xl border border-gray-100 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium text-gray-900">{guest.name}</p><p className="text-xs text-gray-500">{guest.phone || 'No phone'} · {guest.category || 'Uncategorised'} · {guest.accompanyingGuests} companions</p></div><div className="flex items-center gap-2"><select value={guest.rsvpStatus} onChange={(e) => updateStatus(guest, e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1 text-xs">{statuses.map((status) => <option key={status}>{status}</option>)}</select>  <button onClick={() => edit(guest)} className="text-xs text-rose-600">Edit</button><button onClick={() => remove(guest)} className="text-xs text-red-600">Remove</button></div></div><div className="mt-2 flex flex-wrap gap-2">{guest.functionResponses.map((item) => <span key={item.weddingEvent.id} className="rounded bg-gray-50 px-2 py-1 text-[10px] text-gray-600">{item.weddingEvent.label || item.weddingEvent.type}: {item.status.replaceAll('_', ' ')}</span>)}<a href={`/rsvp/${guest.rsvpToken}`} target="_blank" rel="noreferrer" className="text-[10px] font-semibold text-rose-600">Open RSVP link</a></div></div>)}</div>}</section>;
}
