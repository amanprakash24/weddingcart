'use client';

import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceQuotation } from './types';

// Confirming chosen services of a sent quotation (money design v1, PR 8a). Each confirmation (CNF-…) has its own 25% to confirm it,
// its own invoices and its own payments; the other services stay on the quotation for later. The server works out every figure.

interface Confirmation {
  id: string;
  number: string;
  status: 'CONFIRMED' | 'CANCELLED';
  channel: string;
  confirmedAt: string;
  total: number;
  advance: number;
  lines: { quotationItemId: string; description: string; functionLabel: string | null; quantity: number; total: number }[];
  money: { received: number; outstanding: number; remaining: number; stateLabel: string; state: string };
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const CHANNELS = [
  { id: 'CALL', label: 'On a call' },
  { id: 'WHATSAPP', label: 'On WhatsApp' },
  { id: 'IN_PERSON', label: 'In person' },
];
const METHODS = [
  { id: 'UPI', label: 'UPI' },
  { id: 'BANK_TRANSFER', label: 'Bank transfer' },
  { id: 'CASH', label: 'Cash' },
  { id: 'CHEQUE', label: 'Cheque' },
];
const field = 'min-h-10 w-full rounded-lg border border-gray-300 px-2.5 text-sm';

async function send(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not save. Please try again.');
  return json.data;
}

export default function ConfirmationsBox({ quotation, readOnly, onChanged }: { quotation: WorkspaceQuotation; readOnly: boolean; onChanged: () => void }) {
  const [list, setList] = useState<Confirmation[] | null>(null);
  const [picking, setPicking] = useState<{ itemIds: string[]; channel: string } | null>(null);
  const [paying, setPaying] = useState<{ id: string; amount: string; method: string; reference: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/quotations/${quotation.id}/confirmations`, { cache: 'no-store' });
    const json = await res.json().catch(() => null);
    setList(res.ok && json?.success ? json.data : []);
  }, [quotation.id]);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const live = (list ?? []).filter((c) => c.status === 'CONFIRMED');
  const confirmedIds = new Set(live.flatMap((c) => c.lines.map((l) => l.quotationItemId)));
  const open = quotation.items.filter((i) => !confirmedIds.has(i.id));
  // Only a sent quotation that is not being booked as a whole can have services confirmed one by one.
  const canConfirm = !readOnly && quotation.status === 'SENT' && !quotation.booking && !quotation.advanceInvoice && open.length > 0;
  if (!list || (list.length === 0 && !canConfirm)) return null;

  const run = async (fn: () => Promise<unknown>, done: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      done();
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={`confirmations-${quotation.id}`} className="grid gap-2 rounded-xl border border-gray-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`confirmations-${quotation.id}`} className="text-sm font-bold text-gray-900">Confirmed services</h3>
        {canConfirm && !picking && (
          <button type="button" onClick={() => { setError(null); setPicking({ itemIds: [], channel: 'CALL' }); }} className="min-h-10 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50">
            Confirm services
          </button>
        )}
      </div>
      {list.length === 0 && !picking && <p className="text-xs text-gray-600">The couple can confirm some services now and the rest later. Each confirmation gets its own 25% to confirm it and its own invoices.</p>}

      {picking && (
        <form onSubmit={(e) => { e.preventDefault(); void run(() => send(`/api/quotations/${quotation.id}/confirmations`, picking), () => setPicking(null)); }} className="grid gap-2 rounded-lg bg-gray-50 p-2">
          <p className="text-xs text-gray-700">Tick the services the couple confirmed. Their price, share of the discount and GST are taken from this quotation and frozen.</p>
          <ul className="grid gap-1">
            {open.map((i) => (
              <li key={i.id}>
                <label className="flex min-h-10 items-center gap-2 text-sm text-gray-800">
                  <input type="checkbox" checked={picking.itemIds.includes(i.id)} onChange={(e) => setPicking({ ...picking, itemIds: e.target.checked ? [...picking.itemIds, i.id] : picking.itemIds.filter((x) => x !== i.id) })} className="h-5 w-5" />
                  <span className="flex-1">{i.description}{i.functionLabel ? <span className="text-gray-500"> · {i.functionLabel}</span> : null}</span>
                  <span className="tabular-nums text-gray-600">{inr(i.lineTotal)}</span>
                </label>
              </li>
            ))}
          </ul>
          <label className="grid gap-1 text-xs text-gray-600 sm:max-w-xs">How did they confirm?
            <select aria-label="How the couple confirmed" value={picking.channel} onChange={(e) => setPicking({ ...picking, channel: e.target.value })} className={field}>
              {CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={busy || picking.itemIds.length === 0} className="min-h-10 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Confirming…' : `Confirm ${picking.itemIds.length || ''} service${picking.itemIds.length === 1 ? '' : 's'}`}</button>
            <button type="button" onClick={() => setPicking(null)} className="min-h-10 px-2 text-sm text-gray-600">Cancel</button>
          </div>
        </form>
      )}

      {list.map((c) => (
        <article key={c.id} className={`grid gap-1 rounded-lg border p-2.5 text-sm ${c.status === 'CANCELLED' ? 'border-gray-100 bg-gray-50 opacity-70' : 'border-gray-100'}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <b className="text-gray-900">{c.number}</b>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">{c.status === 'CANCELLED' ? 'Cancelled' : c.money.stateLabel}</span>
          </div>
          <p className="text-xs text-gray-600">{c.lines.map((l) => l.description).join(' · ')}</p>
          <p className="text-xs text-gray-700">
            Total {inr(c.total)} · to confirm {inr(c.advance)} · received {inr(c.money.received)} · <span className={c.money.outstanding > 0 ? 'text-amber-700' : ''}>left {inr(c.money.outstanding)}</span>
            {c.money.remaining > 0 && <> · <b>{inr(c.money.remaining)} more confirms it</b></>}
          </p>
          {!readOnly && c.status === 'CONFIRMED' && c.money.outstanding > 0 && paying?.id !== c.id && (
            <button type="button" onClick={() => { setError(null); setPaying({ id: c.id, amount: String(c.money.remaining || c.money.outstanding), method: 'UPI', reference: '' }); }} className="justify-self-start text-xs font-semibold text-emerald-700 hover:underline">+ Record payment</button>
          )}
          {paying?.id === c.id && (
            <form onSubmit={(e) => { e.preventDefault(); void run(() => send(`/api/quotations/${quotation.id}/confirmations/${c.id}/payments`, { amount: Number(paying.amount.replace(/[,\s₹]/g, '')), method: paying.method, reference: paying.reference || undefined, idempotencyKey: `${c.id}-${Date.now()}` }), () => setPaying(null)); }} className="mt-1 grid gap-2 rounded-lg bg-gray-50 p-2 sm:grid-cols-3">
              <label className="grid gap-1 text-xs text-gray-600">Amount ₹
                <input aria-label="Amount received" inputMode="numeric" value={paying.amount} onChange={(e) => setPaying({ ...paying, amount: e.target.value })} className={field} />
              </label>
              <label className="grid gap-1 text-xs text-gray-600">How
                <select aria-label="How it was paid" value={paying.method} onChange={(e) => setPaying({ ...paying, method: e.target.value })} className={field}>
                  {METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-gray-600">Reference (UTR, cheque no.)
                <input aria-label="Payment reference" value={paying.reference} maxLength={120} onChange={(e) => setPaying({ ...paying, reference: e.target.value })} className={field} />
              </label>
              <div className="flex gap-2 sm:col-span-3">
                <button type="submit" disabled={busy} className="min-h-10 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save payment'}</button>
                <button type="button" onClick={() => setPaying(null)} className="min-h-10 px-2 text-sm text-gray-600">Cancel</button>
              </div>
            </form>
          )}
        </article>
      ))}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </section>
  );
}
