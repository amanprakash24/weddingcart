'use client';

import { useEffect, useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import type { SourceType } from '@/services/leadInbox.service';
import type { HandoffStatus, VenueOnVivahOs } from '@/services/platformHandoff.service';

// "Send to a venue" (11 Nov 2026, Vivah OS phase 4). Shaadi Shopping's team sends this enquiry into a venue's own Vivah OS
// Enquiries — marked "Shaadi Shopping", linked to this record so the commission applies. Only venues on Vivah OS are listed; this
// record stays here, unchanged. A listing enquiry was already sent to its venue automatically (see the history).

const inputClass = 'w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm outline-none focus:border-amber-400';

export default function SendToVenuePanel({ sourceType, sourceId, onSent, readOnly }: { sourceType: SourceType; sourceId: string; onSent: () => void; readOnly?: boolean }) {
  const [venues, setVenues] = useState<VenueOnVivahOs[] | null>(null);
  const [query, setQuery] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/crm/leads/${sourceType}/${sourceId}/send-to-venue`)
      .then((r) => r.json())
      .then((b) => live && (b.success ? setVenues(b.data) : setMessage({ tone: 'error', text: b.error ?? 'Could not load the venues.' })))
      .catch(() => live && setMessage({ tone: 'error', text: 'Could not reach the server.' }));
    return () => {
      live = false;
    };
  }, [sourceType, sourceId]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (venues ?? []).filter((v) => !q || `${v.name} ${v.city ?? ''} ${v.category ?? ''}`.toLowerCase().includes(q));
  }, [venues, query]);

  async function send() {
    if (busy || !vendorId) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/crm/leads/${sourceType}/${sourceId}/send-to-venue`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vendorId }) });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.success) {
        const { status, venueName } = b.data as { status: HandoffStatus; venueName: string };
        setMessage(
          status === 'NOT_ON_VIVAH_OS'
            ? { tone: 'warn', text: `${venueName} is not on Vivah OS yet — nothing was sent. Call them.` }
            : { tone: 'ok', text: status === 'ADDED_TO_OPEN' ? `Sent — ${venueName} already had this couple, so it was added to that enquiry.` : `Sent to ${venueName}’s Vivah OS. It is in their Enquiries now.` }
        );
        setVendorId('');
        onSent();
      } else {
        setMessage({ tone: 'error', text: b.error ?? 'It was not sent. Please try again.' });
      }
    } catch {
      setMessage({ tone: 'error', text: 'Could not reach the server. It was not sent.' });
    }
    setBusy(false);
  }

  return (
    <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-5" aria-label="Send to a venue">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Send to a venue</h2>
      <p className="mt-1 text-sm text-gray-600">Puts this couple in a venue’s own Vivah OS Enquiries, marked “Shaadi Shopping” — commission applies when they book.</p>
      {readOnly ? (
        <p className="mt-3 text-sm text-gray-500">This enquiry is closed or already a wedding.</p>
      ) : venues === null && !message ? (
        <p className="mt-3 text-sm text-gray-500">Loading venues…</p>
      ) : venues && venues.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No venue is on Vivah OS yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          <input aria-label="Find a venue" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a venue by name or city" className={inputClass} />
          <select aria-label="Venue" value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={inputClass} size={Math.min(Math.max(shown.length, 2), 6)}>
            {shown.map((v) => (
              <option key={v.vendorId} value={v.vendorId}>{[v.name, v.city, v.category].filter(Boolean).join(' · ')}</option>
            ))}
          </select>
          <button type="button" onClick={send} disabled={busy || !vendorId} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
            <Send className="h-4 w-4" aria-hidden /> {busy ? 'Sending…' : 'Send to this venue'}
          </button>
        </div>
      )}
      {message && (
        <p role={message.tone === 'error' ? 'alert' : 'status'} className={`mt-3 rounded-lg px-3 py-2 text-sm ${message.tone === 'ok' ? 'bg-emerald-50 text-emerald-900' : message.tone === 'warn' ? 'bg-amber-50 text-amber-900' : 'bg-rose-50 text-rose-800'}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
