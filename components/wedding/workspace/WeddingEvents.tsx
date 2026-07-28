'use client';

import { useEffect, useState } from 'react';
import type { WorkspaceWeddingEvent, VendorBookingStatus, VendorSearchResult } from './types';

const VB_STATUS_LABELS: Record<VendorBookingStatus, string> = {
  PENDING_VENDOR_CONFIRMATION: 'Pending Confirmation',
  CONFIRMED: 'Confirmed',
  DECLINED: 'Declined',
  CUSTOMER_APPROVAL_PENDING: 'Awaiting Customer Approval',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
};

const VB_STATUS_COLORS: Record<VendorBookingStatus, string> = {
  PENDING_VENDOR_CONFIRMATION: 'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-emerald-100 text-emerald-700',
  DECLINED: 'bg-red-100 text-red-700',
  CUSTOMER_APPROVAL_PENDING: 'bg-violet-100 text-violet-700',
  CANCELLED: 'bg-gray-200 text-gray-600',
  COMPLETED: 'bg-blue-100 text-blue-700',
};

// The only place a VendorBooking can be marked CONFIRMED this milestone — no
// vendor-facing self-serve flow exists yet (Vendor OS, later), so this is
// Operations recording a real confirmation obtained by phone/WhatsApp. Also
// the trigger path for the automatic PLANNING->ACTIVE transition
// (domain-model.md §5.2) — confirming here is what activates the Wedding.
function VendorBookingRow({
  vb,
  onUpdateStatus,
}: {
  vb: WorkspaceWeddingEvent['vendorBookings'][number];
  onUpdateStatus: (vbId: string, status: VendorBookingStatus, declineReason?: string) => Promise<void>;
}) {
  const [updating, setUpdating] = useState(false);

  const handle = async (status: VendorBookingStatus) => {
    if (status === 'DECLINED') {
      const reason = window.prompt('Decline reason?');
      if (reason === null) return;
      setUpdating(true);
      try {
        await onUpdateStatus(vb.id, status, reason || undefined);
      } finally {
        setUpdating(false);
      }
      return;
    }
    setUpdating(true);
    try {
      await onUpdateStatus(vb.id, status);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <li className="flex items-center justify-between text-sm border border-gray-100 rounded-xl px-3 py-2">
      <div>
        <div className="text-gray-900 font-medium">{vb.vendorName}</div>
        <div className="text-gray-400 text-xs">{vb.vendorCategory} · ₹{vb.agreedPrice.toLocaleString('en-IN')}</div>
        {vb.status === 'DECLINED' && vb.declineReason && <div className="text-red-500 text-xs mt-0.5">{vb.declineReason}</div>}
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${VB_STATUS_COLORS[vb.status]}`}>{VB_STATUS_LABELS[vb.status]}</span>
        {vb.status === 'PENDING_VENDOR_CONFIRMATION' && (
          <>
            <button disabled={updating} onClick={() => handle('CONFIRMED')} className="text-xs text-emerald-600 hover:underline disabled:opacity-40">
              Confirm
            </button>
            <button disabled={updating} onClick={() => handle('DECLINED')} className="text-xs text-red-500 hover:underline disabled:opacity-40">
              Decline
            </button>
          </>
        )}
      </div>
    </li>
  );
}

// The Confirm/Decline flow above needs a VendorBooking to already exist —
// this is what creates the first one for a CRM-sourced Wedding (Booking-path
// weddings already get theirs from convertBookingToWedding's item loop). No
// vendor-facing self-serve flow exists yet, so Operations records the
// agreed price after negotiating by phone/WhatsApp, same as the confirm step.
function AddVendorBookingForm({
  eventId,
  onAdd,
  onCancel,
}: {
  eventId: string;
  onAdd: (eventId: string, vendorId: string, agreedPrice: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VendorSearchResult[]>([]);
  const [selected, setSelected] = useState<VendorSearchResult | null>(null);
  const [price, setPrice] = useState('');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selected || query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(() => {
      fetch(`/api/weddings/vendor-search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((body) => setResults(body.success ? body.data : []))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, selected]);

  const submit = async () => {
    const agreedPrice = Number(price);
    if (!selected || !Number.isFinite(agreedPrice) || agreedPrice <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await onAdd(eventId, selected.id, agreedPrice);
      onCancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add vendor booking');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-dashed border-gray-200 rounded-xl p-3 space-y-2">
      {!selected ? (
        <>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendor by name…"
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
          />
          {searching && <p className="text-xs text-gray-400">Searching…</p>}
          {results.length > 0 && (
            <ul className="space-y-1">
              {results.map((v) => (
                <li key={v.id}>
                  <button
                    onClick={() => {
                      setSelected(v);
                      setResults([]);
                    }}
                    className="w-full text-left text-sm px-2 py-1.5 rounded-lg hover:bg-gray-50"
                  >
                    <span className="font-medium text-gray-900">{v.name}</span>
                    <span className="text-gray-400 text-xs ml-2">{v.category} · {v.city}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-900">{selected.name}</span>
          <span className="text-gray-400 text-xs">{selected.category}</span>
          <button onClick={() => setSelected(null)} className="text-xs text-gray-400 hover:underline ml-auto">
            change
          </button>
        </div>
      )}
      {selected && (
        <input
          type="number"
          min={1}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Agreed price (₹)"
          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
        />
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          disabled={!selected || !price || submitting}
          onClick={submit}
          className="text-xs text-emerald-600 hover:underline disabled:opacity-40"
        >
          {submitting ? 'Adding…' : 'Add'}
        </button>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function WeddingEvents({
  events,
  onUpdateVendorBookingStatus,
  onAddVendorBooking,
}: {
  events: WorkspaceWeddingEvent[];
  onUpdateVendorBookingStatus: (vbId: string, status: VendorBookingStatus, declineReason?: string) => Promise<void>;
  onAddVendorBooking: (eventId: string, vendorId: string, agreedPrice: number) => Promise<void>;
}) {
  const [addingFor, setAddingFor] = useState<string | null>(null);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Events & Vendor Bookings</h2>
      {events.length === 0 ? (
        <p className="text-sm text-gray-400">No events yet.</p>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.id} className="border border-gray-100 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-medium text-gray-900 text-sm">{event.label ?? event.type}</span>
                  <span className="text-gray-400 text-xs ml-2">{new Date(event.date).toLocaleDateString()}</span>
                </div>
                {event.venueName && <span className="text-xs text-gray-500">{event.venueName}</span>}
              </div>
              {event.vendorBookings.length === 0 ? (
                <p className="text-xs text-gray-400 mb-2">No vendors booked for this event yet.</p>
              ) : (
                <ul className="space-y-2 mb-2">
                  {event.vendorBookings.map((vb) => (
                    <VendorBookingRow key={vb.id} vb={vb} onUpdateStatus={onUpdateVendorBookingStatus} />
                  ))}
                </ul>
              )}
              {addingFor === event.id ? (
                <AddVendorBookingForm
                  eventId={event.id}
                  onAdd={onAddVendorBooking}
                  onCancel={() => setAddingFor(null)}
                />
              ) : (
                <button onClick={() => setAddingFor(event.id)} className="text-xs text-emerald-600 hover:underline">
                  + Add Vendor
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
