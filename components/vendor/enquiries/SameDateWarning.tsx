'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { sameDateHeading, type SameDateView } from '@/lib/venue/sameDate';

// "You already have a booking on this date" on an enquiry — a warning, never a block (lib/venue/sameDate.ts). `date` is the date
// being picked for the booking; without it the enquiry's own wedding date is checked. `version` re-checks after something changed.
// Shows nothing when there is no other booking, no clear date, or the check could not be made.

const dayWords = (day: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(`${day}T12:00:00+05:30`));

export default function SameDateWarning({ enquiryId, date, version = 0 }: { enquiryId: string; date?: string; version?: number }) {
  const [view, setView] = useState<SameDateView | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/vendor-os/enquiries/${enquiryId}/quotation/same-date${date ? `?date=${encodeURIComponent(date)}` : ''}`)
      .then((r) => r.json())
      .then((b) => live && setView(b.success ? b.data : null))
      .catch(() => live && setView(null));
    return () => {
      live = false;
    };
  }, [enquiryId, date, version]);

  if (!view?.date || view.bookings.length === 0) return null;

  return (
    <div role="status" className="space-y-2 rounded-lg bg-[var(--color-warning-bg)] p-3 text-sm text-[var(--color-warning-text)]">
      <p className="font-semibold">{sameDateHeading(view.bookings)} · {dayWords(view.date)}</p>
      <ul className="space-y-1">
        {view.bookings.map((b, i) => {
          const href = b.wedding ? `/vendor/weddings/${b.wedding.id}` : b.enquiryId ? `/vendor/enquiries/${b.enquiryId}` : null;
          const words = `${b.name} — ${b.confirmed ? 'booking confirmed' : 'accepted, not confirmed yet'}`;
          return <li key={i}>{href ? <Link href={href} className="inline-flex min-h-8 items-center underline underline-offset-2">{words}</Link> : words}</li>;
        })}
      </ul>
      <p>Check that you can take both before you go ahead.</p>
    </div>
  );
}
