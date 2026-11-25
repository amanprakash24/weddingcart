import { Card, CardEmptyState } from '@/components/ui/Card';
import StatusPill, { type PillStatus } from '@/components/ui/StatusPill';
import type { WorkView } from '@/services/vendorPayment.service';
import { WORK_STATUS_WORDS, type MoneyTotals, type WorkStatus } from '@/lib/vendor/vendorMoney';

// The vendor's money from Shaadi Shopping (25 Nov 2026): every confirmed work's value, the commission, what they get, what they
// have received and what is left — from lib/vendor/vendorMoney.ts, the same calculation Shaadi Shopping's team sees. Before, this
// screen added up payouts only, so confirmed work showed ₹0.

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

function WorkCard({ work: w }: { work: WorkView }) {
  const m = w.money;
  const received = w.payments.filter((p) => !p.voided);
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{w.coupleName ?? w.weddingNumber} — {w.functionName}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{w.weddingNumber} · {dayLabel(w.functionDate)}</p>
        </div>
        <StatusPill status={WORK_PILL[m.workStatus]}>{WORK_STATUS_WORDS[m.workStatus]}</StatusPill>
      </div>

      <dl className="mt-3 space-y-1 border-t border-[var(--color-border-subtle)] pt-2 text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center justify-between"><dt>Work value</dt><dd className="tabular-nums">{inr(w.agreedPrice)}</dd></div>
        {m.owed && (
          <>
            <div className="flex items-center justify-between">
              <dt>Commission{m.commissionRate !== null ? ` (${m.commissionRate}%)` : ''}</dt>
              <dd className="tabular-nums">{m.commission === null ? 'not set yet' : `− ${inr(m.commission)}`}</dd>
            </div>
            <div className="flex items-center justify-between font-medium text-[var(--color-text-secondary)]"><dt>You get</dt><dd className="tabular-nums">{orDash(m.net)}</dd></div>
            <div className="flex items-center justify-between"><dt>Received</dt><dd className="tabular-nums">{inr(m.paid)}</dd></div>
          </>
        )}
      </dl>
      {m.owed && (
        <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-2">
          <span className="text-xs text-[var(--color-text-muted)]">Left to receive</span>
          <span className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">{orDash(m.remaining)}</span>
        </div>
      )}
      {m.workStatus === 'AWAITING_VENDOR' && <p className="mt-2 text-xs text-[var(--color-text-muted)]">Confirm this booking to have it counted.</p>}
      {received.length > 0 && (
        <ul className="mt-2 space-y-0.5 border-t border-[var(--color-border-subtle)] pt-2 text-xs text-[var(--color-text-muted)]">
          {received.map((p) => (
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

export default function VendorPaymentsScreen({ totals, works }: { totals: MoneyTotals; works: WorkView[] }) {
  // Declined / cancelled work is not owed: shown only if something was paid on it.
  const shown = works.filter((w) => w.money.owed || w.money.workStatus === 'AWAITING_VENDOR' || w.money.paid > 0);
  const open = shown.filter((w) => w.money.owed && (w.money.remaining === null || w.money.remaining > 0));
  const waiting = shown.filter((w) => w.money.workStatus === 'AWAITING_VENDOR');
  const settled = shown.filter((w) => !open.includes(w) && !waiting.includes(w));

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6">
      <header>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Your money from Shaadi Shopping</h1>
        <p className="text-sm text-[var(--color-text-muted)]">For the work Shaadi Shopping booked you for: what it is worth, what you get after commission, what you have received and what is left.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><p className="text-xs text-[var(--color-text-muted)]">Work value</p><p className="mt-1 text-lg font-bold tabular-nums text-[var(--color-text-primary)]">{inr(totals.workValue)}</p><p className="text-xs text-[var(--color-text-muted)]">{totals.works} confirmed {totals.works === 1 ? 'work' : 'works'}</p></Card>
        <Card><p className="text-xs text-[var(--color-text-muted)]">You get</p><p className="mt-1 text-lg font-bold tabular-nums text-[var(--color-text-primary)]">{orDash(totals.net)}</p><p className="text-xs text-[var(--color-text-muted)]">after {totals.commission === null ? 'commission' : `${inr(totals.commission)} commission`}</p></Card>
        <Card><p className="text-xs text-[var(--color-text-muted)]">Received</p><p className="mt-1 text-lg font-bold tabular-nums text-[var(--color-text-primary)]">{inr(totals.paid)}</p></Card>
        <Card><p className="text-xs text-[var(--color-text-muted)]">Left to receive</p><p className="mt-1 text-lg font-bold tabular-nums text-[var(--color-text-primary)]">{orDash(totals.remaining)}</p><p className="text-xs text-[var(--color-text-muted)]">{totals.completed} of {totals.works} completed</p></Card>
      </div>
      {totals.awaitingVendorValue > 0 && <p className="text-xs text-[var(--color-text-muted)]">{inr(totals.awaitingVendorValue)} more is waiting for you to confirm.</p>}

      {shown.length === 0 ? (
        <CardEmptyState title="No work from Shaadi Shopping yet" description="When Shaadi Shopping books you for a wedding, its value and every payment show here." />
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
