'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import { checkBookingResponse, DECLINE_REASON } from '@/lib/vendor/bookingResponse';

// The vendor's answer to Shaadi Shopping's booking request, on a booking that is "Awaiting your response" (lib/vendor/bookingResponse.ts):
// Confirm, or Can't do it — which asks why before it is sent. Posts to /api/vendor/bookings/[id]/respond; on success the screen
// is told the new status. A decline is final; the screen says so before it is sent.
export default function BookingResponse({ bookingId, onAnswered }: { bookingId: string; onAnswered: (status: 'CONFIRMED' | 'DECLINED', declineReason: string | null) => void }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (answer: 'CONFIRM' | 'DECLINE') => {
    const checked = checkBookingResponse({ answer, reason });
    if (!checked.ok) return setError(checked.error);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/vendor/bookings/${bookingId}/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer, reason: checked.reason }) });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) onAnswered(body.data.status, body.data.declineReason ?? null);
      else setError(body.error || 'That did not go through — please try again');
    } catch {
      setError('No connection — please try again');
    } finally {
      setBusy(false);
    }
  };

  if (!declining) {
    return (
      <div className="mt-3 border-t border-[var(--color-border-subtle)] pt-3">
        <p className="mb-2 text-sm text-[var(--color-text-secondary)]">Shaadi Shopping has booked you for this. Can you do it?</p>
        <div className="grid grid-cols-2 gap-2">
          <Button className="min-h-11" disabled={busy} onClick={() => send('CONFIRM')}>
            {busy ? 'Sending…' : 'Confirm'}
          </Button>
          <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => (setDeclining(true), setError(null))}>
            Can’t do it
          </Button>
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-[var(--color-danger-text)]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2 border-t border-[var(--color-border-subtle)] pt-3">
      <Textarea
        label="Why can’t you do it?"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={DECLINE_REASON.max}
        rows={2}
        placeholder="e.g. Already booked that night"
        helperText="Shaadi Shopping’s team sees this and finds someone else. You can’t undo it."
        error={error ?? undefined}
        className="text-base"
      />
      <div className="grid grid-cols-2 gap-2">
        <Button className="min-h-11" variant="danger" disabled={busy} onClick={() => send('DECLINE')}>
          {busy ? 'Sending…' : 'Send — I can’t do it'}
        </Button>
        <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => (setDeclining(false), setError(null))}>
          Back
        </Button>
      </div>
    </div>
  );
}
