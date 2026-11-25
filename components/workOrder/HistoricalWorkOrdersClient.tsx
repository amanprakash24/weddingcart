'use client';

import { useCallback, useEffect, useState } from 'react';
import type { HistoricalRow } from '@/services/vendorWorkOrder.service';

// The founder's preview of work orders for assignments confirmed before work orders existed (money design v1, PR 5, 25 Nov 2026).
// Read-only until the founder ticks rows and confirms; then exactly those are issued, marked historical, at the amounts shown — the
// server refuses if any amount changed since this page loaded. Existing values are never changed.

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const orDash = (n: number | null) => (n === null ? '—' : inr(n));
const day = (ymd: string) => (ymd ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');

function toCsv(rows: HistoricalRow[]): string {
  const head = ['Wedding ID', 'Vendor', 'Confirmed service', 'Function', 'Date', 'Status', 'Original agreed value', 'Pricing', 'Commission rate %', 'Proposed work order value', 'Amount already paid', 'Remaining payable', 'Can issue', 'Why not'];
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [head, ...rows.map((r) => [r.weddingNumber, r.vendorName, r.service, r.functionName, r.functionDate, r.status, r.agreedValue, r.modelIsDefault ? 'Commission (as before)' : r.pricingModel === 'FIXED' ? 'Fixed' : 'Commission', r.commissionRate ?? '', r.proposedPayable ?? '', r.paid, r.remaining ?? '', r.canIssue ? 'yes' : 'no', r.reason ?? ''])].map((line) => line.map(q).join(',')).join('\n');
}

export default function HistoricalWorkOrdersClient() {
  const [rows, setRows] = useState<HistoricalRow[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch('/api/admin/work-orders/historical', { cache: 'no-store' });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success) {
      setRows(json.data);
      setPicked([]);
    } else setError(json?.error || 'Could not load the preview');
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const chosen = (rows ?? []).filter((r) => picked.includes(r.vendorBookingId));
  const total = chosen.reduce((s, r) => s + (r.proposedPayable ?? 0), 0);

  const issue = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/work-orders/historical', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: chosen.map((r) => ({ vendorBookingId: r.vendorBookingId, expectedPayable: r.proposedPayable })) }) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not issue the work orders');
      setDone(`Issued ${(json.data as { number: string }[]).map((x) => x.number).join(', ')}.`);
      setConfirming(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not issue the work orders');
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!rows) return;
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `work-order-preview-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Work orders for earlier confirmations</h1>
          <p className="max-w-2xl text-sm text-gray-600">Assignments confirmed before work orders existed. Nothing is issued until you tick rows and confirm. Each is issued at exactly the value shown, marked as issued later; no existing value changes.</p>
        </div>
        <button type="button" onClick={download} disabled={!rows?.length} className="min-h-10 rounded-lg border border-gray-300 px-3 text-sm font-semibold disabled:opacity-40">Download CSV</button>
      </header>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {done && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{done}</p>}
      {!rows && !error && <p className="text-sm text-gray-500">Loading…</p>}
      {rows && rows.length === 0 && <p className="rounded-xl bg-white p-4 text-sm text-gray-700">Every confirmed assignment has a work order.</p>}

      {rows && rows.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="p-3"><span className="sr-only">Issue</span></th>
                  <th className="p-3 font-medium">Wedding</th>
                  <th className="p-3 font-medium">Vendor</th>
                  <th className="p-3 font-medium">Confirmed service</th>
                  <th className="p-3 text-right font-medium">Original agreed</th>
                  <th className="p-3 font-medium">Pricing</th>
                  <th className="p-3 text-right font-medium">Work order value</th>
                  <th className="p-3 text-right font-medium">Already paid</th>
                  <th className="p-3 text-right font-medium">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.vendorBookingId} className="border-t border-gray-100 align-top">
                    <td className="p-3">
                      <input type="checkbox" aria-label={`Issue a work order for ${r.vendorName}, ${r.functionName}`} disabled={!r.canIssue} checked={picked.includes(r.vendorBookingId)} onChange={(e) => setPicked(e.target.checked ? [...picked, r.vendorBookingId] : picked.filter((x) => x !== r.vendorBookingId))} className="h-5 w-5" />
                    </td>
                    <td className="p-3 font-medium text-gray-900">{r.weddingNumber}</td>
                    <td className="p-3">{r.vendorName}<p className="text-xs text-gray-500">{r.status === 'COMPLETED' ? 'Completed' : 'Confirmed'}</p></td>
                    <td className="p-3">{r.service} · {r.functionName}<p className="text-xs text-gray-500">{day(r.functionDate)}</p></td>
                    <td className="p-3 text-right tabular-nums">{inr(r.agreedValue)}</td>
                    <td className="p-3 text-xs text-gray-600">{r.pricingModel === 'FIXED' ? 'Fixed' : `Commission${r.commissionRate !== null ? ` ${r.commissionRate}%` : ''}`}{r.modelIsDefault ? ' (as before)' : ''}</td>
                    <td className="p-3 text-right font-semibold tabular-nums">{orDash(r.proposedPayable)}{!r.canIssue && <p className="text-xs font-normal text-amber-800">{r.reason}</p>}</td>
                    <td className="p-3 text-right tabular-nums">{inr(r.paid)}</td>
                    <td className="p-3 text-right tabular-nums">{orDash(r.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4">
            {!confirming ? (
              <>
                <p className="text-sm text-gray-700">{chosen.length === 0 ? 'Tick the rows to issue.' : `${chosen.length} ticked · ${inr(total)} in work orders`}</p>
                <button type="button" disabled={chosen.length === 0} onClick={() => setConfirming(true)} className="min-h-10 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-40">Issue ticked work orders…</button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-900">Issue {chosen.length} work {chosen.length === 1 ? 'order' : 'orders'} ({inr(total)}) to the vendors, marked as issued later? They cannot be changed afterwards — only cancelled.</p>
                <button type="button" disabled={busy} onClick={() => void issue()} className="min-h-10 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Issuing…' : 'Yes, issue them'}</button>
                <button type="button" onClick={() => setConfirming(false)} className="min-h-10 px-2 text-sm text-gray-600">Back</button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
