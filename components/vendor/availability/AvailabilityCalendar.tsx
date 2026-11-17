'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardEmptyState, CardSkeleton } from '@/components/ui/Card';
import StatusPill from '@/components/ui/StatusPill';
import { dayMark, dayWords, monthGrid, monthWords, type CalendarBooking, type VenueCalendarView } from '@/lib/venue/calendar';
import { dayFill, SHIFT_LABEL, SLOT_STATE_LABEL, type Slot } from '@/lib/venue/slots';
import { SLOT_PILL } from '@/components/vendor/enquiries/EnquiryHalls';
import HallsManager from './HallsManager';
import HallDay from './HallDay';

// "Availability" — a month calendar of what the business has given away. Phone-first: seven columns fit 375px with 44px-tall days.
// Loaded venue-scoped from /api/vendor-os/calendar (lib/venue/calendar.ts).
//
// A venue with halls (lib/venue/slots.ts, 17 Nov 2026) sees each hall's day and night: a day is filled when every hall is taken
// for both shifts, outlined when some are. Tap a day for each hall — who has it, who was quoted for it, or free — and block a free
// shift by hand. A business without halls (a photographer, a DJ …) sees its own bookings by day, as before.

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function BookingLine({ b }: { b: CalendarBooking }) {
  const href = b.wedding ? `/vendor/weddings/${b.wedding.id}` : b.enquiryId ? `/vendor/enquiries/${b.enquiryId}` : null;
  const body = (
    <div className="flex min-h-14 items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{b.name}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{b.wedding ? `Wedding ${b.wedding.number}` : 'Open the enquiry'}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <StatusPill status={b.confirmed ? 'confirmed' : 'dateHeld'}>{b.confirmed ? 'Confirmed' : 'Not confirmed yet'}</StatusPill>
        {href && <ChevronRight aria-hidden className="h-5 w-5 text-[var(--color-text-muted)]" />}
      </div>
    </div>
  );
  return <li className="border-b border-[var(--color-border-subtle)] last:border-b-0">{href ? <Link href={href} className="block">{body}</Link> : body}</li>;
}

function SlotLine({ s, hall }: { s: Slot; hall: string }) {
  const href = s.wedding ? `/vendor/weddings/${s.wedding.id}` : s.enquiryId ? `/vendor/enquiries/${s.enquiryId}` : null;
  const body = (
    <div className="flex min-h-14 items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{s.state === 'BLOCKED' ? s.note || 'Blocked by you' : s.name}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{hall} · {SHIFT_LABEL[s.shift]}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <StatusPill status={SLOT_PILL[s.state]}>{SLOT_STATE_LABEL[s.state]}</StatusPill>
        {href && <ChevronRight aria-hidden className="h-5 w-5 text-[var(--color-text-muted)]" />}
      </div>
    </div>
  );
  return <li className="border-b border-[var(--color-border-subtle)] last:border-b-0">{href ? <Link href={href} className="block">{body}</Link> : body}</li>;
}

export default function AvailabilityCalendar() {
  const [data, setData] = useState<VenueCalendarView | null>(null);
  const [failed, setFailed] = useState(false);
  const [monthIndex, setMonthIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // bumped after a block or a hall change — the calendar loads again

  useEffect(() => {
    let live = true;
    fetch('/api/vendor-os/calendar')
      .then((r) => r.json())
      .then((b) => {
        if (!live) return;
        if (b.success) setData(b.data);
        else setFailed(true);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [version]);

  const byDay = useMemo(() => new Map((data?.days ?? []).map((d) => [d.date, d.bookings])), [data]);
  const slotsByDay = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of data?.halls.slots ?? []) m.set(s.date, [...(m.get(s.date) ?? []), s]);
    return m;
  }, [data]);

  const halls = data?.halls;
  const hallMode = !!halls?.usesHalls && halls.spaces.some((s) => s.active);
  const hallName = (id: string) => halls?.spaces.find((s) => s.id === id)?.name ?? 'Hall';

  const header = (
    <header>
      <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Availability</h1>
      <p className="text-sm text-[var(--color-text-muted)]">
        {hallMode ? 'Each hall’s day and night. Tap a date to see who has each hall, or to block a shift.' : 'The dates you have already booked — from your own quotations that couples accepted.'}
      </p>
    </header>
  );

  if (failed) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6">
        {header}
        <CardEmptyState title="Your calendar could not be loaded" description="Please check your connection and open this page again." />
      </div>
    );
  }
  if (!data || !halls) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6">
        {header}
        <CardSkeleton lines={6} />
      </div>
    );
  }

  const manager = halls.usesHalls ? <HallsManager spaces={halls.spaces} onChange={() => setVersion((v) => v + 1)} /> : null;
  const month = data.months[monthIndex];
  const go = (step: number) => {
    setMonthIndex((i) => Math.min(data.months.length - 1, Math.max(0, i + step)));
    setPicked(null);
  };
  const pickedHere = picked && picked.startsWith(month) ? picked : null;

  // The days of this month with anything on them, for the list under the calendar.
  const monthDays = [...new Set([...data.days.map((d) => d.date), ...(hallMode ? halls.slots.map((s) => s.date) : [])])].filter((d) => d.startsWith(month)).sort();

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6">
      {header}

      {halls.usesHalls && !hallMode && manager}

      <Card className="!p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button type="button" onClick={() => go(-1)} disabled={monthIndex === 0} aria-label="Previous month" className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-primary)] disabled:opacity-30">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]" aria-live="polite">
            {monthWords(month)}
          </h2>
          <button type="button" onClick={() => go(1)} disabled={monthIndex === data.months.length - 1} aria-label="Next month" className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-primary)] disabled:opacity-30">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div role="grid" aria-label={monthWords(month)}>
          <div role="row" className="grid grid-cols-7 text-center text-xs font-semibold text-[var(--color-text-muted)]">
            {WEEK.map((d, i) => (
              <span key={i} role="columnheader" className="py-1">
                {d}
              </span>
            ))}
          </div>
          {monthGrid(month).map((week, wi) => (
            <div key={wi} role="row" className="grid grid-cols-7 gap-1 py-0.5">
              {week.map((day, di) => {
                if (!day) return <span key={di} role="gridcell" />;
                const bookings = byDay.get(day);
                const mark = dayMark(bookings);
                const fill = hallMode ? dayFill(halls.spaces, slotsByDay.get(day) ?? []) : null;
                // With halls: filled = every hall taken day and night; outlined = something on it. Without: as before.
                const look: 'FILLED' | 'OUTLINED' | null = hallMode ? (fill === 'FULL' ? 'FILLED' : fill === 'PART' || mark ? 'OUTLINED' : null) : mark === 'CONFIRMED' ? 'FILLED' : mark === 'NOT_CONFIRMED' ? 'OUTLINED' : null;
                const past = day < data.today;
                const isToday = day === data.today;
                const isPicked = day === picked;
                const tone =
                  look === 'FILLED'
                    ? 'bg-[var(--primary)] text-white font-bold'
                    : look === 'OUTLINED'
                      ? 'border-2 border-[var(--primary)] text-[var(--color-text-primary)] font-bold'
                      : past
                        ? 'text-[var(--color-text-muted)] opacity-60'
                        : 'text-[var(--color-text-primary)]';
                const words = hallMode
                  ? fill === 'FULL' ? ', every hall taken' : look === 'OUTLINED' ? ', some halls taken or quoted' : ', all halls free'
                  : mark === 'CONFIRMED' ? ', booked' : mark === 'NOT_CONFIRMED' ? ', accepted, not confirmed yet' : ', free';
                const count = hallMode ? (slotsByDay.get(day)?.length ?? 0) : (bookings?.length ?? 0);
                return (
                  <button
                    key={day}
                    type="button"
                    role="gridcell"
                    aria-label={`${dayWords(day)}${words}${isToday ? ', today' : ''}`}
                    aria-selected={isPicked}
                    onClick={() => setPicked(isPicked ? null : day)}
                    className={`relative flex h-11 items-center justify-center rounded-lg text-sm tabular-nums ${tone} ${isPicked ? 'ring-2 ring-offset-1 ring-[var(--color-text-primary)]' : ''}`}
                  >
                    {Number(day.slice(8))}
                    {isToday && <span aria-hidden className={`absolute bottom-1 h-1 w-1 rounded-full ${look === 'FILLED' ? 'bg-white' : 'bg-[var(--primary)]'}`} />}
                    {count > 1 && (
                      <span aria-hidden className="absolute right-0.5 top-0.5 rounded-full bg-[var(--color-text-primary)] px-1 text-[11px] font-bold leading-4 text-white">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--color-border-subtle)] pt-2 text-xs text-[var(--color-text-secondary)]">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded bg-[var(--primary)]" /> {hallMode ? 'Every hall taken' : 'Booked'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded border-2 border-[var(--primary)]" /> {hallMode ? 'Some halls taken or quoted' : 'Accepted, not confirmed yet'}
          </span>
        </div>
      </Card>

      <section aria-label={pickedHere ? dayWords(pickedHere) : `Booked in ${monthWords(month)}`}>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">{pickedHere ? dayWords(pickedHere) : `In ${monthWords(month)}`}</h2>
        {hallMode && pickedHere ? (
          <HallDay day={pickedHere} past={pickedHere < data.today} spaces={halls.spaces} slots={slotsByDay.get(pickedHere) ?? []} bookings={byDay.get(pickedHere) ?? []} onChanged={() => setVersion((v) => v + 1)} />
        ) : (pickedHere ? [pickedHere] : monthDays).every((d) => !(byDay.get(d)?.length || (hallMode && slotsByDay.get(d)?.length))) ? (
          <Card>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {pickedHere ? 'Nothing booked on this day — it is free.' : data.days.length === 0 && halls.slots.length === 0 ? 'Nothing booked yet. When a couple accepts your quotation, its date shows here.' : 'Nothing booked this month.'}
            </p>
            {data.days.length === 0 && halls.slots.length === 0 && (
              <Link href="/vendor/enquiries" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2">
                Go to your enquiries
              </Link>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {(pickedHere ? [pickedHere] : monthDays).map((d) => {
              const slots = hallMode ? (slotsByDay.get(d) ?? []) : [];
              const withHall = new Set(slots.map((s) => s.enquiryId).filter(Boolean));
              const loose = (byDay.get(d) ?? []).filter((b) => !hallMode || !b.enquiryId || !withHall.has(b.enquiryId));
              if (!slots.length && !loose.length) return null;
              return (
                <Card key={d} className="!py-1">
                  {!pickedHere && (
                    <button type="button" onClick={() => setPicked(d)} className="block min-h-8 pt-2 text-left text-xs font-semibold text-[var(--color-text-muted)] underline-offset-2 hover:underline">
                      {dayWords(d)}
                    </button>
                  )}
                  <ul>
                    {slots.map((s) => (
                      <SlotLine key={s.id} s={s} hall={hallName(s.spaceId)} />
                    ))}
                    {loose.map((b, i) => (
                      <BookingLine key={`b${i}`} b={b} />
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {hallMode && manager}

      {data.truncated && <p className="text-xs text-[var(--color-text-muted)]">Showing your first {data.days.reduce((n, d) => n + d.bookings.length, 0)} bookings — later ones are not shown here yet.</p>}
      <p className="text-xs text-[var(--color-text-muted)]">
        {hallMode
          ? 'A couple’s hall and shift is chosen on their enquiry, and fills the calendar once they accept. A quote alone never takes a hall.'
          : 'Only bookings made from your own quotations show here. A date is never blocked — you can still quote for a booked day.'}
      </p>
    </div>
  );
}
