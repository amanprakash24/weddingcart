import { Card, CardEmptyState } from '@/components/ui/Card';
import StatusPill, { type PillStatus } from '@/components/ui/StatusPill';
import type { VendorPaymentsView, VendorPaymentCard, VendorAwaitingCard } from '@/lib/vendor/paymentsView';

const PAYOUT_STATUS_PILL: Record<VendorPaymentCard['status'], { status: PillStatus; label: string }> = {
  PAID: { status: 'confirmed', label: 'Paid' },
  PENDING: { status: 'info', label: 'Pending' },
  PROCESSING: { status: 'dateHeld', label: 'Processing' },
  FAILED: { status: 'overdue', label: 'Failed' },
};

function PaymentCardView({ payment }: { payment: VendorPaymentCard }) {
  const pill = PAYOUT_STATUS_PILL[payment.status];
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {payment.weddingName} — {payment.function}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {payment.weddingReference} · {payment.eventDate}
          </p>
        </div>
        <StatusPill status={pill.status}>{pill.label}</StatusPill>
      </div>

      <div className="mt-3 space-y-1 border-t border-[var(--color-border-subtle)] pt-2 text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center justify-between">
          <span>Agreed amount</span>
          <span className="tabular-nums">{payment.grossAmountLabel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Commission</span>
          <span className="tabular-nums">− {payment.commissionLabel}</span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-2">
        <span className="text-xs text-[var(--color-text-muted)]">{payment.paidOnLabel ? `Paid on ${payment.paidOnLabel}` : 'Net payout'}</span>
        <span className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">{payment.netAmountLabel}</span>
      </div>
    </Card>
  );
}

function AwaitingCardView({ item }: { item: VendorAwaitingCard }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {item.weddingName} — {item.function}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {item.weddingReference} · Completed {item.eventDate}
          </p>
        </div>
        <StatusPill status="neutral">Awaiting payout calculation</StatusPill>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-2">
        <span className="text-xs text-[var(--color-text-muted)]">Agreed amount</span>
        <span className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">{item.agreedAmountLabel}</span>
      </div>
    </Card>
  );
}

export default function VendorPaymentsScreen({ payments }: { payments: VendorPaymentsView }) {
  const { summary, paid, pending, awaitingCalculation } = payments;
  const isEmpty = paid.length === 0 && pending.length === 0 && awaitingCalculation.length === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6">
      <header>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Payments</h1>
        <p className="text-sm text-[var(--color-text-muted)]">What you&apos;ve been paid and what&apos;s pending, after commission.</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-[var(--color-text-muted)]">Total received</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[var(--color-text-primary)]">{summary.totalReceivedLabel}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--color-text-muted)]">Pending payout</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[var(--color-text-primary)]">{summary.totalPendingLabel}</p>
        </Card>
      </div>

      {isEmpty ? (
        <CardEmptyState title="No payments yet" description="Payouts for completed services will show up here once they're calculated." />
      ) : (
        <>
          {pending.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Pending payout</h2>
              <div className="space-y-3">{pending.map((p) => <PaymentCardView key={p.id} payment={p} />)}</div>
            </section>
          )}

          {awaitingCalculation.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Awaiting payout calculation</h2>
              <p className="mb-2 text-xs text-[var(--color-text-muted)]">
                These services are completed but a payout hasn&apos;t been calculated yet — that happens on our side once the wedding is fully wrapped up.
              </p>
              <div className="space-y-3">{awaitingCalculation.map((item) => <AwaitingCardView key={item.bookingId} item={item} />)}</div>
            </section>
          )}

          {paid.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Paid</h2>
              <div className="space-y-2 opacity-80">{paid.map((p) => <PaymentCardView key={p.id} payment={p} />)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
