'use client';

import { useCallback, useEffect, useState } from 'react';
import { QUOTE_STATUS_WORDS, type QuoteStatus } from '@/lib/wedding/coupleVendors';

// Staff side of Client OS → Vendors (22 Nov 2026), on the wedding's Functions & Services tab: the quotes the couple asked for (answer
// them here; book the vendor the normal way with "Add service") and the vendors the couple hired themselves — shown for coordination,
// clearly NOT partners: no commission, no payout, not verified by us.

interface Req { id: string; status: QuoteStatus; note: string | null; staffNote: string | null; updatedAt: string; vendor: { name: string; slug: string; category: { name: string } }; weddingEvent: { type: string; label: string | null } | null }
interface Own { id: string; name: string; category: string; phone: string | null; price: number | null; notes: string | null; weddingEvent: { type: string; label: string | null } | null }

const btn = 'min-h-9 rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40';
const fnWords = (e: { type: string; label: string | null } | null) => (e ? e.label || e.type.charAt(0) + e.type.slice(1).toLowerCase() : null);

function RequestRow({ weddingId, r, onDone }: { weddingId: string; r: Req; onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<'QUOTED' | 'NOT_AVAILABLE' | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answer = async (status: QuoteStatus, staffNote?: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/weddings/${weddingId}/quote-requests/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, staffNote: staffNote ?? null, seenUpdatedAt: r.updatedAt }) });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        if (res.status === 409) await onDone();
        throw new Error(body?.error || 'Could not save');
      }
      setMode(null);
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };
  const live = r.status === 'REQUESTED' || r.status === 'QUOTED' || r.status === 'NOT_AVAILABLE';
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {r.vendor.name} <span className="font-normal text-gray-500">· {r.vendor.category.name}{fnWords(r.weddingEvent) ? ` · ${fnWords(r.weddingEvent)}` : ''}</span>{' '}
            <a href={`/vendors/${r.vendor.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-rose-600">listing</a>
          </p>
          {r.note && <p className="text-xs text-gray-600">The couple wrote: “{r.note}”</p>}
          <p className="mt-0.5 text-xs"><span className={`rounded-full px-2 py-0.5 font-semibold ${r.status === 'REQUESTED' ? 'bg-amber-100 text-amber-800' : r.status === 'BOOKED' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'}`}>{QUOTE_STATUS_WORDS[r.status]}</span>{r.staffNote && <span className="ml-2 text-gray-600">{r.staffNote}</span>}</p>
        </div>
        {live && !mode && (
          <div className="flex flex-wrap gap-1.5">
            {r.status !== 'QUOTED' && <button type="button" disabled={busy} onClick={() => { setMode('QUOTED'); setNote(''); }} className={`${btn} bg-gray-900 text-white`}>Share price…</button>}
            {r.status !== 'NOT_AVAILABLE' && <button type="button" disabled={busy} onClick={() => { setMode('NOT_AVAILABLE'); setNote(''); }} className={`${btn} border border-gray-200 text-gray-700`}>Not available…</button>}
            {r.status !== 'NOT_AVAILABLE' && <button type="button" disabled={busy} onClick={() => answer('BOOKED')} className={`${btn} border border-emerald-300 text-emerald-800`} title="After adding the vendor with “Add service”">Mark booked</button>}
            <button type="button" disabled={busy} onClick={() => answer('CLOSED')} className={`${btn} text-gray-500 hover:bg-gray-100`}>Close</button>
          </div>
        )}
      </div>
      {mode && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="grid min-w-[240px] flex-1 gap-1 text-xs text-gray-500">{mode === 'QUOTED' ? 'Price and what it includes — the couple reads this' : 'Why — the couple reads this'}
            <input aria-label={mode === 'QUOTED' ? 'Price for the couple' : 'Reason for the couple'} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className="min-h-9 rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
          </label>
          <button type="button" disabled={busy || !note.trim()} onClick={() => answer(mode, note)} className={`${btn} bg-gray-900 text-white`}>{busy ? 'Saving…' : 'Send to the couple'}</button>
          <button type="button" disabled={busy} onClick={() => setMode(null)} className={`${btn} text-gray-500`}>Cancel</button>
        </div>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </li>
  );
}

export default function CoupleVendorRequests({ weddingId }: { weddingId: string }) {
  const [data, setData] = useState<{ own: Own[]; requests: Req[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/weddings/${weddingId}/couple-vendors`, { cache: 'no-store' });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) throw new Error(body?.error || 'Could not load');
      setData(body.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
    }
  }, [weddingId]);
  // Deferred like the other workspace panels (react-hooks/set-state-in-effect).
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!data || (data.own.length === 0 && data.requests.length === 0)) return null;
  const waiting = data.requests.filter((r) => r.status === 'REQUESTED').length;
  return (
    <section aria-label="From the couple" className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">From the couple · vendors{waiting > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 normal-case tracking-normal">{waiting} quote{waiting === 1 ? '' : 's'} to answer</span>}</h2>
      {data.requests.length > 0 && (
        <>
          <h3 className="mt-3 text-sm font-semibold text-gray-900">Quotes they asked for</h3>
          <p className="text-xs text-gray-500">Answer here. To book one, add it with “Add service” on the function (partner terms apply as usual), then mark it booked.</p>
          <ul className="mt-1 divide-y divide-gray-100">{data.requests.map((r) => <RequestRow key={r.id} weddingId={weddingId} r={r} onDone={load} />)}</ul>
        </>
      )}
      {data.own.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold text-gray-900">Their own vendors <span className="font-normal text-gray-500">— hired by the couple; not our partners, no commission, not verified</span></h3>
          <ul className="mt-1 divide-y divide-gray-100 text-sm">
            {data.own.map((o) => (
              <li key={o.id} className="py-2">
                <b>{o.name}</b> <span className="text-gray-500">· {o.category}{fnWords(o.weddingEvent) ? ` · ${fnWords(o.weddingEvent)}` : ''}{o.phone ? ` · +91 ${o.phone}` : ''}</span>
                {o.notes && <p className="text-xs text-gray-600">{o.notes}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
