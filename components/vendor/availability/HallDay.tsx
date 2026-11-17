'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import StatusPill from '@/components/ui/StatusPill';
import { halfOf, recordHref, SHIFT_LABEL, SLOT_PILL, slotLabel, type Slot, type Space } from '@/lib/venue/slots';
import type { CalendarBooking } from '@/lib/venue/calendar';

// One day on the calendar, hall by hall: each hall's day and night — who has it (booked, accepted, or blocked by hand), which
// couples were only quoted for it, or free. A free shift can be blocked by hand (with a reason); a hand block can be freed. A
// couple's hall is changed on their enquiry, never here.

const HALVES = ['DAY', 'NIGHT'] as const;

export default function HallDay({ day, past, canBlock, spaces, slots, bookings, onChanged }: { day: string; past: boolean; canBlock: boolean; spaces: Space[]; slots: Slot[]; bookings: CalendarBooking[]; onChanged: () => void }) {
  const [blocking, setBlocking] = useState<string | null>(null); // `${spaceId}:${half}` being blocked
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Halls in use, plus any hall taken out of use that still has something on this day.
  const halls = spaces.filter((s) => s.active || slots.some((x) => x.spaceId === s.id));
  // Bookings on this day whose enquiry has no hall chosen for it — shown so nothing booked goes unseen.
  const withHall = new Set(slots.map((s) => s.enquiryId).filter(Boolean));
  const noHall = bookings.filter((b) => !b.enquiryId || !withHall.has(b.enquiryId));

  async function call(url: string, method: 'POST' | 'DELETE', body?: unknown) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.success) {
        setBlocking(null);
        setNote('');
        onChanged();
      } else setError(b.fieldErrors ? Object.values(b.fieldErrors).join(' ') : (b.error ?? 'It was not saved — please try again.'));
    } catch {
      setError('Could not reach Vivah OS. It was not saved — please check your connection.');
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      {halls.map((hall) => (
        <Card key={hall.id} className="!py-2">
          <p className="pt-1 text-sm font-semibold text-[var(--color-text-primary)]">
            {hall.name}
            {!hall.active && <span className="font-normal text-[var(--color-text-muted)]"> · not in use</span>}
          </p>
          <ul>
            {HALVES.map((half) => {
              const { taken, quoted } = halfOf(hall.id, half, slots);
              const key = `${hall.id}:${half}`;
              const href = taken ? recordHref(taken) : null;
              return (
                <li key={half} className="border-b border-[var(--color-border-subtle)] py-2 last:border-b-0">
                  <div className="flex min-h-11 items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                        {SHIFT_LABEL[half]}
                        {taken?.shift === 'FULL_DAY' && <span className="normal-case tracking-normal"> · full day</span>}
                      </p>
                      {taken ? (
                        href ? (
                          <Link href={href} className="block truncate text-sm font-semibold text-[var(--color-text-primary)] underline-offset-2 hover:underline">
                            {taken.name}
                          </Link>
                        ) : (
                          <p className="truncate text-sm text-[var(--color-text-primary)]">{taken.note || 'Blocked by you'}</p>
                        )
                      ) : (
                        <p className="text-sm text-[var(--color-text-secondary)]">Free</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {taken && <StatusPill status={SLOT_PILL[taken.state]}>{slotLabel(taken)}</StatusPill>}
                      {taken?.state === 'BLOCKED' && !past && canBlock && (
                        <button type="button" disabled={busy} onClick={() => call(`/api/vendor-os/calendar/blocks/${taken.id}`, 'DELETE')} className="min-h-11 rounded-lg px-3 text-sm font-medium text-[var(--primary)]">
                          Free it
                        </button>
                      )}
                      {!taken && !past && hall.active && canBlock && blocking !== key && (
                        <button type="button" onClick={() => { setBlocking(key); setNote(''); setError(null); }} className="min-h-11 rounded-lg px-3 text-sm font-medium text-[var(--color-text-secondary)]">
                          Block
                        </button>
                      )}
                    </div>
                  </div>
                  {quoted.length > 0 && (
                    <p className="text-xs text-[var(--color-info-text)]">
                      Quoted to{' '}
                      {quoted.map((q, i) => (
                        <span key={q.id}>
                          {i > 0 && ', '}
                          {q.enquiryId ? <Link href={`/vendor/enquiries/${q.enquiryId}`} className="underline underline-offset-2">{q.name}</Link> : q.name}
                        </span>
                      ))}
                    </p>
                  )}
                  {blocking === key && (
                    <div className="mt-2 space-y-2">
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)]" htmlFor={`note-${key}`}>
                        Why? (optional)
                      </label>
                      <input id={`note-${key}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Repairs, family function…" className="min-h-11 w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 text-base text-[var(--color-text-primary)]" />
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setBlocking(null)} className="min-h-11 rounded-xl border border-[var(--color-border-default)] text-sm font-semibold text-[var(--color-text-primary)]">
                          Cancel
                        </button>
                        <button type="button" disabled={busy} onClick={() => call('/api/vendor-os/calendar/blocks', 'POST', { spaceId: hall.id, date: day, shift: half, note })} className="min-h-11 rounded-xl bg-[var(--primary)] text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-50">
                          {busy ? 'Blocking…' : `Block ${SHIFT_LABEL[half].toLowerCase()}`}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}

      {noHall.length > 0 && (
        <Card className="!py-2">
          <p className="pt-1 text-sm font-semibold text-[var(--color-text-primary)]">Booked, hall not chosen yet</p>
          <ul>
            {noHall.map((b, i) => {
              const href = recordHref(b);
              return (
                <li key={i} className="flex min-h-11 items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] py-1 last:border-b-0">
                  {href ? <Link href={href} className="truncate text-sm font-semibold underline-offset-2 hover:underline">{b.name}</Link> : <span className="truncate text-sm">{b.name}</span>}
                  <StatusPill status={b.confirmed ? 'confirmed' : 'dateHeld'}>{b.confirmed ? 'Confirmed' : 'Not confirmed yet'}</StatusPill>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {error && <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>}
    </div>
  );
}
