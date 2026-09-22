'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { WorkspaceWeddingEvent, VendorBookingStatus } from '@/components/wedding/workspace/types';
import { PAYOUT_STATUS_LABELS, PAYOUT_STATUS_COLORS } from '@/components/wedding/workspace/constants';
import { dateWords, functionLabel, type VendorRow } from '@/lib/wedding/controlRoom';
import { functionSpend } from '@/lib/wedding/functions';
import { UnassignedRow, useAction, type AssignInput } from '@/components/wedding/plan/VendorsToSortOut';
import VendorPicker, { type VendorHit } from '@/components/wedding/plan/VendorPicker';
import FunctionForm, { draftFromEvent, emptyDraft, type FunctionPayload } from './FunctionForm';

type Booking = WorkspaceWeddingEvent['vendorBookings'][number];

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const btn = 'min-h-9 rounded-lg px-3 py-1.5 text-sm font-medium';
const ghost = `${btn} border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40`;
const input = 'min-h-9 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm';

const STATUS_LABEL: Record<VendorBookingStatus, string> = {
  PENDING_VENDOR_CONFIRMATION: 'Waiting for their yes',
  CONFIRMED: 'Confirmed',
  DECLINED: 'Declined',
  CUSTOMER_APPROVAL_PENDING: 'Awaiting customer approval',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
};
const STATUS_TONE: Record<VendorBookingStatus, string> = {
  PENDING_VENDOR_CONFIRMATION: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-emerald-100 text-emerald-700',
  DECLINED: 'bg-red-100 text-red-700',
  CUSTOMER_APPROVAL_PENDING: 'bg-violet-100 text-violet-700',
  CANCELLED: 'bg-gray-200 text-gray-600',
  COMPLETED: 'bg-blue-100 text-blue-700',
};

export interface FunctionsHandlers {
  onAddFunction: (payload: FunctionPayload) => Promise<void>;
  onUpdateFunction: (functionId: string, payload: FunctionPayload) => Promise<void>;
  onDeleteFunction: (functionId: string) => Promise<void>;
  onConfirm: (vendorBookingId: string) => Promise<void>;
  onDecline: (vendorBookingId: string, reason: string) => Promise<void>;
  onComplete: (vendorBookingId: string, onTime: boolean) => Promise<void>;
  onCancelVendor: (vendorBookingId: string, reason: string) => Promise<void>;
  onReplaceVendor: (vendorBookingId: string, input: { vendorId: string; agreedPrice: number; reason: string }) => Promise<void>;
  onEditPrice: (vendorBookingId: string, agreedPrice: number) => Promise<void>;
  onAddService: (weddingEventId: string, vendorId: string, agreedPrice: number) => Promise<void>;
  onAssign: (input: AssignInput) => Promise<void>;
  onRemoveService: (taskId: string) => Promise<void>;
  onCalculatePayout: (vendorBookingId: string) => Promise<void>;
  onMarkPayoutPaid: (payoutId: string) => Promise<void>;
}

// The wedding's functions, each with its date, place, budget and the services (vendors) it needs — and the actions to run them:
// add / edit / delete a function; confirm, decline, complete, re-price, replace or cancel a vendor; assign one to a quoted service.
export default function FunctionsPanel({ events, unassigned, defaultCity, ...h }: { events: WorkspaceWeddingEvent[]; unassigned: VendorRow[]; defaultCity: string } & FunctionsHandlers) {
  const [adding, setAdding] = useState(false);
  return (
    <section aria-label="Functions" className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Functions & Services · {events.length}</h2>
        {!adding && <button type="button" onClick={() => setAdding(true)} className={`${btn} inline-flex items-center gap-1 bg-gray-900 text-white`}><Plus className="h-4 w-4" aria-hidden />Add function</button>}
      </div>
      {adding && (
        <div className="mt-3">
          <FunctionForm initial={emptyDraft(defaultCity)} submitLabel="Add function" onSubmit={async (p) => { await h.onAddFunction(p); setAdding(false); }} onCancel={() => setAdding(false)} />
        </div>
      )}
      {events.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No functions yet. Add the first one — the wedding day, or a Haldi or Mehndi before it.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4">
          {events.map((event) => (
            <FunctionCard key={event.id} event={event} unassigned={unassigned.filter((r) => r.weddingEventId === event.id)} {...h} />
          ))}
        </div>
      )}
    </section>
  );
}

function FunctionCard({ event, unassigned, ...h }: { event: WorkspaceWeddingEvent; unassigned: VendorRow[] } & FunctionsHandlers) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingService, setAddingService] = useState(false);
  const del = useAction();
  const active = event.vendorBookings.filter((b) => b.status !== 'CANCELLED');
  const cancelled = event.vendorBookings.filter((b) => b.status === 'CANCELLED');
  const spend = functionSpend(event.budget, event.vendorBookings);
  const place = [event.venueName, event.city].filter(Boolean).join(', ');

  return (
    <div className="rounded-xl border border-gray-100 p-3 sm:p-4">
      {editing ? (
        <FunctionForm initial={draftFromEvent(event)} submitLabel="Save function" onSubmit={async (p) => { await h.onUpdateFunction(event.id, p); setEditing(false); }} onCancel={() => setEditing(false)} />
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900">{functionLabel(event)}</h3>
            <p className="mt-0.5 text-xs text-gray-500">{[dateWords(event.date), event.startTime, place].filter(Boolean).join(' · ')}</p>
            {(event.budget !== null || spend.booked > 0) && (
              <p className="mt-0.5 text-xs text-gray-500">
                {event.budget !== null ? `Budget ${money(event.budget)} · ` : ''}Booked {money(spend.booked)}
                {spend.over > 0 && <span className="font-semibold text-amber-800"> · {money(spend.over)} over budget</span>}
              </p>
            )}
          </div>
          {!deleting && (
            <div className="flex shrink-0 gap-1">
              <button type="button" onClick={() => setEditing(true)} className={ghost}>Edit</button>
              <button type="button" onClick={() => setDeleting(true)} className={`${btn} text-gray-500 hover:bg-gray-100`}>Delete</button>
            </div>
          )}
        </div>
      )}

      {deleting && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
          <span className="text-gray-700">Delete {functionLabel(event)}? This cannot be undone.</span>
          <button type="button" disabled={del.busy} onClick={() => del.run(async () => { await h.onDeleteFunction(event.id); })} className={`${btn} bg-red-600 text-white disabled:opacity-40`}>{del.busy ? 'Deleting…' : 'Delete function'}</button>
          <button type="button" disabled={del.busy} onClick={() => setDeleting(false)} className={`${btn} text-gray-500 hover:bg-gray-100`}>Keep it</button>
          {del.error && <span role="alert" className="w-full text-xs text-red-600">{del.error}</span>}
        </div>
      )}

      {!editing && (
        <div className="mt-3 grid grid-cols-1 gap-2">
          {active.map((b) => <ServiceRow key={b.id} booking={b} {...h} />)}
          {unassigned.map((row) => (
            <div key={row.key} className="rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-3"><UnassignedRow row={row} onAssign={h.onAssign} onRemove={h.onRemoveService} /></div>
          ))}
          {active.length === 0 && unassigned.length === 0 && <p className="text-sm text-gray-500">No services for this function yet.</p>}
          {cancelled.length > 0 && <p className="text-xs text-gray-400">Cancelled: {cancelled.map((b) => b.vendorName).join(', ')}</p>}
          {addingService ? (
            <AddService onAdd={async (vendorId, price) => { await h.onAddService(event.id, vendorId, price); setAddingService(false); }} onCancel={() => setAddingService(false)} />
          ) : (
            <div><button type="button" onClick={() => setAddingService(true)} className={`${btn} inline-flex items-center gap-1 text-emerald-700 hover:bg-emerald-50`}><Plus className="h-4 w-4" aria-hidden />Add service</button></div>
          )}
        </div>
      )}
    </div>
  );
}

type Mode = 'idle' | 'declining' | 'completing' | 'cancelling' | 'replacing' | 'pricing';

function ServiceRow({ booking, ...h }: { booking: Booking } & FunctionsHandlers) {
  const [mode, setMode] = useState<Mode>('idle');
  const [reason, setReason] = useState('');
  const [price, setPrice] = useState(String(booking.agreedPrice));
  const [picked, setPicked] = useState<VendorHit | null>(null);
  const [newPrice, setNewPrice] = useState(String(booking.agreedPrice));
  const { busy, error, run } = useAction();
  const back = () => { setMode('idle'); setReason(''); setPicked(null); };
  const done = (fn: () => Promise<void>) => run(async () => { await fn(); back(); });
  const s = booking.status;
  const canChange = s === 'PENDING_VENDOR_CONFIRMATION' || s === 'CONFIRMED';
  const amount = (text: string) => Number(text.replace(/,/g, ''));
  const valid = (text: string) => Number.isInteger(amount(text)) && amount(text) > 0;

  const markPaid = () => {
    if (!booking.payout) return;
    if (!window.confirm('Confirm the bank/UPI transfer has been made manually?')) return;
    return run(async () => { await h.onMarkPayoutPaid((booking.payout as NonNullable<Booking['payout']>).id); });
  };

  return (
    <div className="rounded-xl border border-gray-100 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{booking.vendorName}</p>
          <p className="text-xs text-gray-500">{booking.vendorCategory} · {money(booking.agreedPrice)}</p>
          {s === 'DECLINED' && booking.declineReason && <p className="mt-0.5 text-xs text-red-600">{booking.declineReason}</p>}
          {booking.payout && <p className="mt-0.5 text-xs text-gray-400">Gross {money(booking.payout.grossAmount)} · Commission {money(booking.payout.commissionAmount)} ({booking.payout.commissionRate}%) · Net {money(booking.payout.netAmount)}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[s]}`}>{STATUS_LABEL[s]}</span>
          {booking.payout && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PAYOUT_STATUS_COLORS[booking.payout.status]}`}>{PAYOUT_STATUS_LABELS[booking.payout.status]}</span>}
        </div>
      </div>

      {mode === 'idle' && (
        <div className="mt-2 flex flex-wrap gap-2">
          {s === 'PENDING_VENDOR_CONFIRMATION' && (
            <>
              <button type="button" disabled={busy} onClick={() => run(() => h.onConfirm(booking.id))} className={`${btn} bg-emerald-600 text-white disabled:opacity-40`}>{busy ? 'Saving…' : 'Confirmed'}</button>
              <button type="button" disabled={busy} onClick={() => setMode('declining')} className={ghost}>They declined</button>
            </>
          )}
          {s === 'CONFIRMED' && <button type="button" disabled={busy} onClick={() => setMode('completing')} className={`${btn} bg-emerald-600 text-white disabled:opacity-40`}>Mark completed</button>}
          {s === 'COMPLETED' && !booking.payout && <button type="button" disabled={busy} onClick={() => run(() => h.onCalculatePayout(booking.id))} className={ghost}>Calculate payout</button>}
          {booking.payout?.status === 'PENDING' && <button type="button" disabled={busy} onClick={markPaid} className={ghost}>Mark paid</button>}
          {canChange && <button type="button" onClick={() => { setPrice(String(booking.agreedPrice)); setMode('pricing'); }} className={ghost}>Edit price</button>}
          {(canChange || s === 'DECLINED') && <button type="button" onClick={() => { setNewPrice(String(booking.agreedPrice)); setMode('replacing'); }} className={ghost}>Replace vendor</button>}
          {(canChange || s === 'DECLINED') && <button type="button" onClick={() => setMode('cancelling')} className={`${btn} text-gray-500 hover:bg-gray-100`}>Cancel vendor</button>}
        </div>
      )}

      {mode === 'declining' && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input aria-label="Why they declined" placeholder="Why did they decline?" value={reason} onChange={(e) => setReason(e.target.value)} className={`${input} min-w-0 flex-1`} />
          <button type="button" disabled={busy} onClick={() => done(() => h.onDecline(booking.id, reason.trim()))} className={`${btn} bg-red-600 text-white disabled:opacity-40`}>{busy ? 'Saving…' : 'Record decline'}</button>
          <button type="button" disabled={busy} onClick={back} className={`${btn} text-gray-500 hover:bg-gray-100`}>Back</button>
        </div>
      )}

      {mode === 'completing' && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-700">Was {booking.vendorName} on time?</span>
          <button type="button" disabled={busy} onClick={() => done(() => h.onComplete(booking.id, true))} className={`${btn} bg-emerald-600 text-white disabled:opacity-40`}>{busy ? 'Saving…' : 'Yes, on time'}</button>
          <button type="button" disabled={busy} onClick={() => done(() => h.onComplete(booking.id, false))} className={ghost}>No, late</button>
          <button type="button" disabled={busy} onClick={back} className={`${btn} text-gray-500 hover:bg-gray-100`}>Back</button>
        </div>
      )}

      {mode === 'pricing' && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="text-xs text-gray-500" htmlFor={`price-${booking.id}`}>Agreed price ₹</label>
          <input id={`price-${booking.id}`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className={`${input} w-32`} />
          <button type="button" disabled={busy || !valid(price)} onClick={() => done(() => h.onEditPrice(booking.id, amount(price)))} className={`${btn} bg-gray-900 text-white disabled:opacity-40`}>{busy ? 'Saving…' : 'Save price'}</button>
          <button type="button" disabled={busy} onClick={back} className={`${btn} text-gray-500 hover:bg-gray-100`}>Back</button>
        </div>
      )}

      {mode === 'cancelling' && (
        <div className="mt-2 grid grid-cols-1 gap-2">
          <p className="text-xs text-gray-600">{booking.vendorName} is dropped and this service goes back to the list of things to assign. Nobody is messaged — tell the vendor yourself if needed.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input aria-label="Why cancel" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} className={`${input} min-w-0 flex-1`} />
            <button type="button" disabled={busy} onClick={() => done(() => h.onCancelVendor(booking.id, reason.trim()))} className={`${btn} bg-red-600 text-white disabled:opacity-40`}>{busy ? 'Saving…' : 'Cancel vendor'}</button>
            <button type="button" disabled={busy} onClick={back} className={`${btn} text-gray-500 hover:bg-gray-100`}>Keep them</button>
          </div>
        </div>
      )}

      {mode === 'replacing' && (
        <div className="mt-2 grid grid-cols-1 gap-2">
          <p className="text-xs text-gray-600">Pick the new vendor. {booking.vendorName} is cancelled and the new one waits for their yes.</p>
          <VendorPicker picked={picked} onPick={setPicked} onClear={() => setPicked(null)} />
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-gray-500" htmlFor={`new-price-${booking.id}`}>Agreed price ₹</label>
            <input id={`new-price-${booking.id}`} inputMode="numeric" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className={`${input} w-32`} />
            <input aria-label="Why replace" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} className={`${input} min-w-0 flex-1`} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy || !picked || !valid(newPrice)} onClick={() => done(() => h.onReplaceVendor(booking.id, { vendorId: (picked as VendorHit).id, agreedPrice: amount(newPrice), reason: reason.trim() }))} className={`${btn} bg-emerald-600 text-white disabled:opacity-40`}>{busy ? 'Saving…' : 'Replace vendor'}</button>
            <button type="button" disabled={busy} onClick={back} className={`${btn} text-gray-500 hover:bg-gray-100`}>Back</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function AddService({ onAdd, onCancel }: { onAdd: (vendorId: string, price: number) => Promise<void>; onCancel: () => void }) {
  const [picked, setPicked] = useState<VendorHit | null>(null);
  const [price, setPrice] = useState('');
  const { busy, error, run } = useAction();
  const amount = Number(price.replace(/,/g, ''));
  const ready = picked && Number.isInteger(amount) && amount > 0;
  return (
    <div className="grid grid-cols-1 gap-2 rounded-xl border border-dashed border-gray-300 p-3">
      <VendorPicker picked={picked} onPick={setPicked} onClear={() => setPicked(null)} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-gray-500" htmlFor="new-service-price">Agreed price ₹</label>
        <input id="new-service-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className={`${input} w-32`} />
        <button type="button" disabled={busy || !ready} onClick={() => run(async () => { await onAdd((picked as VendorHit).id, amount); })} className={`${btn} bg-emerald-600 text-white disabled:opacity-40`}>{busy ? 'Saving…' : 'Add service'}</button>
        <button type="button" disabled={busy} onClick={onCancel} className={`${btn} text-gray-500 hover:bg-gray-100`}>Cancel</button>
      </div>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
