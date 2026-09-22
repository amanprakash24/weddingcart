import { Card, CardEmptyState } from '@/components/ui/Card';
import { Row } from '@/components/ui/Row';
import StatusPill, { type PillStatus } from '@/components/ui/StatusPill';
import type { AvailabilityMonthGroup, VendorAvailabilityRow } from '@/lib/vendor/availabilityView';

const STATUS_PILL: Record<VendorAvailabilityRow['status'], { status: PillStatus; label: string }> = {
  AVAILABLE: { status: 'confirmed', label: 'Available' },
  TENTATIVE: { status: 'dateHeld', label: 'Tentative' },
  BOOKED: { status: 'neutral', label: 'Booked' },
  BLOCKED: { status: 'overdue', label: 'Blocked' },
};

function dayLabel(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

export default function VendorAvailabilityScreen({ months }: { months: AvailabilityMonthGroup[] }) {
  const isEmpty = months.every((m) => m.entries.length === 0);

  if (months.length === 0 || isEmpty) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6">
        <header>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Availability</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Your availability for the next 90 days.</p>
        </header>
        <CardEmptyState title="No availability has been recorded yet" description="Dates you're available, tentative, or blocked will show up here." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6">
      <header>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Availability</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Your availability for the next 90 days.</p>
      </header>

      {months.map((month) => (
        <section key={month.monthKey}>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">{month.monthLabel}</h2>
          <Card>
            {month.entries.map((entry) => {
              const pill = STATUS_PILL[entry.status];
              return <Row key={entry.date} title={dayLabel(entry.date)} meta={entry.note ?? undefined} right={<StatusPill status={pill.status}>{pill.label}</StatusPill>} />;
            })}
          </Card>
        </section>
      ))}
    </div>
  );
}
