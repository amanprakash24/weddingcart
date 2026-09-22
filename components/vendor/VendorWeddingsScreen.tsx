'use client';

import { useMemo, useState } from 'react';
import { Card, CardEmptyState } from '@/components/ui/Card';
import { Row } from '@/components/ui/Row';
import StatusPill, { type PillStatus } from '@/components/ui/StatusPill';
import Tabs, { type TabItem } from '@/components/ui/Tabs';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import type { VendorWeddingCard } from '@/lib/vendor/weddingsView';
import { VENUE_STATUS_LABEL, VENUE_ADVANCE_LABEL } from './venueStatusLabels';

type Booking = VendorWeddingCard['bookings'][number];

const BOOKING_STATUS_PILL: Record<Booking['status'], { status: PillStatus; label: string }> = {
  PENDING_VENDOR_CONFIRMATION: { status: 'info', label: 'Awaiting your response' },
  CONFIRMED: { status: 'confirmed', label: 'Confirmed' },
  DECLINED: { status: 'overdue', label: 'Declined' },
  CUSTOMER_APPROVAL_PENDING: { status: 'info', label: 'Awaiting customer approval' },
  CANCELLED: { status: 'neutral', label: 'Cancelled' },
  COMPLETED: { status: 'confirmed', label: 'Completed' },
};

type FilterKey = 'all' | 'upcoming' | 'needs-attention' | 'completed';
const FILTERS: TabItem<FilterKey>[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'needs-attention', label: 'Needs Attention' },
  { key: 'completed', label: 'Completed' },
];

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function WeddingCard({ wedding, isVenue, onAdvanceVenueStatus, advancingBookingId }: { wedding: VendorWeddingCard; isVenue: boolean; onAdvanceVenueStatus: (weddingId: string, bookingId: string, next: Booking['venueStatus']) => void; advancingBookingId: string | null }) {
  return (
    <Card variant={wedding.overallStatus === 'needs-attention' ? 'attention' : 'default'}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{wedding.name}</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {wedding.reference} · {wedding.city}
            {wedding.guestCount ? ` · ${wedding.guestCount} guests` : ''}
          </p>
        </div>
        {wedding.overallStatus === 'completed' && <StatusPill status="neutral">Completed</StatusPill>}
      </div>

      {wedding.nextAction && <p className="mt-2 text-sm font-medium text-[var(--color-text-primary)]">{wedding.nextAction}</p>}

      <div className="mt-3 divide-y divide-[var(--color-border-subtle)]">
        {wedding.bookings.map((booking) => {
          const pill = BOOKING_STATUS_PILL[booking.status];
          const showVenueRow = isVenue && booking.status !== 'DECLINED' && booking.status !== 'CANCELLED';
          return (
            <div key={booking.id} className="py-1">
              <Row
                title={`${booking.function} — ${dateLabel(booking.date)}${booking.startTime ? ` · ${booking.startTime}` : ''}`}
                meta={[booking.service, booking.venueName, booking.overdueTasks[0] ? `${booking.overdueTasks[0].title} overdue` : null].filter(Boolean).join(' · ')}
                variant={booking.overdueTasks.length > 0 ? 'attention' : 'default'}
                right={
                  <>
                    <span className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">₹{booking.amount.toLocaleString('en-IN')}</span>
                    <StatusPill status={pill.status}>{pill.label}</StatusPill>
                  </>
                }
              />
              {showVenueRow && (
                <div className="flex items-center justify-between gap-2 pb-2 pl-0.5">
                  <span className="text-xs text-[var(--color-text-muted)]">{VENUE_STATUS_LABEL[booking.venueStatus]}</span>
                  {booking.nextVenueStatus && (
                    <Button
                      size="small"
                      variant="outline"
                      disabled={advancingBookingId === booking.id}
                      onClick={() => onAdvanceVenueStatus(wedding.weddingId, booking.id, booking.nextVenueStatus as Booking['venueStatus'])}
                    >
                      {VENUE_ADVANCE_LABEL[booking.venueStatus]}
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function VendorWeddingsScreen({ weddings: initialWeddings, isVenue = false }: { weddings: VendorWeddingCard[]; isVenue?: boolean }) {
  const [weddings, setWeddings] = useState(initialWeddings);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [advancingBookingId, setAdvancingBookingId] = useState<string | null>(null);

  const advanceVenueStatus = async (weddingId: string, bookingId: string, next: Booking['venueStatus']) => {
    setAdvancingBookingId(bookingId);
    try {
      const res = await fetch(`/api/vendor/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueStatus: next }),
      });
      const body = await res.json();
      if (res.ok && body.success) {
        setWeddings((current) =>
          current.map((w) =>
            w.weddingId !== weddingId
              ? w
              : { ...w, bookings: w.bookings.map((b) => (b.id === bookingId ? { ...b, venueStatus: next, nextVenueStatus: next === 'COMPLETED' ? null : b.nextVenueStatus } : b)) }
          )
        );
      }
    } finally {
      setAdvancingBookingId(null);
    }
  };

  const bySearch = useMemo(() => {
    if (!query.trim()) return weddings;
    const q = query.toLowerCase();
    return weddings.filter((w) => `${w.name} ${w.reference} ${w.city}`.toLowerCase().includes(q));
  }, [weddings, query]);

  // On the "All" tab, split into three non-overlapping sections (a needs-attention wedding is never
  // repeated under the general list below it — same "don't duplicate Needs Attention into Next Up"
  // principle as the Wedding Control Room). Any other tab is a single flat list for that status.
  const attention = bySearch.filter((w) => w.overallStatus === 'needs-attention');
  const upcoming = bySearch.filter((w) => w.overallStatus === 'upcoming');
  const completed = bySearch.filter((w) => w.overallStatus === 'completed');
  const filtered = filter === 'all' ? upcoming : bySearch.filter((w) => w.overallStatus === filter);
  const showAttentionSection = filter === 'all' && attention.length > 0;
  const showCompletedSection = filter === 'all' && completed.length > 0;

  const renderCard = (w: VendorWeddingCard) => <WeddingCard key={w.weddingId} wedding={w} isVenue={isVenue} onAdvanceVenueStatus={advanceVenueStatus} advancingBookingId={advancingBookingId} />;

  if (weddings.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6">
        <header>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Weddings</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Weddings you&apos;re providing services for.</p>
        </header>
        <CardEmptyState title="You don't have any assigned weddings yet" description="Weddings you're booked for will show up here once a booking is confirmed." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6">
      <header>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Weddings</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Weddings you&apos;re providing services for.</p>
      </header>

      <Tabs tabs={FILTERS} active={filter} onChange={setFilter} ariaLabel="Filter weddings" />

      {weddings.length > 4 && <Input placeholder="Search by name, reference, or city" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search weddings" />}

      {showAttentionSection && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Needs attention</h2>
          <div className="space-y-3">{attention.map(renderCard)}</div>
        </section>
      )}

      <section>
        {filter === 'all' && <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Upcoming weddings</h2>}
        {filtered.length === 0 ? <CardEmptyState title={filter === 'all' ? 'No upcoming weddings' : 'No weddings match this filter'} /> : <div className="space-y-3">{filtered.map(renderCard)}</div>}
      </section>

      {showCompletedSection && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Recent / completed</h2>
          <div className="space-y-2 opacity-80">{completed.map(renderCard)}</div>
        </section>
      )}
    </div>
  );
}
