'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardSkeleton } from '@/components/ui/Card';
import StatusPill, { type PillStatus } from '@/components/ui/StatusPill';
import type { WeddingStage } from '@/lib/wedding/stage';
import type { VenueWeddingListItem } from '@/services/venueWedding.service';

// "Your Weddings" — the weddings the business's OWN confirmed bookings became, the nearest date first. Phone-first: one big row
// per wedding, one tap to open. Loaded venue-scoped from /api/vendor-os/weddings; nothing is shown to someone who may not see them.

const TONE: Record<WeddingStage, PillStatus> = { PLANNING: 'info', FINAL_WEEK: 'dateHeld', WEDDING_DAY: 'confirmed', COMPLETED: 'neutral', POSTPONED: 'overdue', CANCELLED: 'neutral' };

export const weddingDateWords = (d: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(`${d}T12:00:00+05:30`));

export const daysWords = (stage: WeddingStage, daysToGo: number | null) => {
  if (stage === 'COMPLETED' || stage === 'CANCELLED' || stage === 'POSTPONED' || daysToGo === null) return null;
  if (daysToGo > 1) return `${daysToGo} days to go`;
  if (daysToGo === 1) return 'Tomorrow';
  if (daysToGo === 0) return 'Today';
  return 'Date has passed';
};

export default function YourWeddings() {
  const [items, setItems] = useState<VenueWeddingListItem[] | null>(null);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/vendor-os/weddings')
      .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
      .then(({ status, body }) => {
        if (!live) return;
        if (body.success) setItems(body.data);
        else if (status === 403 || status === 404) setHidden(true); // not this person's work, or not a business of its own
        else setError(body.error ?? 'Your weddings could not be loaded. Please try again.');
      })
      .catch(() => live && setError('Could not reach Vivah OS — please check your connection.'));
    return () => {
      live = false;
    };
  }, []);

  if (hidden) return null;

  return (
    <section aria-label="Your weddings" className="space-y-3">
      <div>
        <h1 className="font-playfair text-2xl font-bold text-[var(--color-text-primary)]">Your Weddings</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Your own confirmed bookings — only your business can see these.</p>
      </div>

      {error && <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>}
      {!items && !error && <CardSkeleton lines={2} />}
      {items && items.length === 0 && (
        <Card>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">No weddings yet</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            A wedding appears here when a booking is confirmed: send a quotation from{' '}
            <Link href="/vendor/enquiries" className="underline underline-offset-2">Enquiries</Link>, and record the payment that confirms it.
          </p>
        </Card>
      )}

      {items && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((w) => (
            <li key={w.id}>
              <Link href={`/vendor/weddings/${w.id}`} className="block">
                <Card variant="clickable" className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-base font-semibold text-[var(--color-text-primary)]">{w.customerName}</p>
                    <span className="shrink-0 text-xs text-[var(--color-text-muted)]">{w.number}</span>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {[weddingDateWords(w.date), w.guestCount ? `${w.guestCount.toLocaleString('en-IN')} guests` : null, w.functions.join(', ')].filter(Boolean).join(' · ')}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={TONE[w.stage]}>{w.stageLabel}</StatusPill>
                    {daysWords(w.stage, w.daysToGo) && <span className="text-xs text-[var(--color-text-muted)]">{daysWords(w.stage, w.daysToGo)}</span>}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
