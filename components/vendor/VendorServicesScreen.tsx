'use client';

import { useState } from 'react';
import { Card, CardEmptyState } from '@/components/ui/Card';
import StatusPill, { type PillStatus } from '@/components/ui/StatusPill';
import Tabs, { type TabItem } from '@/components/ui/Tabs';
import Button from '@/components/ui/Button';
import type { VendorServiceCard } from '@/lib/vendor/servicesView';
import { VENUE_STATUS_LABEL, VENUE_ADVANCE_LABEL } from './venueStatusLabels';

// Small, deliberate duplication of components/vendor/VendorWeddingsScreen.tsx's identical booking-status
// mapping — that map lives inside each screen component, not a pure lib function, so it isn't worth
// extracting for one 6-line object. The venue-setup labels below WERE worth extracting once a second
// screen (VendorWeddingsScreen) needed them too — see ./venueStatusLabels.ts.
const BOOKING_STATUS_PILL: Record<VendorServiceCard['status'], { status: PillStatus; label: string }> = {
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
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

function ServiceCard({ service, isVenue, onAdvanceVenueStatus, advancing }: { service: VendorServiceCard; isVenue: boolean; onAdvanceVenueStatus: (bookingId: string, next: VendorServiceCard['venueStatus']) => void; advancing: boolean }) {
  const pill = BOOKING_STATUS_PILL[service.status];
  return (
    <Card variant={service.bucket === 'needs-attention' ? 'attention' : 'default'}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {service.weddingName} — {service.function}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {service.weddingReference} · {dateLabel(service.date)}
            {service.startTime ? ` · ${service.startTime}` : ''}
            {service.venueName ? ` · ${service.venueName}` : service.city ? ` · ${service.city}` : ''}
          </p>
        </div>
        <StatusPill status={pill.status}>{pill.label}</StatusPill>
      </div>

      {service.serviceName && (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          {service.serviceName}
          {service.serviceDescription ? `: ${service.serviceDescription}` : ''}
        </p>
      )}

      {service.nextAction && <p className="mt-2 text-sm font-medium text-[var(--color-text-primary)]">{service.nextAction}</p>}

      {isVenue && service.status !== 'DECLINED' && service.status !== 'CANCELLED' && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--color-border-subtle)] pt-2">
          <span className="text-xs text-[var(--color-text-muted)]">{VENUE_STATUS_LABEL[service.venueStatus]}</span>
          {service.nextVenueStatus && (
            <Button size="small" variant="outline" disabled={advancing} onClick={() => onAdvanceVenueStatus(service.bookingId, service.nextVenueStatus as VendorServiceCard['venueStatus'])}>
              {VENUE_ADVANCE_LABEL[service.venueStatus]}
            </Button>
          )}
        </div>
      )}

      {/* IMPORTANT: this is the vendor's own agreed price for this one service — never the wedding's
          invoice, budget, amount paid, or outstanding balance. That data isn't in this query at all. */}
      <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-2">
        <span className="text-xs text-[var(--color-text-muted)]">Agreed amount</span>
        <span className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">₹{service.agreedAmount.toLocaleString('en-IN')}</span>
      </div>
    </Card>
  );
}

export default function VendorServicesScreen({ services: initialServices, isVenue = false }: { services: VendorServiceCard[]; isVenue?: boolean }) {
  const [services, setServices] = useState(initialServices);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  const advanceVenueStatus = async (bookingId: string, next: VendorServiceCard['venueStatus']) => {
    setAdvancingId(bookingId);
    try {
      const res = await fetch(`/api/vendor/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueStatus: next }),
      });
      const body = await res.json();
      if (res.ok && body.success) {
        setServices((current) => current.map((s) => (s.bookingId === bookingId ? { ...s, venueStatus: next, nextVenueStatus: body.data.venueStatus === 'COMPLETED' ? null : s.nextVenueStatus } : s)));
      }
    } finally {
      setAdvancingId(null);
    }
  };

  const attention = services.filter((s) => s.bucket === 'needs-attention');
  const upcoming = services.filter((s) => s.bucket === 'upcoming');
  const completed = services.filter((s) => s.bucket === 'completed');
  const filtered = filter === 'all' ? upcoming : services.filter((s) => s.bucket === filter);
  const showAttentionSection = filter === 'all' && attention.length > 0;
  const showCompletedSection = filter === 'all' && completed.length > 0;

  const renderCard = (s: VendorServiceCard) => <ServiceCard key={s.bookingId} service={s} isVenue={isVenue} onAdvanceVenueStatus={advanceVenueStatus} advancing={advancingId === s.bookingId} />;

  if (services.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6">
        <header>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Services</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Services you&apos;re booked to provide.</p>
        </header>
        <CardEmptyState title="You don't have any assigned services yet" description="Services you're booked for will show up here once a booking is confirmed." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6">
      <header>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Services</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Services you&apos;re booked to provide.</p>
      </header>

      <Tabs tabs={FILTERS} active={filter} onChange={setFilter} ariaLabel="Filter services" />

      {showAttentionSection && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Needs attention</h2>
          <div className="space-y-3">{attention.map(renderCard)}</div>
        </section>
      )}

      <section>
        {filter === 'all' && <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Upcoming</h2>}
        {filtered.length === 0 ? <CardEmptyState title={filter === 'all' ? 'No upcoming services' : 'No services match this filter'} /> : <div className="space-y-3">{filtered.map(renderCard)}</div>}
      </section>

      {showCompletedSection && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Completed</h2>
          <div className="space-y-2 opacity-80">{completed.map(renderCard)}</div>
        </section>
      )}
    </div>
  );
}
