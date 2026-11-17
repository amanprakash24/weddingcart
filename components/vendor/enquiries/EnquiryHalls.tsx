'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import StatusPill from '@/components/ui/StatusPill';
import { blockingClash, clashWords, DEFAULT_HOLD_DAYS, HOLD_DAYS, holdEnd, holdTimeWords, holdWords, recordHref, SHIFT_LABEL, SHIFTS, SLOT_PILL, slotDayWords, slotLabel, TAKES_HALL, type SlotErrors } from '@/lib/venue/slots';
import { istDay } from '@/lib/venue/calendar';
import type { EnquirySlots } from '@/services/venueSpace.service';

// "Hall and shift" on one of the venue's own enquiries (lib/venue/slots.ts): which hall this couple wants, on which date, for the
// day, the night or the full day. Another couple or a block on the same hall and shift is a WARNING here, never a block — two
// couples can be quoted for one hall. Shown only to a business that works with halls (a venue, or anyone who added a hall).

const dayWords = slotDayWords;
const today = () => istDay(new Date());
const SHIFT_OPTIONS = SHIFTS.map((s) => ({ value: s, label: SHIFT_LABEL[s] }));

// `version` is bumped by the enquiry page when its quotation changes (sent, accepted, paid): the states here follow it.
export default function EnquiryHalls({ enquiryId, weddingDate, closed, version = 0 }: { enquiryId: string; weddingDate: string | null; closed: boolean; version?: number }) {
  const [view, setView] = useState<EnquirySlots | null>(null);
  const [adding, setAdding] = useState(false);
  const [spaceId, setSpaceId] = useState('');
  const [date, setDate] = useState('');
  const [shift, setShift] = useState('NIGHT');
  const [errors, setErrors] = useState<SlotErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null); // a held, accepted or booked slot asks once more before it goes
  const [holding, setHolding] = useState<string | null>(null); // the slot whose hold length is being chosen
  const [holdDays, setHoldDays] = useState<number>(DEFAULT_HOLD_DAYS);

  useEffect(() => {
    let live = true;
    fetch(`/api/vendor-os/enquiries/${enquiryId}/slots`)
      .then((r) => r.json())
      .then((b) => live && setView(b.success ? b.data : null))
      .catch(() => live && setView(null));
    return () => {
      live = false;
    };
  }, [enquiryId, version]);

  if (!view?.usesHalls) return null;

  function open() {
    setAdding(true);
    setErrors({});
    setError(null);
    setSpaceId(view?.spaces.find((s) => s.active)?.id ?? '');
    setDate(weddingDate && /^\d{4}-\d{2}-\d{2}$/.test(weddingDate) && weddingDate >= today() ? weddingDate : '');
  }

  async function call(path: string, method: 'POST' | 'DELETE', body?: unknown) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const res = await fetch(`/api/vendor-os/enquiries/${enquiryId}/slots${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.success) {
        setView(b.data);
        setAdding(false);
        setHolding(null);
        setRemoving(null);
      } else if (b.fieldErrors) setErrors(b.fieldErrors);
      else setError(b.error ?? 'It was not saved — please try again.');
    } catch {
      setError('Could not reach Vivah OS. It was not saved — please check your connection.');
    }
    setBusy(false);
  }

  const spaceName = (id: string) => view.spaces.find((s) => s.id === id)?.name ?? 'A removed hall';
  const choices = view.spaces.filter((s) => s.active);
  const editable = !closed && view.canReserve;

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Hall and shift</h2>
        {editable && choices.length > 0 && !adding && (
          <button type="button" onClick={open} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-[var(--primary)]">
            + Add
          </button>
        )}
      </div>

      {choices.length === 0 && view.slots.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Add your halls and lawns first, then choose which one this couple wants.{' '}
          <Link href="/vendor/availability#halls" className="inline-flex min-h-8 items-center font-semibold underline underline-offset-2">
            Add halls
          </Link>
        </p>
      ) : view.slots.length === 0 && !adding ? (
        <p className="text-sm text-[var(--color-text-secondary)]">{closed ? 'No hall was chosen.' : 'No hall chosen yet. Add the hall, date and shift this couple wants — your calendar shows it once they accept.'}</p>
      ) : (
        <ul className="space-y-2">
          {view.slots.map((s) => (
            <li key={s.id} className="rounded-lg border border-[var(--color-border-subtle)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{spaceName(s.spaceId)} · {SHIFT_LABEL[s.shift]}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{dayWords(s.date)}</p>
                  <div className="mt-1.5">
                    <StatusPill status={SLOT_PILL[s.state]}>{slotLabel(s)}</StatusPill>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {editable && (
                    <button type="button" disabled={busy} onClick={() => (s.state === 'QUOTED' || removing === s.id ? call(`/${s.id}`, 'DELETE') : setRemoving(s.id))} aria-label={`Remove ${spaceName(s.spaceId)}, ${SHIFT_LABEL[s.shift]}, ${dayWords(s.date)}`} className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--color-text-muted)]">
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
              </div>
              {removing === s.id && (
                <p role="status" className="mt-2 text-xs text-[var(--color-danger-text)]">
                  {s.state === 'HELD' ? 'This hall is held for the couple. Tap the bin again to remove it.' : 'This couple has already said yes. Tap the bin again to free this hall — the booking itself stays.'}
                </p>
              )}
              {(() => {
                // The acceptance rule (lib/venue/slots.ts blockingClash): while this hall and shift is taken by someone else — booked,
                // accepted, held or blocked — this couple's quotation cannot be accepted (the server refuses it).
                const taken = s.state === 'QUOTED' ? blockingClash(s, s.clashes) : undefined;
                if (!taken) return null;
                return (
                  <p role="status" className="mt-2 rounded-lg bg-[var(--color-danger-bg)] p-2 text-xs text-[var(--color-danger-text)]">
                    {taken.state === 'HELD' && taken.holdUntil
                      ? `This hall is held for another couple until ${holdTimeWords(taken.holdUntil)}. Until then this couple cannot accept the quotation for it — release that hold first, or wait for it to end.`
                      : taken.state === 'BLOCKED'
                        ? 'You have blocked this hall for this shift. This couple cannot accept the quotation for it until you free it on the calendar.'
                        : 'Another couple has already accepted or booked this hall for this shift. This couple cannot accept the quotation for it — choose another hall or date.'}
                  </p>
                );
              })()}
              {s.state === 'QUOTED' && s.holdUntil && <p className="mt-1 text-xs text-[var(--color-text-muted)]">The hold ended on {holdWords(s.holdUntil)} — the hall is free for others again.</p>}
              {editable && (s.state === 'QUOTED' || s.state === 'HELD') && s.date >= today() &&
                (holding === s.id ? (
                  <div className="mt-2 space-y-2 rounded-lg border border-[var(--color-border-default)] p-3">
                    <Select label={s.state === 'HELD' ? 'Hold it, from today, for' : 'Hold the hall, from today, for'} value={String(holdDays)} onChange={(e) => setHoldDays(Number(e.target.value))} options={HOLD_DAYS.map((d) => ({ value: String(d), label: d === 1 ? '1 day' : `${d} days` }))} className="min-h-12 text-base" />
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Held until {holdWords(holdEnd(new Date(), holdDays, s.date).toISOString())}. Until then nobody else can hold or block this hall, and no other couple can accept a quotation for it. The hold ends by itself.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setHolding(null)} className="min-h-11 rounded-xl border border-[var(--color-border-default)] text-sm font-semibold text-[var(--color-text-primary)]">
                        Cancel
                      </button>
                      <button type="button" disabled={busy} onClick={() => call(`/${s.id}/hold`, 'POST', { days: holdDays })} className="min-h-11 rounded-xl bg-[var(--primary)] text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-50">
                        {busy ? 'Holding…' : 'Hold it'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {/* Hold or change only while no one else takes the hall; a hold can always be released. */}
                    {!s.clashes.some((c) => TAKES_HALL.includes(c.state)) && (
                      <button type="button" onClick={() => { setHolding(s.id); setHoldDays(DEFAULT_HOLD_DAYS); setError(null); }} className="min-h-11 rounded-lg border border-[var(--color-border-default)] px-3 text-sm font-semibold text-[var(--color-text-primary)]">
                        {s.state === 'HELD' ? 'Change the hold' : 'Hold for the couple'}
                      </button>
                    )}
                    {s.state === 'HELD' && (
                      <button type="button" disabled={busy} onClick={() => call(`/${s.id}/hold`, 'DELETE')} className="min-h-11 rounded-lg px-3 text-sm font-medium text-[var(--color-text-secondary)]">
                        Release the hold
                      </button>
                    )}
                  </div>
                ))}
              {s.clashes.length > 0 && (
                <div role="status" className="mt-2 space-y-1 rounded-lg bg-[var(--color-warning-bg)] p-2 text-xs text-[var(--color-warning-text)]">
                  <p className="font-semibold">Also on this hall then:</p>
                  <ul>
                    {s.clashes.map((c) => {
                      const href = recordHref(c);
                      return <li key={c.id}>{href ? <Link href={href} className="inline-flex min-h-8 items-center underline underline-offset-2">{clashWords(c)}</Link> : clashWords(c)}</li>;
                    })}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="space-y-3 rounded-lg border border-[var(--color-border-default)] p-3">
          <Select label="Hall or lawn" value={spaceId} onChange={(e) => setSpaceId(e.target.value)} options={choices.map((s) => ({ value: s.id, label: s.capacity ? `${s.name} (${s.capacity.toLocaleString('en-IN')} guests)` : s.name }))} error={errors.spaceId} className="min-h-12 text-base" />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Date" type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} className="min-h-12 text-base" />
            <Select label="Shift" value={shift} onChange={(e) => setShift(e.target.value)} options={SHIFT_OPTIONS} error={errors.shift} className="min-h-12 text-base" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setAdding(false)} className="min-h-12 rounded-xl border border-[var(--color-border-default)] px-4 text-base font-semibold text-[var(--color-text-primary)]">
              Cancel
            </button>
            <button type="button" disabled={busy || !spaceId || !date} onClick={() => call('', 'POST', { spaceId, date, shift })} className="min-h-12 rounded-xl bg-[var(--primary)] px-4 text-base font-semibold text-[var(--color-on-primary)] disabled:opacity-50">
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>}
    </Card>
  );
}
