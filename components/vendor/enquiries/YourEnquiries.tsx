'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Phone } from 'lucide-react';
import { Card, CardEmptyState, CardSkeleton } from '@/components/ui/Card';
import StatusPill, { type PillStatus } from '@/components/ui/StatusPill';
import type { NextAction } from '@/lib/venue/enquiry';
import type { VenueEnquiryListItem } from '@/services/venueEnquiry.service';

// "Your Enquiries" (Phase C) — the venue's own enquiries from calls, walk-ins, WhatsApp … with the one next step for each, the most
// urgent first. Phone-first: big rows, one tap to open, one tap to call.

const TONE: Record<NextAction['kind'], PillStatus> = {
  FOLLOW_UP_OVERDUE: 'overdue',
  CALL: 'dateHeld',
  FOLLOW_UP_TODAY: 'dateHeld',
  SCHEDULE: 'info',
  FOLLOW_UP_LATER: 'neutral',
  QUOTE_ACCEPTED: 'confirmed',
  QUOTE_CHANGES: 'overdue',
  QUOTE_DRAFT: 'dateHeld',
  QUOTE_WAITING: 'neutral',
  CLOSED: 'neutral',
};

const dateWords = (d: string | null) =>
  d ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(`${d}T12:00:00+05:30`)) : null;

export default function YourEnquiries() {
  const [items, setItems] = useState<VenueEnquiryListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/vendor-os/enquiries')
      .then((r) => r.json())
      .then((body) => {
        if (!live) return;
        if (body.success) setItems(body.data);
        else setError(body.error ?? 'Your enquiries could not be loaded. Please try again.');
      })
      .catch(() => live && setError('Could not reach Vivah OS — please check your connection.'));
    return () => {
      live = false;
    };
  }, []);

  const open = items?.filter((i) => i.next.kind !== 'CLOSED') ?? [];
  const closed = items?.filter((i) => i.next.kind === 'CLOSED') ?? [];

  return (
    <section aria-label="Your enquiries" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-playfair text-2xl font-bold text-[var(--color-text-primary)]">Your Enquiries</h1>
          <p className="text-sm text-[var(--color-text-muted)]">From calls, walk-ins, WhatsApp and more — only you can see these.</p>
        </div>
      </div>
      <Link
        href="/vendor/enquiries/new"
        className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-base font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]"
      >
        <Plus className="h-5 w-5" aria-hidden /> New Enquiry
      </Link>

      {error && <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>}
      {!items && !error && <CardSkeleton lines={3} />}
      {items && items.length === 0 && (
        <CardEmptyState
          title="No enquiries yet"
          description="When someone calls, walks in or messages you about a wedding, add them here. Vivah OS will tell you what to do next."
          icon={<Phone className="h-6 w-6" aria-hidden />}
        />
      )}

      {open.length > 0 && (
        <ul className="space-y-2">
          {open.map((e) => (
            <li key={e.id}>
              <Link href={`/vendor/enquiries/${e.id}`} className="block">
                <Card variant={e.next.kind === 'FOLLOW_UP_OVERDUE' ? 'attention' : 'clickable'} className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-base font-semibold text-[var(--color-text-primary)]">{e.name}</p>
                    <span className="text-xs text-[var(--color-text-muted)]">{e.viaShaadiShopping ? 'Via Shaadi Shopping' : e.channel}</span>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {[dateWords(e.weddingDate) ?? 'Date not decided', e.guestCount ? `${e.guestCount.toLocaleString('en-IN')} guests` : null].filter(Boolean).join(' · ')}
                  </p>
                  <StatusPill status={TONE[e.next.kind]}>Next: {e.next.label}</StatusPill>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {closed.length > 0 && (
        <details className="text-sm text-[var(--color-text-muted)]">
          <summary className="cursor-pointer py-2">Not going ahead ({closed.length})</summary>
          <ul className="space-y-1 pt-1">
            {closed.map((e) => (
              <li key={e.id}>
                <Link href={`/vendor/enquiries/${e.id}`} className="underline underline-offset-2">{e.name}</Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
