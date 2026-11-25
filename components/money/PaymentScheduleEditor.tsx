'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { validateSchedule, MAX_INSTALMENTS } from '@/lib/money/schedule';
import type { PaymentScheduleView } from '@/services/paymentSchedule.service';

// Payment schedule (22 Nov 2026) — on the staff money card. The balance after the booking amount is split into dated instalments.
// The total must match the balance to the rupee before it can be saved (checked here as you type, and again by the server).
// The couple sees the same instalments on My Wedding, with what is paid of each.

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const dateWords = (ymd: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${ymd}T00:00:00Z`));
const field = 'min-h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm';
const STATUS = {
  PAID: ['Paid', 'bg-emerald-100 text-emerald-800'],
  PART_PAID: ['Part paid', 'bg-amber-100 text-amber-800'],
  DUE: ['Due', 'bg-gray-100 text-gray-700'],
  OVERDUE: ['Overdue', 'bg-red-100 text-red-800'],
} as const;

interface Row { label: string; amount: string; dueDate: string }

export default function PaymentScheduleEditor({ quotationId, refreshKey }: { quotationId: string; refreshKey?: unknown }) {
  const [view, setView] = useState<PaymentScheduleView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null); // null = not editing
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/quotations/${quotationId}/schedule`);
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) throw new Error(body?.error || 'Could not load the payment schedule');
      setView(body.data);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load the payment schedule');
    }
  }, [quotationId]);

  // Deferred like the other money panels (react-hooks/set-state-in-effect); re-read when money arrives (refreshKey).
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load, refreshKey]);

  if (loadError) return <p role="alert" className="mt-4 text-sm text-red-600">{loadError}</p>;
  if (!view || !view.exists || view.balance === 0) return null;

  const startEditing = () => {
    setNotice(null);
    setError(null);
    setRows(view.instalments.length > 0 ? view.instalments.map((i) => ({ label: i.label, amount: String(i.amount), dueDate: i.dueDate })) : [{ label: 'Balance', amount: String(view.balance), dueDate: '' }]);
  };

  const parsed = (rows ?? []).map((r) => ({ label: r.label, amount: Number(r.amount.replace(/[,\s₹]/g, '')), dueDate: r.dueDate }));
  const scheduled = parsed.reduce((s, r) => s + (Number.isInteger(r.amount) ? r.amount : 0), 0);
  const left = view.balance - scheduled;
  const problems = rows ? validateSchedule(parsed, view.balance) : [];

  const save = async () => {
    if (busy || !rows) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotations/${quotationId}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instalments: parsed, expectedVersion: view.version }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        if (res.status === 409) await load(); // someone else saved first: show theirs, keep this form open with the message
        throw new Error(body?.error || 'Could not save the schedule');
      }
      setView(body.data);
      setRows(null);
      setNotice(parsed.length > 0 ? 'Payment schedule saved. The couple sees it on My Wedding.' : 'Payment schedule cleared.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the schedule');
    } finally {
      setBusy(false);
    }
  };

  const setRow = (i: number, patch: Partial<Row>) => setRows((cur) => (cur ? cur.map((r, j) => (j === i ? { ...r, ...patch } : r)) : cur));

  return (
    <div className="mt-4 rounded-xl border border-gray-100 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900"><CalendarClock className="h-4 w-4 text-gray-500" aria-hidden />Payment schedule</h3>
        {!rows && (
          <button type="button" onClick={startEditing} className="min-h-10 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
            {view.instalments.length > 0 ? 'Change schedule' : 'Set payment dates'}
          </button>
        )}
      </div>

      {!rows && (
        <>
          {view.instalments.length > 0 && view.instalments.reduce((s, i) => s + i.amount, 0) !== view.balance && (
            <p role="alert" className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
              The balance is now {inr(view.balance)} (a credit note changed it) but these dates add up to {inr(view.instalments.reduce((s, i) => s + i.amount, 0))}. Press Set payment dates to fix them.
            </p>
          )}
          {view.instalments.length === 0 ? (
            <p className="mt-2 text-sm text-amber-800">No dates set for the balance of {inr(view.balance)}. The couple is told “dates will be shared by your expert”.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-gray-400"><tr><th className="pb-1.5 font-medium">Step</th><th className="pb-1.5 font-medium">Due by</th><th className="pb-1.5 text-right font-medium">Amount</th><th className="pb-1.5 text-right font-medium">Paid</th><th className="pb-1.5 pl-3 font-medium">Status</th></tr></thead>
                <tbody>
                  {view.steps.map((s, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-1.5">{s.label}</td>
                      <td className="py-1.5 text-gray-600">{s.dueDate ? dateWords(s.dueDate) : '—'}</td>
                      <td className="py-1.5 text-right tabular-nums">{inr(s.amount)}</td>
                      <td className="py-1.5 text-right tabular-nums">{inr(s.paid)}</td>
                      <td className="py-1.5 pl-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[s.status][1]}`}>{STATUS[s.status][0]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {notice && <p role="status" className="mt-2 text-sm text-emerald-700">{notice}</p>}
        </>
      )}

      {rows && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-gray-500">
            Split the balance of <b>{inr(view.balance)}</b> (after the booking amount of {inr(view.confirmationAmount)}) into dated instalments. They must add up to the balance exactly.
          </p>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-lg bg-gray-50 p-2 sm:grid-cols-[minmax(0,1fr)_140px_160px_auto] sm:items-end">
              <label className="grid gap-1 text-xs text-gray-500">Name
                <input aria-label={`Instalment ${i + 1} name`} value={r.label} maxLength={60} onChange={(e) => setRow(i, { label: e.target.value })} placeholder="e.g. Before the wedding" className={field} />
              </label>
              <label className="grid gap-1 text-xs text-gray-500">Amount ₹
                <input aria-label={`Instalment ${i + 1} amount`} inputMode="numeric" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} className={field} />
              </label>
              <label className="grid gap-1 text-xs text-gray-500">Due by
                <input aria-label={`Instalment ${i + 1} due date`} type="date" value={r.dueDate} onChange={(e) => setRow(i, { dueDate: e.target.value })} className={field} />
              </label>
              <button type="button" aria-label={`Remove instalment ${i + 1}`} onClick={() => setRows((cur) => (cur ? cur.filter((_, j) => j !== i) : cur))} className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200"><Trash2 className="h-4 w-4" aria-hidden /></button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            {rows.length < MAX_INSTALMENTS && (
              <button type="button" onClick={() => setRows((cur) => [...(cur ?? []), { label: '', amount: left > 0 ? String(left) : '', dueDate: '' }])} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-700"><Plus className="h-4 w-4" aria-hidden />Add instalment</button>
            )}
            <p role="status" className={`text-sm font-semibold ${left === 0 ? 'text-emerald-700' : 'text-amber-800'}`}>
              Scheduled {inr(scheduled)} of {inr(view.balance)} · {left === 0 ? 'matches the balance' : left > 0 ? `${inr(left)} still to schedule` : `${inr(-left)} too much`}
            </p>
          </div>
          {problems.length > 0 && rows.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-amber-800">{problems.filter((p) => p.code !== 'SUM').map((p, i) => <li key={i}>{p.message}</li>)}</ul>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" disabled={busy || problems.length > 0} onClick={save} className="min-h-10 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              {busy ? 'Saving…' : rows.length === 0 ? 'Clear schedule' : 'Save schedule'}
            </button>
            <button type="button" disabled={busy} onClick={() => { setRows(null); setError(null); }} className="min-h-10 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100">Cancel</button>
            {error && <span role="alert" className="text-sm text-red-600">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
