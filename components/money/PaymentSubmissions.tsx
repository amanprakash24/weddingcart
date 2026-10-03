'use client';

import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, FileText, ImageIcon, XCircle } from 'lucide-react';
import type { StaffSubmission } from '@/services/paymentSubmission.service';
import type { PaymentResult } from '@/components/money/AgreementCard';
import { dateWords } from '@/lib/wedding/controlRoom';
import { isoFromDateInput } from '@/lib/wedding/planTasks';

// Roadmap 1.3 (08-quotation.md §18) — the couple's "I have paid" claims on this agreement. A claim is not money: "Verify" records the
// payment through the same Money v1 path as "Record payment" (so the 25% rule, the hold and auto-confirm apply), after you have found
// it in the bank. "Not matched" tells the couple why, on their link.

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const field = 'min-h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm';

export default function PaymentSubmissions({ quotationId, onChanged }: { quotationId: string; onChanged?: () => Promise<unknown> | void }) {
  const [subs, setSubs] = useState<StaffSubmission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/quotations/${quotationId}/payment-submissions`);
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error ?? 'Could not load payments sent by the couple');
      setSubs(body.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load payments sent by the couple');
    }
  }, [quotationId]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  if (error) return <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>;
  if (!subs || subs.length === 0) return null;
  const pending = subs.filter((s) => s.status === 'PENDING');
  const done = subs.filter((s) => s.status !== 'PENDING');

  const after = async () => {
    await load();
    await onChanged?.();
  };

  return (
    <div className="mt-4 space-y-2">
      {pending.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-amber-900">Payments to verify · {pending.length}</h3>
          <p className="mt-0.5 text-xs text-amber-900/80">The couple says they paid by UPI. Find each one in the bank statement before you verify it — only then does it count.</p>
          <ul className="mt-2 space-y-2">
            {pending.map((s) => <PendingRow key={s.id} quotationId={quotationId} sub={s} onDone={after} />)}
          </ul>
        </div>
      )}
      {done.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowDone((v) => !v)} className="text-xs font-medium text-gray-500 hover:text-gray-800">
            {showDone ? 'Hide' : 'Show'} {done.length} checked {done.length === 1 ? 'payment' : 'payments'} sent by the couple
          </button>
          {showDone && (
            <ul className="mt-2 space-y-1 text-xs text-gray-600">
              {done.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-1.5">
                  {s.status === 'VERIFIED' ? <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : <XCircle className="h-3.5 w-3.5 text-red-500" aria-hidden />}
                  <span className="font-semibold tabular-nums">{inr(s.amount)}</span> · UTR {s.utr} · {s.status === 'VERIFIED' ? 'verified' : `not matched — ${s.rejectReason}`}
                  {s.reviewedByName && <> · {s.reviewedByName}</>}
                  {s.reviewedAt && <> · {dateWords(s.reviewedAt)}</>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function PendingRow({ quotationId, sub, onDone }: { quotationId: string; sub: StaffSubmission; onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<'idle' | 'verify' | 'reject'>('idle');
  const [amount, setAmount] = useState(String(sub.amount));
  const [date, setDate] = useState(sub.paidOn ? sub.paidOn.slice(0, 10) : '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const value = Number(amount.replace(/,/g, ''));
  const call = async (path: 'verify' | 'reject', body: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotations/${quotationId}/payment-submissions/${sub.id}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Something went wrong');
      if (path === 'verify') {
        const c = (json.data as PaymentResult).confirmation;
        setNotice(c?.confirmed ? 'Verified. The booking is confirmed and the wedding has been set up.' : c?.error ? `Verified, but the booking could not be confirmed yet: ${c.error}` : 'Verified — the payment is recorded.');
      }
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  };

  return (
    <li className="rounded-lg border border-amber-100 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900"><span className="tabular-nums">{inr(sub.amount)}</span> · UPI · UTR <span className="font-mono">{sub.utr}</span></p>
          <p className="text-xs text-gray-500">Paid {sub.paidOn ? dateWords(sub.paidOn) : '—'} · sent {dateWords(sub.submittedAt)}</p>
          {sub.note && <p className="mt-1 text-xs text-gray-600">“{sub.note}”</p>}
        </div>
        {sub.proofUrl && (
          <a href={sub.proofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
            {sub.proofIsPdf ? <FileText className="h-3.5 w-3.5" aria-hidden /> : <ImageIcon className="h-3.5 w-3.5" aria-hidden />} Screenshot
          </a>
        )}
      </div>

      {notice && <p role="status" className="mt-2 text-xs text-emerald-700">{notice}</p>}

      {mode === 'idle' && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode('verify')} className="min-h-9 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Found in bank — verify</button>
          <button type="button" onClick={() => setMode('reject')} className="min-h-9 rounded-lg px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">Not matched</button>
        </div>
      )}

      {mode === 'verify' && (
        <div className="mt-2 grid gap-2 rounded-lg border border-dashed border-gray-300 p-2.5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-xs text-gray-500">Amount that arrived ₹
            <input aria-label="Amount that arrived" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
          </label>
          <label className="grid gap-1 text-xs text-gray-500">Date it arrived
            <input type="date" aria-label="Date it arrived" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={busy || !Number.isInteger(value) || value <= 0} onClick={() => call('verify', { amount: value, paidAt: isoFromDateInput(date) ?? undefined })} className="min-h-10 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Verify & record'}</button>
            <button type="button" disabled={busy} onClick={() => setMode('idle')} className="min-h-10 rounded-lg px-2 text-xs text-gray-500 hover:bg-gray-100">Cancel</button>
          </div>
        </div>
      )}

      {mode === 'reject' && (
        <div className="mt-2 grid gap-2 rounded-lg border border-dashed border-red-200 p-2.5">
          <label className="grid gap-1 text-xs text-gray-500">Why could it not be matched? <span className="text-gray-400">(the couple sees this)</span>
            <input aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. No payment with this UTR in our bank statement" className={field} />
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => call('reject', { reason })} className="min-h-10 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Mark not matched'}</button>
            <button type="button" disabled={busy} onClick={() => setMode('idle')} className="min-h-10 rounded-lg px-2 text-xs text-gray-500 hover:bg-gray-100">Cancel</button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </li>
  );
}
