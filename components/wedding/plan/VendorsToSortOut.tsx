'use client';

import { useState } from 'react';
import { AlertTriangle, CircleDashed } from 'lucide-react';
import type { VendorRow } from '@/lib/wedding/controlRoom';
import VendorPicker, { type VendorHit } from './VendorPicker';

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const btn = 'min-h-9 rounded-lg px-3 py-1.5 text-sm font-medium';

export interface AssignInput {
  weddingEventId: string;
  vendorId: string;
  agreedPrice: number;
  resolvesTaskId: string;
}

// Vendor work, done here: a vendor who has not answered gets Confirm / Decline; a quoted service nobody is booked for gets a vendor. The
// "Confirm booking…" / "Assign a vendor…" tasks this replaces close themselves when the action is done.
export default function VendorsToSortOut({
  rows, onConfirm, onDecline, onAssign, onRemove,
}: {
  rows: VendorRow[];
  onConfirm: (vendorBookingId: string) => Promise<void>;
  onDecline: (vendorBookingId: string, reason: string) => Promise<void>;
  onAssign: (input: AssignInput) => Promise<void>;
  onRemove?: (taskId: string) => Promise<void>;
}) {
  const work = rows.filter((r) => r.state === 'pending' || r.state === 'unassigned');
  if (work.length === 0) return null;
  return (
    <section aria-label="Vendors to sort out" className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 sm:p-5">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-amber-800">Vendors to sort out · {work.length}</h2>
      <ul className="mt-3 grid grid-cols-1 gap-2">
        {work.map((row) => (
          <li key={row.key} className="rounded-xl border border-amber-100 bg-white p-3">
            {row.state === 'pending' ? <PendingRow row={row} onConfirm={onConfirm} onDecline={onDecline} /> : <UnassignedRow row={row} onAssign={onAssign} onRemove={onRemove} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work');
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

export function PendingRow({ row, onConfirm, onDecline }: { row: VendorRow; onConfirm: (id: string) => Promise<void>; onDecline: (id: string, reason: string) => Promise<void> }) {
  const { busy, error, run } = useAction();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const id = row.vendorBookingId as string;
  return (
    <div>
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{row.name}</p>
          <p className="text-xs text-gray-500">{row.category}{row.functionName ? ` · ${row.functionName}` : ''} · waiting for their yes</p>
        </div>
      </div>
      {declining ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input aria-label="Why they declined" placeholder="Why did they decline?" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-9 min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
          <button type="button" disabled={busy} onClick={() => run(() => onDecline(id, reason.trim()))} className={`${btn} bg-red-600 text-white disabled:opacity-40`}>{busy ? 'Saving…' : 'Record decline'}</button>
          <button type="button" disabled={busy} onClick={() => setDeclining(false)} className={`${btn} text-gray-500 hover:bg-gray-100`}>Back</button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => run(() => onConfirm(id))} className={`${btn} bg-emerald-600 text-white disabled:opacity-40`}>{busy ? 'Saving…' : 'Confirmed'}</button>
          <button type="button" disabled={busy} onClick={() => setDeclining(true)} className={`${btn} border border-gray-200 text-gray-700 hover:bg-gray-50`}>They declined</button>
        </div>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function UnassignedRow({ row, onAssign, onRemove }: { row: VendorRow; onAssign: (input: AssignInput) => Promise<void>; onRemove?: (taskId: string) => Promise<void> }) {
  const { busy, error, run } = useAction();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [picked, setPicked] = useState<VendorHit | null>(null);
  const [price, setPrice] = useState(row.quotedPrice ? String(row.quotedPrice) : '');

  const amount = Number(price.replace(/,/g, ''));
  const ready = picked && Number.isInteger(amount) && amount > 0 && row.weddingEventId && row.taskId;

  return (
    <div>
      <div className="flex items-start gap-2">
        <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{row.name}</p>
          <p className="text-xs text-gray-500">{row.quotedPrice ? `Quoted at ${rupees(row.quotedPrice)}` : 'Quoted'} · nobody is booked for this yet</p>
        </div>
        {!open && !removing && <button type="button" onClick={() => setOpen(true)} className={`${btn} shrink-0 bg-gray-900 text-white`}>Assign vendor</button>}
      </div>
      {!open && !removing && onRemove && row.taskId && <button type="button" onClick={() => setRemoving(true)} className="mt-1 text-xs text-gray-500 underline">Remove this service</button>}
      {removing && onRemove && row.taskId && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
          <span className="text-gray-700">Drop {row.name} from the plan? It will no longer be waiting for a vendor.</span>
          <button type="button" disabled={busy} onClick={() => run(async () => { await onRemove(row.taskId as string); })} className={`${btn} bg-red-600 text-white disabled:opacity-40`}>{busy ? 'Saving…' : 'Remove service'}</button>
          <button type="button" disabled={busy} onClick={() => setRemoving(false)} className={`${btn} text-gray-500 hover:bg-gray-100`}>Keep it</button>
        </div>
      )}
      {open && (
        <div className="mt-2 grid grid-cols-1 gap-2">
          <VendorPicker picked={picked} onPick={setPicked} onClear={() => setPicked(null)} />
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-gray-500" htmlFor={`price-${row.key}`}>Agreed price ₹</label>
            <input id={`price-${row.key}`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className="min-h-9 w-32 rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
            <button
              type="button"
              disabled={busy || !ready}
              onClick={() => run(async () => { await onAssign({ weddingEventId: row.weddingEventId as string, vendorId: (picked as VendorHit).id, agreedPrice: amount, resolvesTaskId: row.taskId as string }); setOpen(false); })}
              className={`${btn} bg-emerald-600 text-white disabled:opacity-40`}
            >
              {busy ? 'Saving…' : 'Assign'}
            </button>
            <button type="button" disabled={busy} onClick={() => { setOpen(false); setPicked(null); }} className={`${btn} text-gray-500 hover:bg-gray-100`}>Cancel</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
