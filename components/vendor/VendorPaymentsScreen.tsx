import { Card, CardEmptyState } from '@/components/ui/Card';
import StatusPill, { type PillStatus } from '@/components/ui/StatusPill';
import type { VendorWorkView } from '@/services/vendorPayment.service';
import { WORK_STATUS_WORDS, type VendorTotals, type WorkStatus } from '@/lib/vendor/vendorMoney';

// The vendor's money from Shaadi Shopping. Only their OWN amount for each work, what they have received and what is left
// (money design rule 1, 25 Nov 2026): the couple's price, our commission and margin never reach this screen — the server sends
// VendorWorkView / VendorTotals only (services/vendorPayment.service.ts forVendor).

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const orDash = (n: number | null) => (n === null ? '—' : inr(n));
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const ymdLabel = (ymd: string) => (ymd ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');

const WORK_PILL: Record<WorkStatus, PillStatus> = {
  AWAITING_VENDOR: 'dateHeld',
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'info',
  COMPLETED: 'confirmed',
  DECLINED: 'overdue',
  CANCELLED: 'neutral',
};

function WorkCard({ work: w }: { work: VendorWorkView }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{w.coupleName ?? w.weddingNumber} — {w.functionName}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{w.weddingNumber} · {dayLabel(w.functionDate)}</p>
        </div>
        <StatusPill status={WORK_PILL[w.workStatus]}>{WORK_STATUS_WORDS[w.workStatus]}</StatusPill>
      </div>

      <dl className="mt-3 space-y-1 border-t border-[var(--color-border-subtle)] pt-2 text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center justify-between font-medium text-[var(--color-text-secondary)]"><dt>{w.workStatus === 'AWAITING_VENDOR' ? 'You would be paid' : 'Your amount'}</dt><dd className="tabular-nums">{orDash(w.payable)}</dd></div>
        {(w.owed || w.paid > 0) && <div className="flex items-center justify-between"><dt>Received</dt><dd className="tabular-nums">{inr(w.paid)}</dd></div>}
      </dl>
      {w.owed && (
        <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-2">
          <span className="text-xs text-[var(--color-text-muted)]">Left to receive</span>
          <span className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">{orDash(w.remaining)}</span>
        </div>
      )}
      {w.workStatus === 'AWAITING_VENDOR' && <p className="mt-2 text-xs text-[var(--color-text-muted)]">Confirm this booking (Services) to have it counted.</p>}
      {w.workOrder && (
        <a href={`/vendor/work-orders/${w.workOrder.id}`} className="mt-2 inline-flex min-h-10 items-center text-xs font-semibold text-[var(--color-primary-text)] underline">
          Work order {w.workOrder.number}{w.workOrder.status === 'CANCELLED' ? ' (cancelled)' : ''}
        </a>
      )}
      {w.payments.length > 0 && (
        <ul className="mt-2 space-y-0.5 border-t border-[var(--color-border-subtle)] pt-2 text-xs text-[var(--color-text-muted)]">
          {w.payments.map((p) => (
            <li key={p.id} className="flex flex-wrap justify-between gap-2">
              <span>{ymdLabel(p.paidOn)} · {p.methodLabel}{p.reference ? ` · ref ${p.reference}` : ''}</span>
              <span className="tabular-nums text-[var(--color-text-secondary)]">{inr(p.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function VendorPaymentsScreen({ totals, works }: { totals: VendorTotals; works: VendorWorkView[] }) {
  // Declined / cancelled work is not owed: shown only if something was paid on it.
  const shown = works.filter((w) => w.owed || w.workStatus === 'AWAITING_VENDOR' || w.paid > 0);
  const waiting = shown.filter((w) => w.workStatus === 'AWAITING_VENDOR');
  const open = shown.filter((w) => w.owed && (w.remaining === null || w.remaining > 0));
  const settled = shown.filter((w) => !waiting.includes(w) && !open.includes(w));

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6">
      <header>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Your money from Shaadi Shopping</h1>
        <p className="text-sm text-[var(--color-text-muted)]">For the work Shaadi Shopping booked you for: your amount, what you have received and what is left.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card><p className="text-xs text-[var(--color-text-muted)]">Your amount</p><p className="mt-1 text-lg font-bold tabular-nums text-[var(--color-text-primary)]">{orDash(totals.payable)}</p><p className="text-xs text-[var(--color-text-muted)]">{totals.works} confirmed {totals.works === 1 ? 'work' : 'works'}</p></Card>
        <Card><p className="text-xs text-[var(--color-text-muted)]">Received</p><p className="mt-1 text-lg font-bold tabular-nums text-[var(--color-text-primary)]">{inr(totals.paid)}</p></Card>
        <Card><p className="text-xs text-[var(--color-text-muted)]">Left to receive</p><p className="mt-1 text-lg font-bold tabular-nums text-[var(--color-text-primary)]">{orDash(totals.remaining)}</p><p className="text-xs text-[var(--color-text-muted)]">{totals.completed} of {totals.works} completed</p></Card>
      </div>
      {totals.awaitingPayable !== null && totals.awaitingPayable > 0 && <p className="text-xs text-[var(--color-text-muted)]">{inr(totals.awaitingPayable)} more once you confirm the bookings waiting for you.</p>}

      {shown.length === 0 ? (
        <CardEmptyState title="No work from Shaadi Shopping yet" description="When Shaadi Shopping books you for a wedding, your amount and every payment show here." />
      ) : (
        <>
          {[{ title: 'Waiting for you to confirm', list: waiting }, { title: 'Still to receive', list: open }, { title: 'Settled', list: settled }].map(({ title, list }) =>
            list.length === 0 ? null : (
              <section key={title}>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">{title}</h2>
                <div className="space-y-3">{list.map((w) => <WorkCard key={w.id} work={w} />)}</div>
              </section>
            )
          )}
        </>
      )}
    </div>
  );
}
