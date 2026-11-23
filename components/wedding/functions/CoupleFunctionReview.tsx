'use client';

import { useState } from 'react';

// A couple's own function on the staff side (22 Nov 2026): who added it, and — when it uses the booked venue — Confirm / Not possible.
// Used by Shaadi Shopping's wedding workspace and by a venue's own wedding page (each passes its own decision route).
// Confirming does not touch the venue booking, hall holds or price: check those first, then confirm.

export interface ReviewableFunction {
  id: string;
  addedByCouple?: boolean;
  confirmation?: 'CONFIRMED' | 'WAITING' | 'NOT_POSSIBLE';
  confirmationNote?: string | null;
  endTime?: string | null;
  description?: string | null;
  atBookedVenue?: boolean;
  updatedAt?: string;
}

export default function CoupleFunctionReview({ fn, decisionUrl, onDecided }: { fn: ReviewableFunction; decisionUrl: string; onDecided: () => Promise<unknown> | void }) {
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!fn.addedByCouple && fn.confirmation !== 'WAITING') return null;

  const decide = async (decision: 'CONFIRM' | 'NOT_POSSIBLE') => {
    if (busy || !fn.updatedAt) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(decisionUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, note: decision === 'NOT_POSSIBLE' ? reason : null, seenUpdatedAt: fn.updatedAt }) });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        if (res.status === 409) await onDecided(); // the couple changed it: show the new version
        throw new Error(body?.error || 'Could not save');
      }
      setReasonOpen(false);
      await onDecided();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const waiting = fn.confirmation === 'WAITING';
  return (
    <div className={`mt-2 rounded-lg px-3 py-2 text-sm ${waiting ? 'bg-amber-50 text-amber-900' : fn.confirmation === 'NOT_POSSIBLE' ? 'bg-red-50 text-red-800' : 'bg-gray-50 text-gray-700'}`}>
      <p>
        <b>Added by the couple</b>
        {waiting && ' · at the booked venue — waiting for your confirmation'}
        {fn.confirmation === 'NOT_POSSIBLE' && ` · you said not possible: ${fn.confirmationNote ?? ''}`}
        {fn.endTime && ` · until ${fn.endTime}`}
      </p>
      {fn.description && <p className="mt-0.5 text-xs opacity-80">{fn.description}</p>}
      {waiting && (
        <>
          <p className="mt-1 text-xs opacity-80">Confirming does not book the hall or change the price — check availability first.</p>
          {!reasonOpen ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => decide('CONFIRM')} className="min-h-9 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Confirm'}</button>
              <button type="button" disabled={busy} onClick={() => setReasonOpen(true)} className="min-h-9 rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-semibold text-amber-900">Not possible…</button>
            </div>
          ) : (
            <div className="mt-2 grid gap-2">
              <label className="grid gap-1 text-xs">Why? The couple reads this.
                <input aria-label="Reason it is not possible" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The hall is booked that evening" className="min-h-9 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm text-gray-900" />
              </label>
              <div className="flex gap-2">
                <button type="button" disabled={busy || !reason.trim()} onClick={() => decide('NOT_POSSIBLE')} className="min-h-9 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">Tell the couple</button>
                <button type="button" disabled={busy} onClick={() => setReasonOpen(false)} className="min-h-9 rounded-lg px-3 py-1.5 text-sm">Cancel</button>
              </div>
            </div>
          )}
        </>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
