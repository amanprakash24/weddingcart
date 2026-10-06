'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ANSWER_STATUSES, STATUS_LABEL, type AnswerStatus, type VendorEnquiryView } from '@/lib/vendorEnquiry/labels';

// Vendor OS — availability enquiries (docs/wedding-os/04-vendor-os.md §9). Shaadi Shopping asks whether the vendor can
// take a wedding; the vendor answers here. Everything shown was reduced on the server to operational facts (date,
// city, guests, event, service): never who the couple is.

const dateLabel = (value: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
};
const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm';

function Answer({ enquiry, onSaved }: { enquiry: VendorEnquiryView; onSaved: (e: VendorEnquiryView) => void }) {
  const [status, setStatus] = useState<AnswerStatus>(enquiry.status === 'PENDING' || enquiry.status === 'WITHDRAWN' ? 'AVAILABLE' : (enquiry.status as AnswerStatus));
  const [note, setNote] = useState(enquiry.answer.note ?? '');
  const [suggestedDate, setSuggestedDate] = useState(enquiry.answer.suggestedDate ?? '');
  const [quotedAmount, setQuotedAmount] = useState(enquiry.answer.quotedAmount != null ? String(enquiry.answer.quotedAmount) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/vendor/enquiries/${enquiry.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note: note || null, suggestedDate: suggestedDate || null, quotedAmount: quotedAmount || null }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) throw new Error(payload.issues?.[0]?.message ?? payload.error ?? 'Could not send your answer');
      onSaved(payload.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 grid gap-2">
      <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as AnswerStatus)} aria-label="Your answer">
        {ANSWER_STATUSES.map((s) => (
          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
        ))}
      </select>
      {status === 'ALTERNATE_DATE' && <input className={inputClass} placeholder="The date you can do" value={suggestedDate} onChange={(e) => setSuggestedDate(e.target.value)} />}
      {status === 'QUOTED' && <input className={inputClass} inputMode="numeric" placeholder="Your price (₹)" value={quotedAmount} onChange={(e) => setQuotedAmount(e.target.value)} />}
      <textarea
        className={inputClass}
        rows={2}
        placeholder={status === 'AVAILABLE_WITH_CONDITIONS' ? 'Your conditions (required)' : 'Anything to add (optional)'}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="button" disabled={busy} onClick={save} className="min-h-[44px] rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? 'Sending…' : 'Send answer'}
      </button>
    </div>
  );
}

// embedded: shown as the "From Shaadi Shopping" section under the venue's own enquiries (Phase C), inside Vendor OS's shell.
export default function VendorEnquiriesClient({ initial, embedded = false }: { initial: VendorEnquiryView[]; embedded?: boolean }) {
  const [enquiries, setEnquiries] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const active = enquiries.filter((e) => e.status !== 'WITHDRAWN');

  return (
    <main className={embedded ? '' : 'min-h-screen bg-slate-50 px-4 py-8 sm:px-6'}>
      <div className={embedded ? 'space-y-4' : 'mx-auto max-w-3xl space-y-5'}>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {!embedded && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Vivah OS · Vendor Portal</p>}
            {embedded ? (
              <h2 className="text-lg font-bold text-slate-900">From Shaadi Shopping</h2>
            ) : (
              <h1 className="mt-1 text-2xl font-bold text-slate-900">Availability enquiries</h1>
            )}
            <p className="mt-1 text-sm text-slate-600">Shaadi Shopping is asking whether you can take these weddings. Answer when you can.</p>
          </div>
          {!embedded && <Link href="/vendor" className="text-sm font-medium text-slate-600 underline underline-offset-4">Back to portal</Link>}
        </header>

        {active.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">No open enquiries right now.</p>
        ) : (
          <ul className="space-y-3">
            {active.map((e) => (
              <li key={e.id} className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{e.services}</p>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${e.status === 'PENDING' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>{STATUS_LABEL[e.status]}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {[dateLabel(e.eventDate), e.guestCount != null ? `${e.guestCount} guests` : null, e.city, e.eventType, e.functions].filter(Boolean).join(' · ')}
                </p>
                {e.answer.answeredAt && (
                  <p className="mt-1 text-xs text-slate-500">
                    Answered {dateLabel(e.answer.answeredAt)}
                    {e.answer.answeredBy === 'shaadi-shopping' ? ' (recorded by Shaadi Shopping)' : ''}
                    {e.answer.suggestedDate ? ` · suggests ${e.answer.suggestedDate}` : ''}
                    {e.answer.quotedAmount != null ? ` · ₹${e.answer.quotedAmount.toLocaleString('en-IN')}` : ''}
                    {e.answer.note ? ` · “${e.answer.note}”` : ''}
                  </p>
                )}
                <button type="button" onClick={() => setOpen(open === e.id ? null : e.id)} className="mt-2 text-sm font-medium text-rose-600 underline underline-offset-2">
                  {open === e.id ? 'Close' : e.status === 'PENDING' ? 'Answer' : 'Change answer'}
                </button>
                {open === e.id && (
                  <Answer
                    enquiry={e}
                    onSaved={(updated) => {
                      setEnquiries((list) => list.map((x) => (x.id === updated.id ? updated : x)));
                      setOpen(null);
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-500">Client contact details are shared once a booking is confirmed. For any question, contact the Shaadi Shopping team.</p>
      </div>
    </main>
  );
}
