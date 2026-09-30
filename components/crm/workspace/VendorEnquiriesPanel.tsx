'use client';

import { useCallback, useEffect, useState } from 'react';
import { ANSWER_STATUSES, STAFF_CHANNELS, STATUS_LABEL, CHANNEL_LABEL, type AnswerStatus, type StaffChannel, type VendorEnquiryStatus } from '@/lib/vendorEnquiry/labels';

// Vendor availability (docs/wedding-os/04-vendor-os.md §9, blueprint §43). Every vendor linked to this customer —
// on the consultation or on the quote — is asked automatically; their answer arrives here, from Vendor OS or recorded
// by staff. Never blocks the quote. The customer never sees this card's content.

interface Row {
  id: string;
  vendorName: string;
  status: VendorEnquiryStatus;
  services: string;
  functions: string | null;
  eventDate: string | null;
  responseNote: string | null;
  suggestedDate: string | null;
  quotedAmount: number | null;
  answeredVia: string | null;
  answeredAt: string | null;
}

const TONE: Record<VendorEnquiryStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  AVAILABLE: 'bg-emerald-100 text-emerald-900',
  AVAILABLE_WITH_CONDITIONS: 'bg-amber-100 text-amber-900',
  NOT_AVAILABLE: 'bg-red-100 text-red-800',
  ALTERNATE_DATE: 'bg-amber-100 text-amber-900',
  QUOTED: 'bg-sky-100 text-sky-900',
  WITHDRAWN: 'bg-slate-100 text-slate-500',
};

const inputClass = 'w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-amber-400';

function AnswerForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [status, setStatus] = useState<AnswerStatus>('AVAILABLE');
  const [channel, setChannel] = useState<StaffChannel>('PHONE');
  const [note, setNote] = useState('');
  const [suggestedDate, setSuggestedDate] = useState('');
  const [quotedAmount, setQuotedAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/vendor-enquiries/${id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, channel, note: note || null, suggestedDate: suggestedDate || null, quotedAmount: quotedAmount || null }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) throw new Error(payload.issues?.[0]?.message ?? payload.error ?? 'Could not save the answer');
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 grid gap-2 rounded-xl bg-gray-50 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-xs text-gray-500">
          The vendor said
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as AnswerStatus)}>
            {ANSWER_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          How they told you
          <select className={inputClass} value={channel} onChange={(e) => setChannel(e.target.value as StaffChannel)}>
            {STAFF_CHANNELS.map((c) => (
              <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>
            ))}
          </select>
        </label>
      </div>
      {status === 'ALTERNATE_DATE' && <input className={inputClass} placeholder="Date they can do (required)" value={suggestedDate} onChange={(e) => setSuggestedDate(e.target.value)} />}
      {status === 'QUOTED' && <input className={inputClass} inputMode="numeric" placeholder="Their amount (₹)" value={quotedAmount} onChange={(e) => setQuotedAmount(e.target.value)} />}
      <textarea
        className={inputClass}
        rows={2}
        placeholder={status === 'AVAILABLE_WITH_CONDITIONS' ? 'Conditions (required)' : 'Note (optional)'}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <button type="button" disabled={busy} onClick={save} className="w-fit rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
        {busy ? 'Saving…' : 'Save answer'}
      </button>
    </div>
  );
}

export default function VendorEnquiriesPanel({ sourceType, sourceId, refreshKey, readOnly }: { sourceType: string; sourceId: string; refreshKey: string; readOnly: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [answering, setAnswering] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/crm/vendor-enquiries?sourceType=${encodeURIComponent(sourceType)}&sourceId=${encodeURIComponent(sourceId)}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok || !body.success) throw new Error(body.error ?? 'Failed to load vendor answers');
        setRows(body.data.enquiries);
        setAlerts(body.data.alerts);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [sourceType, sourceId]);

  // Reload whenever the linked vendors may have changed (quote saved, vendor chosen). Deferred like the other
  // workspace panels (react-hooks/set-state-in-effect).
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load, refreshKey]);

  const visible = (rows ?? []).filter((r) => r.status !== 'WITHDRAWN');
  if (!error && rows !== null && visible.length === 0) return null;

  return (
    <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-5" aria-label="Vendor availability">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Vendor availability</h2>
      <p className="mt-1 text-xs text-gray-500">Vendors on this customer are asked automatically. Their answer never blocks the quote, and the customer never sees it.</p>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      {alerts.length > 0 && (
        <div role="alert" className="mt-3 grid gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {alerts.map((a) => (
            <span key={a}>{a}</span>
          ))}
        </div>
      )}
      <ul className="mt-3 divide-y divide-gray-100">
        {visible.map((r) => (
          <li key={r.id} className="py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{r.vendorName}</p>
                <p className="text-xs text-gray-500">{[r.services, r.functions].filter(Boolean).join(' · ')}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
            </div>
            {(r.responseNote || r.suggestedDate || r.quotedAmount != null || r.answeredVia) && (
              <p className="mt-1 text-xs text-gray-600">
                {[
                  r.suggestedDate ? `Suggests ${r.suggestedDate}` : null,
                  r.quotedAmount != null ? `₹${r.quotedAmount.toLocaleString('en-IN')}` : null,
                  r.responseNote ? `“${r.responseNote}”` : null,
                  r.answeredVia ? `via ${r.answeredVia}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
            {!readOnly && (
              <button type="button" onClick={() => setAnswering(answering === r.id ? null : r.id)} className="mt-1 text-xs font-medium text-amber-700 underline underline-offset-2">
                {answering === r.id ? 'Cancel' : r.status === 'PENDING' ? "Record vendor's answer" : 'Update answer'}
              </button>
            )}
            {answering === r.id && (
              <AnswerForm
                id={r.id}
                onDone={() => {
                  setAnswering(null);
                  load();
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
