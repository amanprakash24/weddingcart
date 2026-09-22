'use client';

import { useState, type ReactNode } from 'react';
import { CheckCircle2, Clock3, AlertTriangle, CircleDashed } from 'lucide-react';
import type { AgreementMoneyView } from '@/lib/commercial/view';
import { dateWords } from '@/lib/wedding/controlRoom';
import { isoFromDateInput } from '@/lib/wedding/planTasks';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const METHODS: { value: string; label: string }[] = [
  { value: 'UPI', label: 'UPI' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CHEQUE', label: 'Cheque' },
];
const field = 'min-h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm';

export interface RecordPaymentInput {
  amount: number;
  method: string;
  reference?: string;
  paidAt?: string;
  idempotencyKey: string;
}

// What the server tells back after a payment: enough to say whether the booking was confirmed by it.
export interface PaymentResult {
  duplicate?: boolean;
  confirmation?: { attempted: boolean; confirmed: boolean; error: string | null };
}

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function tone(m: AgreementMoneyView) {
  if (m.bookingConfirmed) return { chip: 'bg-emerald-100 text-emerald-800', Icon: CheckCircle2 };
  if (m.readyToConfirm) return { chip: 'bg-blue-100 text-blue-800', Icon: CheckCircle2 };
  if (m.state === 'DATE_HELD') return { chip: m.overdue ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800', Icon: m.overdue ? AlertTriangle : Clock3 };
  return { chip: 'bg-gray-100 text-gray-700', Icon: CircleDashed };
}

// Money V1 — one card that answers, at a glance: what was agreed, how much confirms the booking, how much is in, how much is still
// needed, whether the date is only held or the booking is confirmed, what is outstanding overall, and what to do next (with the
// invoice it belongs to). Shown in the CRM before the wedding exists and in the wedding's Money tab after — the same numbers.
export default function AgreementCard({ money, onRecordPayment, action, defaultRecording = false }: { money: AgreementMoneyView; onRecordPayment: (input: RecordPaymentInput) => Promise<PaymentResult | void>; action?: ReactNode; defaultRecording?: boolean }) {
  const t = tone(money);
  const [recording, setRecording] = useState(defaultRecording);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const progress = money.confirmationAmount > 0 ? Math.min(1, money.received / money.confirmationAmount) : 0;

  return (
    <section aria-label="Booking agreement and money" className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Agreement & money{money.quotationNumber ? ` · ${money.quotationNumber}` : ''}</h2>
          <p className="mt-1 text-sm text-gray-700">{money.message}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${t.chip}`}><t.Icon className="h-3.5 w-3.5" aria-hidden />{money.stateLabel}</span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Tile label="Accepted value" value={inr(money.agreementTotal)} />
        <Tile label={`To confirm (${money.confirmationPercent}%)`} value={inr(money.confirmationAmount)} />
        <Tile label="Received" value={inr(money.received)} good={money.received > 0} />
        <Tile label="Still to confirm" value={money.remaining > 0 ? inr(money.remaining) : '—'} warn={money.remaining > 0 && money.state === 'DATE_HELD'} />
        <Tile label="Total outstanding" value={inr(money.outstanding)} />
      </dl>

      {!money.bookingConfirmed && money.confirmationAmount > 0 && (
        <div className="mt-3" role="img" aria-label={`${Math.round(progress * 100)}% of the confirmation amount received`}>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${money.overdue ? 'bg-red-500' : progress >= 1 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${progress * 100}%` }} /></div>
        </div>
      )}

      {money.state === 'DATE_HELD' && money.holdStartedAt && !money.bookingConfirmed && (
        <p className={`mt-2 text-xs ${money.overdue ? 'font-semibold text-red-700' : 'text-gray-500'}`}>
          Date held since {dateWords(money.holdStartedAt)} · hold {money.overdue ? 'ended' : 'ends'} {dateWords(money.holdExpiresAt)}
          {money.overdue && ' — the date is not released and nothing is refunded automatically; decide with the customer what happens next.'}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2 rounded-xl bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-gray-900">{money.next.label}</p>
          {money.next.invoiceNumber && <p className="text-xs text-gray-500">On invoice {money.next.invoiceNumber}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {action}
          {money.outstanding > 0 && !recording && (
            <button type="button" onClick={() => { setNotice(null); setRecording(true); }} className="min-h-10 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">Record payment</button>
          )}
        </div>
      </div>

      {notice && <p role={notice.ok ? 'status' : 'alert'} className={`mt-2 text-sm ${notice.ok ? 'text-emerald-700' : 'text-amber-800'}`}>{notice.text}</p>}

      {recording && (
        <PaymentForm
          money={money}
          onCancel={() => setRecording(false)}
          onSubmit={async (input) => {
            const result = await onRecordPayment(input);
            setRecording(false);
            const c = result && 'confirmation' in result ? result.confirmation : undefined;
            if (result && result.duplicate) setNotice({ ok: true, text: 'That payment was already recorded — nothing was added twice.' });
            else if (c?.confirmed) setNotice({ ok: true, text: 'Payment recorded. The booking is confirmed and the wedding has been set up.' });
            else if (c?.error) setNotice({ ok: false, text: `Payment recorded, but the booking could not be confirmed yet: ${c.error} Use “Confirm booking” to retry.` });
            else setNotice({ ok: true, text: 'Payment recorded.' });
          }}
        />
      )}

      {money.payments.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="uppercase tracking-wide text-gray-400"><tr><th className="pb-1.5 font-medium">Date</th><th className="pb-1.5 font-medium">Amount</th><th className="pb-1.5 font-medium">How</th><th className="pb-1.5 font-medium">Reference</th><th className="pb-1.5 font-medium">Recorded by</th><th className="pb-1.5 font-medium">Invoice</th></tr></thead>
            <tbody>
              {money.payments.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 text-gray-700">
                  <td className="py-1.5">{dateWords(p.paidAt)}</td>
                  <td className="py-1.5 font-semibold tabular-nums">{inr(p.amount)}</td>
                  <td className="py-1.5">{METHODS.find((m) => m.value === p.method)?.label ?? p.method}</td>
                  <td className="py-1.5">{p.reference ?? '—'}</td>
                  <td className="py-1.5">{p.recordedByName ?? '—'}</td>
                  <td className="py-1.5">{p.invoiceNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Tile({ label, value, good, warn }: { label: string; value: string; good?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-100 p-2.5">
      <dt className="text-[10px] uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className={`mt-0.5 text-sm font-semibold tabular-nums ${warn ? 'text-amber-700' : good ? 'text-emerald-700' : 'text-gray-900'}`}>{value}</dd>
    </div>
  );
}

function PaymentForm({ money, onSubmit, onCancel }: { money: AgreementMoneyView; onSubmit: (input: RecordPaymentInput) => Promise<void>; onCancel: () => void }) {
  const [amount, setAmount] = useState(String(money.remaining > 0 ? money.remaining : money.outstanding));
  const [method, setMethod] = useState('UPI');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState('');
  const [key] = useState(newKey); // one key per open form: a double click records the payment once
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = Number(amount.replace(/,/g, ''));
  const valid = Number.isInteger(value) && value > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !valid) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ amount: value, method, reference: reference.trim() || undefined, paidAt: isoFromDateInput(date) ?? undefined, idempotencyKey: key });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the payment');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-dashed border-gray-300 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <label className="grid gap-1 text-xs text-gray-500">Amount received ₹
          <input aria-label="Amount received" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
        </label>
        <label className="grid gap-1 text-xs text-gray-500">How it was received
          <select aria-label="How it was received" value={method} onChange={(e) => setMethod(e.target.value)} className={field}>{METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
        </label>
        <label className="grid gap-1 text-xs text-gray-500">Reference / UTR <span className="text-gray-400">(optional)</span>
          <input aria-label="Reference or UTR" value={reference} onChange={(e) => setReference(e.target.value)} className={field} />
        </label>
        <label className="grid gap-1 text-xs text-gray-500">Date received <span className="text-gray-400">(today if blank)</span>
          <input type="date" aria-label="Date received" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
      </div>
      <p className="text-xs text-gray-500">
        {money.confirmationPercent}% is the minimum to confirm the booking, not a maximum — a larger payment is fine (the part above {inr(money.confirmationAmount)} goes to the balance invoice).
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy || !valid} className="min-h-10 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save payment'}</button>
        <button type="button" disabled={busy} onClick={onCancel} className="min-h-10 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100">Cancel</button>
        {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
      </div>
    </form>
  );
}
