'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardSkeleton } from '@/components/ui/Card';
import StatusPill from '@/components/ui/StatusPill';
import { whatsappTo } from '@/lib/venue/enquiry';
import { balanceReminderMessage, daysToWeddingWords, weddingDayWords, type CollectionItem, type VenueCollections } from '@/lib/venue/collections';

// "Money to collect" — the business's OWN bookings and what each couple still owes, the nearest wedding first. Phone-first: one
// card per booking, one tap to open it, one tap to remind the couple from the business's own WhatsApp. Loaded venue-scoped from
// /api/vendor-os/collections; nothing is shown to a member who may not see money, or to a login that is not a business of its own.
// `compact` is the short form for Today: the two totals and a way in, no list.

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function Booking({ item, from }: { item: CollectionItem; from: { businessName: string; payOnLink: boolean } }) {
  const when = [item.weddingDate ? weddingDayWords(item.weddingDate) : 'No wedding date', daysToWeddingWords(item.daysToWedding)].filter(Boolean).join(' · ');
  const late = item.daysToWedding !== null && item.daysToWedding < 0 && item.outstanding > 0;
  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-[var(--color-text-primary)]">{item.customerName}</p>
          <p className={`text-sm ${late ? 'text-[var(--color-danger-text)]' : 'text-[var(--color-text-secondary)]'}`}>{when}</p>
        </div>
        <span className="shrink-0 text-xs text-[var(--color-text-muted)]">{item.quotationNumber}</span>
      </div>

      <dl className="grid grid-cols-3 gap-2 border-t border-[var(--color-border-subtle)] pt-2 text-sm">
        <div>
          <dt className="text-xs text-[var(--color-text-muted)]">Agreed</dt>
          <dd className="tabular-nums text-[var(--color-text-primary)]">{inr(item.total)}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--color-text-muted)]">Received</dt>
          <dd className="tabular-nums text-[var(--color-text-primary)]">{inr(item.received)}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--color-text-muted)]">Still to pay</dt>
          <dd className="font-semibold tabular-nums text-[var(--color-text-primary)]">{inr(item.outstanding)}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={item.confirmed ? 'confirmed' : 'dateHeld'}>{item.stateLabel}</StatusPill>
        {item.claimsToCheck > 0 && <StatusPill status="overdue">Says they have paid — check it</StatusPill>}
      </div>

      <div className="flex flex-wrap gap-x-4 text-sm font-semibold">
        <Link href={`/vendor/enquiries/${item.enquiryId}`} className="inline-flex min-h-11 items-center underline underline-offset-2">
          {item.outstanding > 0 ? 'Open — record a payment' : 'Open'}
        </Link>
        {item.outstanding > 0 && (
          <a href={whatsappTo(item.phone, balanceReminderMessage(item, from))} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-2">
            Remind {item.customerName.split(' ')[0]} on WhatsApp
          </a>
        )}
      </div>
    </Card>
  );
}

export default function MoneyToCollect({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<VenueCollections | null>(null);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/vendor-os/collections')
      .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
      .then(({ status, body }) => {
        if (!live) return;
        if (body.success) setData(body.data);
        else if (status === 401 || status === 403 || status === 404 || status === 409) setHidden(true); // not this person's to see
        else setError(body.error ?? 'Your payments could not be loaded. Please try again.');
      })
      .catch(() => live && setError('Could not reach Vivah OS — please check your connection.'));
    return () => {
      live = false;
    };
  }, []);

  if (hidden) return null;
  // Today only speaks up when there is something to say.
  if (compact && (!data || (data.due.length === 0 && data.receivedThisMonth === 0))) return null;

  const totals = data && (
    <div className="grid grid-cols-2 gap-3">
      <Card>
        <p className="text-xs text-[var(--color-text-muted)]">Still to collect</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-[var(--color-text-primary)]">{inr(data.toCollect)}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{data.due.length === 1 ? 'from 1 booking' : `from ${data.due.length} bookings`}</p>
      </Card>
      <Card>
        <p className="text-xs text-[var(--color-text-muted)]">Received in {data.monthLabel}</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-[var(--color-text-primary)]">{inr(data.receivedThisMonth)}</p>
      </Card>
    </div>
  );

  if (compact) {
    return (
      <section aria-label="Money to collect">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Your own bookings</h2>
        <Link href="/vendor/payments" className="block">{totals}</Link>
      </section>
    );
  }

  return (
    <section aria-label="Money to collect" className="space-y-3">
      <div>
        <h1 className="font-playfair text-2xl font-bold text-[var(--color-text-primary)]">Money to collect</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Your own bookings and what each couple still has to pay — only your business can see these.</p>
      </div>

      {error && <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>}
      {!data && !error && <CardSkeleton lines={2} />}
      {totals}

      {data && data.due.length === 0 && data.paidInFull.length === 0 && (
        <Card>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">No bookings yet</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            A booking appears here when a couple accepts your quotation: send one from{' '}
            <Link href="/vendor/enquiries" className="underline underline-offset-2">Enquiries</Link>.
          </p>
        </Card>
      )}

      {data && data.due.length > 0 && <ul className="space-y-2">{data.due.map((i) => <li key={i.enquiryId}><Booking item={i} from={data} /></li>)}</ul>}

      {data && data.paidInFull.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-[var(--color-text-secondary)]">Paid in full ({data.paidInFull.length})</summary>
          <ul className="mt-2 space-y-2">{data.paidInFull.map((i) => <li key={i.enquiryId}><Booking item={i} from={data} /></li>)}</ul>
        </details>
      )}
    </section>
  );
}
