'use client';

import { useState } from 'react';
import { GuestRsvpStatus } from '@/generated/prisma/enums';

type PublicGuest = {
  name: string; accompanyingGuests: number; rsvpStatus: GuestRsvpStatus;
  functionResponses: { weddingEventId: string; status: GuestRsvpStatus }[];
  wedding: { weddingType: string | null; weddingNumber: string; primaryDate: Date; city: string; couple: { brideName: string | null; groomName: string | null } | null; events: { id: string; type: string; label: string | null; date: Date; startTime: string | null; venueName: string | null; city: string }[] };
};

export default function RsvpClient({ token, guest }: { token: string; guest: PublicGuest }) {
  const [status, setStatus] = useState<GuestRsvpStatus>(guest.rsvpStatus);
  const [companions, setCompanions] = useState(guest.accompanyingGuests);
  const [functions, setFunctions] = useState<Record<string, GuestRsvpStatus>>(Object.fromEntries(guest.functionResponses.map((item) => [item.weddingEventId, item.status])));
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const title = [guest.wedding.couple?.brideName, guest.wedding.couple?.groomName].filter(Boolean).join(' & ') || guest.wedding.weddingType || 'Your event';
  const submit = async () => {
    setSaving(true);
    const response = await fetch(`/api/rsvp/${token}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rsvpStatus: status, accompanyingGuests: companions, functionResponses: guest.wedding.events.map((event) => ({ weddingEventId: event.id, status: functions[event.id] || GuestRsvpStatus.PENDING })) }) });
    setSaving(false);
    if (response.ok) setSaved(true);
  };
  return <main className="min-h-screen bg-[#FFFAF5] px-4 py-10"><div className="mx-auto max-w-lg rounded-3xl bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">Shaadi Shopping RSVP</p><h1 className="mt-3 text-3xl font-bold text-slate-900">{title}</h1><p className="mt-2 text-sm text-slate-600">{guest.wedding.weddingType || 'Event'} · {new Date(guest.wedding.primaryDate).toLocaleDateString('en-IN')} · {guest.wedding.city}</p><p className="mt-6 text-lg font-semibold text-slate-900">Hi {guest.name}, will you join us?</p><div className="mt-3 grid grid-cols-3 gap-2">{([['ATTENDING', 'Yes'], ['NOT_ATTENDING', 'No'], ['MAYBE', 'Maybe']] as const).map(([value, label]) => <button key={value} onClick={() => setStatus(value)} className={`rounded-xl border px-3 py-3 text-sm font-semibold ${status === value ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-600'}`}>{label}</button>)}</div><label className="mt-5 block text-sm font-medium text-slate-700">Number of accompanying guests<input type="number" min="0" max="20" value={companions} onChange={(e) => setCompanions(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3" /></label>{guest.wedding.events.length > 0 && <div className="mt-6 space-y-3"><h2 className="font-semibold text-slate-900">Which functions will you attend?</h2>{guest.wedding.events.map((event) => <div key={event.id} className="rounded-xl bg-slate-50 p-3"><p className="font-medium text-slate-800">{event.label || event.type}</p><p className="text-xs text-slate-500">{new Date(event.date).toLocaleDateString('en-IN')}{event.startTime ? ` · ${event.startTime}` : ''} · {event.venueName || event.city}</p><select value={functions[event.id] || GuestRsvpStatus.PENDING} onChange={(e) => setFunctions({ ...functions, [event.id]: e.target.value as GuestRsvpStatus })} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"><option value="PENDING">Not answered</option><option value="ATTENDING">Yes</option><option value="NOT_ATTENDING">No</option><option value="MAYBE">Maybe</option></select></div>)}</div>}<button onClick={submit} disabled={saving} className="mt-7 w-full rounded-xl bg-rose-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Submit RSVP'}</button>{saved && <p className="mt-3 text-center text-sm font-medium text-emerald-600">Your RSVP has been saved. Thank you!</p>}</div></main>;
}
