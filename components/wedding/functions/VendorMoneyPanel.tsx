'use client';

import { useCallback, useEffect, useState } from 'react';
import type { VendorGroup, WorkView } from '@/services/vendorPayment.service';
import type { MoneyTotals } from '@/lib/vendor/vendorMoney';
import { PAYMENT_METHODS, WORK_STATUS_WORDS, checkPayment, type WorkStatus } from '@/lib/vendor/vendorMoney';
import { useWorkspaceMoney } from '@/components/wedding/workspace/MoneyContext';

// The wedding's vendors, money first (25 Nov 2026): for each vendor the work value, Shaadi Shopping's commission (founder only),
// what they get, what has been paid, what is left, and how far the work is — and every payment, recorded one by one. Numbers come
// from lib/vendor/vendorMoney.ts, the same calculation the vendor sees on their own Payments screen.

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const amountOrDash = (n: number | null) => (n === null ? '—' : inr(n));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const day = (ymd: string) => (ymd ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${ymd}T00:00:00Z`)) : '—');
const STATUS_TONE: Record<WorkStatus, string> = {
  AWAITING_VENDOR: 'bg-amber-50 text-amber-800',
  NOT_STARTED: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-50 text-blue-800',
  COMPLETED: 'bg-emerald-50 text-emerald-800',
  DECLINED: 'bg-red-50 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};
const field = 'min-h-10 w-full rounded-lg border border-gray-300 px-2.5 text-sm';

export default function VendorMoneyPanel({ weddingId, refreshKey = 0 }: { weddingId: string; refreshKey?: number }) {
  const { vendorMoney, commission } = useWorkspaceMoney();
  const [data, setData] = useState<{ vendors: VendorGroup[]; totals: MoneyTotals } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [showEnded, setShowEnded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/weddings/${weddingId}/vendor-money`, { cache: 'no-store' });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success) setData(json.data);
    else setError(json?.error || 'Could not load the vendors’ money');
  }, [weddingId]);
  useEffect(() => {
    if (!vendorMoney) return;
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load, vendorMoney, refreshKey]);

  if (!vendorMoney) return null;
  if (error) return <section className="rounded-2xl border border-gray-100 bg-white p-5 text-sm text-red-700">{error}</section>;
  if (!data) return <section className="rounded-2xl border border-gray-100 bg-white p-5 text-sm text-gray-500">Loading vendors’ money…</section>;
  if (data.vendors.length === 0) return null;
  const t = data.totals;

  return (
    <section aria-labelledby="vendor-money" className="rounded-2xl border border-gray-100 bg-white p-5">
      <h2 id="vendor-money" className="text-lg font-bold text-gray-900">Vendors — money and work</h2>
      <p className="mt-0.5 text-xs text-gray-500">What each vendor is owed for confirmed work, what has been paid and what is left. Declined and cancelled work is not owed.</p>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Work value" value={inr(t.workValue)} />
        {commission && <Stat label="Our commission" value={amountOrDash(t.commission)} />}
        <Stat label="Vendors get" value={amountOrDash(t.net)} />
        <Stat label="Paid" value={inr(t.paid)} />
        <Stat label="Left to pay" value={amountOrDash(t.remaining)} strong />
      </dl>
      {t.awaitingVendorValue > 0 && <p className="mt-2 text-xs text-amber-800">{inr(t.awaitingVendorValue)} more is waiting for vendors to confirm — not owed until they do.</p>}

      {/* Phone: one card per vendor (the table below needs a wider screen) */}
      <ul className="mt-4 space-y-2 sm:hidden">
        {data.vendors.map((g) => (
          <li key={g.vendorId}>
            <button type="button" onClick={() => setOpen(open === g.vendorId ? null : g.vendorId)} aria-expanded={open === g.vendorId} className="w-full rounded-xl border border-gray-200 p-3 text-left">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-gray-900">{g.vendorName}</span>
                <span className="text-xs text-gray-500">{g.totals.completed} of {g.totals.works} done</span>
              </span>
              <span className="mt-1 grid grid-cols-3 gap-1 text-xs text-gray-600">
                <span>Work <b className="block text-sm text-gray-900">{inr(g.totals.workValue)}</b></span>
                <span>Paid <b className="block text-sm text-gray-900">{inr(g.totals.paid)}</b></span>
                <span>Left <b className={`block text-sm ${(g.totals.remaining ?? 0) < 0 ? 'text-red-700' : 'text-gray-900'}`}>{amountOrDash(g.totals.remaining)}</b></span>
              </span>
              <span className="mt-1 block text-xs text-gray-500">They get {amountOrDash(g.totals.net)}{commission && g.totals.commission !== null ? ` after ${inr(g.totals.commission)} commission` : ''} · tap for each work</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="pb-2 font-medium">Vendor</th>
              <th className="pb-2 text-right font-medium">Work value</th>
              {commission && <th className="pb-2 text-right font-medium">Commission</th>}
              <th className="pb-2 text-right font-medium">They get</th>
              <th className="pb-2 text-right font-medium">Paid</th>
              <th className="pb-2 text-right font-medium">Left</th>
              <th className="pb-2 pl-3 font-medium">Work</th>
            </tr>
          </thead>
          <tbody>
            {data.vendors.map((g) => (
              <tr key={g.vendorId} className="border-t border-gray-100 align-top">
                <td className="py-2">
                  <button type="button" onClick={() => setOpen(open === g.vendorId ? null : g.vendorId)} aria-expanded={open === g.vendorId} className="text-left font-semibold text-gray-900 underline-offset-2 hover:underline">
                    {g.vendorName}
                  </button>
                  <p className="text-xs text-gray-500">{g.category}</p>
                </td>
                <td className="py-2 text-right tabular-nums">{inr(g.totals.workValue)}</td>
                {commission && <td className="py-2 text-right tabular-nums text-gray-600">{amountOrDash(g.totals.commission)}</td>}
                <td className="py-2 text-right tabular-nums">{amountOrDash(g.totals.net)}</td>
                <td className="py-2 text-right tabular-nums">{inr(g.totals.paid)}</td>
                <td className={`py-2 text-right font-semibold tabular-nums ${(g.totals.remaining ?? 0) < 0 ? 'text-red-700' : ''}`}>{amountOrDash(g.totals.remaining)}</td>
                <td className="py-2 pl-3 text-xs text-gray-600">{g.totals.completed} of {g.totals.works} completed</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.vendors.some((g) => g.totals.net === null) && <p className="mt-2 text-xs text-amber-800">“—”: no commission rate is set up for that vendor’s category, so what they get is not known yet.</p>}

      {data.vendors.filter((g) => g.vendorId === open).map((g) => {
        // Declined / cancelled work with no money on it is history: folded, one tap away. Anything paid stays in view.
        const ended = g.works.filter((w) => !w.money.owed && w.money.workStatus !== 'AWAITING_VENDOR' && w.money.paid === 0);
        const shown = g.works.filter((w) => !ended.includes(w));
        return (
          <div key={g.vendorId} className="mt-4 space-y-3 rounded-xl border border-gray-200 p-3">
            <h3 className="font-semibold text-gray-900">{g.vendorName} — each work</h3>
            {shown.map((w) => <WorkRow key={w.id} weddingId={weddingId} work={w} showCommission={commission} onChanged={load} />)}
            {ended.length > 0 && !showEnded && (
              <button type="button" onClick={() => setShowEnded(true)} className="min-h-10 text-sm font-semibold text-gray-600 underline">
                Show {ended.length} cancelled or declined {ended.length === 1 ? 'work' : 'works'} (₹{ended.reduce((s, w) => s + w.agreedPrice, 0).toLocaleString('en-IN')} agreed, not owed)
              </button>
            )}
            {showEnded && ended.map((w) => <WorkRow key={w.id} weddingId={weddingId} work={w} showCommission={commission} onChanged={load} />)}
          </div>
        );
      })}
    </section>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-2.5">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={`text-base tabular-nums ${strong ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>{value}</dd>
    </div>
  );
}

function WorkRow({ weddingId, work: w, showCommission, onChanged }: { weddingId: string; work: WorkView; showCommission: boolean; onChanged: () => Promise<void> }) {
  const [form, setForm] = useState<{ amount: string; paidOn: string; method: string; reference: string; note: string } | null>(null);
  const [voiding, setVoiding] = useState<{ id: string; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const m = w.money;

  const send = async (url: string, method: string, body: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not save. Please try again.');
      await onChanged();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const record = async () => {
    if (!form) return;
    const c = checkPayment(form, m.remaining, today());
    if (!c.ok) return setError(c.error);
    if (await send(`/api/weddings/${weddingId}/vendor-bookings/${w.id}/payments`, 'POST', form)) setForm(null);
  };

  return (
    <div className="rounded-lg border border-gray-100 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{w.functionName} <span className="font-normal text-gray-500">· {new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(w.functionDate))}</span></p>
          <p className="text-xs text-gray-600">
            Agreed {inr(w.agreedPrice)}
            {m.owed && showCommission && m.commission !== null && ` · commission ${inr(m.commission)} (${m.commissionRate}%${m.commissionIsEstimate ? ', current rate' : ''})`}
            {m.owed && ` · they get ${amountOrDash(m.net)} · paid ${inr(m.paid)} · left ${amountOrDash(m.remaining)}`}
            {!m.owed && m.paid > 0 && ` · paid ${inr(m.paid)} although not owed`}
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[m.workStatus]}`}>{WORK_STATUS_WORDS[m.workStatus]}</span>
      </div>

      {w.payments.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {w.payments.map((p) => (
            <li key={p.id} className={`flex flex-wrap items-center gap-x-2 ${p.voided ? 'text-gray-400' : 'text-gray-700'}`}>
              <span className={p.voided ? 'line-through' : 'font-medium'}>{inr(p.amount)}</span>
              <span>{day(p.paidOn)} · {p.methodLabel}{p.reference ? ` · ref ${p.reference}` : ''}{p.note ? ` · ${p.note}` : ''}</span>
              {p.voided && <span>· voided: {p.voidReason}</span>}
              {!p.voided && !p.legacyPayout && voiding?.id !== p.id && (
                <button type="button" onClick={() => { setError(null); setVoiding({ id: p.id, reason: '' }); }} className="min-h-8 px-1 text-gray-500 underline">Void</button>
              )}
              {voiding?.id === p.id && (
                <span className="flex w-full flex-wrap gap-1.5 pt-1">
                  <input aria-label="Why is this entry wrong?" value={voiding.reason} onChange={(e) => setVoiding({ ...voiding, reason: e.target.value })} placeholder="Why is this entry wrong?" className={`${field} max-w-xs`} />
                  <button type="button" disabled={busy} onClick={() => void send(`/api/weddings/${weddingId}/vendor-payments/${p.id}`, 'PATCH', { void: true, reason: voiding.reason }).then((ok) => ok && setVoiding(null))} className="min-h-10 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white disabled:opacity-40">Void entry</button>
                  <button type="button" onClick={() => setVoiding(null)} className="min-h-10 px-2 text-sm text-gray-600">Keep</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {w.legacyPayoutPending && <p className="mt-2 text-xs text-amber-800">An earlier payout for this work is waiting to be marked paid (in the function’s vendor card).</p>}

      {w.canRecord && !w.legacyPayoutPending && !form && (
        <button type="button" onClick={() => { setError(null); setForm({ amount: '', paidOn: today(), method: 'UPI', reference: '', note: '' }); }} className="mt-2 min-h-10 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50">Record payment</button>
      )}
      {form && (
        <form onSubmit={(e) => { e.preventDefault(); void record(); }} className="mt-2 grid gap-2 sm:grid-cols-3">
          <label className="grid gap-1 text-xs text-gray-600">Amount ₹ (left {amountOrDash(m.remaining)})
            <input aria-label="Amount paid" inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={field} />
          </label>
          <label className="grid gap-1 text-xs text-gray-600">Paid on
            <input aria-label="Paid on" type="date" max={today()} value={form.paidOn} onChange={(e) => setForm({ ...form, paidOn: e.target.value })} className={field} />
          </label>
          <label className="grid gap-1 text-xs text-gray-600">How
            <select aria-label="How it was paid" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className={field}>
              {PAYMENT_METHODS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-gray-600">Reference (UTR, cheque no.)
            <input aria-label="Reference" value={form.reference} maxLength={100} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={field} />
          </label>
          <label className="grid gap-1 text-xs text-gray-600 sm:col-span-2">Note
            <input aria-label="Note" value={form.note} maxLength={300} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Advance for Haldi decoration" className={field} />
          </label>
          <div className="flex gap-2 sm:col-span-3">
            <button type="submit" disabled={busy} className="min-h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save payment'}</button>
            <button type="button" onClick={() => { setForm(null); setError(null); }} className="min-h-10 px-3 text-sm text-gray-600">Cancel</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
