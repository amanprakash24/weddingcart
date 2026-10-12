'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardEmptyState, CardSkeleton } from '@/components/ui/Card';
import StatusPill from '@/components/ui/StatusPill';
import { dayMark, dayWords, monthGrid, monthWords, type CalendarBooking, type VenueCalendar } from '@/lib/venue/calendar';

// "Availability" — which dates the business has already given away, as a month calendar: its OWN bookings, confirmed (filled) or
// accepted by the couple but not confirmed yet (outlined). Tap a day for its bookings; each opens its wedding or its enquiry.
// Phone-first: seven columns fit 375px with 44px-tall days. Loaded venue-scoped from /api/vendor-os/calendar (lib/venue/calendar.ts).

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

export default function AvailabilityCalendar() {
  const [data, setData] = useState<VenueCalendar | null>(null);
  const [failed, setFailed] = useState(false);
  const [monthIndex, setMonthIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

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
  }, []);

  const byDay = useMemo(() => new Map((data?.days ?? []).map((d) => [d.date, d.bookings])), [data]);

  const header = (
    <header>
      <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Availability</h1>
      <p className="text-sm text-[var(--color-text-muted)]">The dates you have already booked — from your own quotations that couples accepted.</p>
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
  if (!data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6">
        {header}
        <CardSkeleton lines={6} />
      </div>
    );
  }

  const month = data.months[monthIndex];
  const inMonth = data.days.filter((d) => d.date.startsWith(month));
  const shown = picked && picked.startsWith(month) ? [{ date: picked, bookings: byDay.get(picked) ?? [] }] : inMonth;
  const go = (step: number) => {
    setMonthIndex((i) => Math.min(data.months.length - 1, Math.max(0, i + step)));
    setPicked(null);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6">
      {header}

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
                const past = day < data.today;
                const isToday = day === data.today;
                const isPicked = day === picked;
                const tone =
                  mark === 'CONFIRMED'
                    ? 'bg-[var(--primary)] text-white font-bold'
                    : mark === 'NOT_CONFIRMED'
                      ? 'border-2 border-[var(--primary)] text-[var(--color-text-primary)] font-bold'
                      : past
                        ? 'text-[var(--color-text-muted)] opacity-60'
                        : 'text-[var(--color-text-primary)]';
                const label = `${dayWords(day)}${mark === 'CONFIRMED' ? ', booked' : mark === 'NOT_CONFIRMED' ? ', accepted, not confirmed yet' : ', free'}${isToday ? ', today' : ''}`;
                return (
                  <button
                    key={day}
                    type="button"
                    role="gridcell"
                    aria-label={label}
                    aria-selected={isPicked}
                    onClick={() => setPicked(isPicked ? null : day)}
                    className={`relative flex h-11 items-center justify-center rounded-lg text-sm tabular-nums ${tone} ${isPicked ? 'ring-2 ring-offset-1 ring-[var(--color-text-primary)]' : ''}`}
                  >
                    {Number(day.slice(8))}
                    {isToday && <span aria-hidden className={`absolute bottom-1 h-1 w-1 rounded-full ${mark === 'CONFIRMED' ? 'bg-white' : 'bg-[var(--primary)]'}`} />}
                    {bookings && bookings.length > 1 && (
                      <span aria-hidden className="absolute right-0.5 top-0.5 rounded-full bg-[var(--color-text-primary)] px-1 text-[11px] font-bold leading-4 text-white">
                        {bookings.length}
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
            <span aria-hidden className="h-3 w-3 rounded bg-[var(--primary)]" /> Booked
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded border-2 border-[var(--primary)]" /> Accepted, not confirmed yet
          </span>
        </div>
      </Card>

      <section aria-label={picked ? dayWords(picked) : `Booked in ${monthWords(month)}`}>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">{picked && picked.startsWith(month) ? dayWords(picked) : `Booked in ${monthWords(month)}`}</h2>
        {shown.length === 0 || shown.every((d) => d.bookings.length === 0) ? (
          <Card>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {picked ? 'Nothing booked on this day — it is free.' : data.days.length === 0 ? 'No booked dates yet. When a couple accepts your quotation, its date shows here.' : 'Nothing booked this month.'}
            </p>
            {data.days.length === 0 && (
              <Link href="/vendor/enquiries" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2">
                Go to your enquiries
              </Link>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {shown.map((d) => (
              <Card key={d.date} className="!py-1">
                {!picked && <p className="pt-2 text-xs font-semibold text-[var(--color-text-muted)]">{dayWords(d.date)}</p>}
                <ul>
                  {d.bookings.map((b, i) => (
                    <BookingLine key={i} b={b} />
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </section>

      {data.truncated && <p className="text-xs text-[var(--color-text-muted)]">Showing your first {data.days.reduce((n, d) => n + d.bookings.length, 0)} bookings — later ones are not shown here yet.</p>}
      <p className="text-xs text-[var(--color-text-muted)]">Only bookings made from your own quotations show here. A date is never blocked — you can still quote for a booked day.</p>
    </div>
  );
}
