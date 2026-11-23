'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, CreditCard, Download } from 'lucide-react';
import type { ClientPortalEvent } from '@/services/clientPortal.service';
import type { CustomerReceipt } from '@/lib/payments/customerPayment';
import { upiLink } from '@/lib/payments/upi';

// My Wedding → Payments (22 Nov 2026): the payment plan (booking amount, balance), every payment received with its own receipt,
// and paying by UPI. The plan comes from lib/customer/paymentPlan.ts — the balance is never shown as "the next payment".

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const day = (iso: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
const STEP_TONE = { PAID: 'bg-[#DCF3E5] text-[#14532D]', PART_PAID: 'bg-[#FEF3C7] text-[#78350F]', DUE: 'bg-white/70 text-[#374151]' } as const;
const STEP_WORDS = { PAID: 'Paid', PART_PAID: 'Part paid', DUE: 'Due' } as const;

export default function MyWeddingPayments({ event, expert, onReceipt }: { event: ClientPortalEvent; expert: string; onReceipt: (r: CustomerReceipt) => void }) {
  const m = event.money;
  const [amount, setAmount] = useState('');
  if (m.agreed === 0) {
    return (
      <section id="payments" aria-labelledby="c-payments" className="os-glass scroll-mt-4 rounded-[22px] border bg-white p-5 sm:p-6">
        <h2 id="c-payments" className="flex items-center gap-2 text-[17px] font-bold"><CreditCard className="h-5 w-5 text-[#15803D]" aria-hidden />Payments</h2>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Your payments appear here once your quotation is accepted.</p>
      </section>
    );
  }
  const typed = Number(amount.replace(/[,\s₹]/g, ''));
  const typedOk = Number.isInteger(typed) && typed > 0 && typed <= m.due;
  const payLink = m.payTo ? (m.payTo.link ?? (typedOk ? upiLink({ vpa: m.payTo.upiId, payee: m.payTo.payee }, typed, `${event.weddingNumber} payment`) : null)) : null;
  const pct = Math.min(100, Math.round((m.received / m.agreed) * 100));

  return (
    <section id="payments" aria-labelledby="c-payments" className="os-glass scroll-mt-4 rounded-[22px] border bg-white p-5 sm:p-6">
      <h2 id="c-payments" className="flex items-center gap-2 text-[17px] font-bold"><CreditCard className="h-5 w-5 text-[#15803D]" aria-hidden />Payments</h2>

      {/* Totals */}
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white/60 px-2 py-3"><dt className="text-xs text-[var(--color-text-muted)]">Agreed</dt><dd className="mt-0.5 font-bold tabular-nums">{inr(m.agreed)}</dd></div>
        <div className="rounded-xl bg-[#DCF3E5] px-2 py-3"><dt className="text-xs text-[#14532D]">Paid</dt><dd className="mt-0.5 font-bold tabular-nums text-[#14532D]">{inr(m.received)}</dd></div>
        <div className="rounded-xl bg-white/60 px-2 py-3"><dt className="text-xs text-[var(--color-text-muted)]">Balance</dt><dd className="mt-0.5 font-bold tabular-nums">{inr(m.due)}</dd></div>
      </dl>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/70" role="progressbar" aria-label="Paid so far" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
      </div>

      {/* Payment plan */}
      <h3 className="mt-6 text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-primary-text)]">Payment plan</h3>
      <ol className="mt-2 space-y-2">
        {m.plan.steps.map((s) => (
          <li key={s.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/70 px-3.5 py-3">
            <div className="min-w-0">
              <p className="font-semibold">{s.label}</p>
              {s.note && <p className="text-xs text-[var(--color-text-muted)]">{s.note}</p>}
            </div>
            <div className="ml-auto text-right">
              <p className="font-bold tabular-nums">{inr(s.amount)}</p>
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STEP_TONE[s.status]}`}>
                {s.status === 'PART_PAID' ? `${inr(s.paid)} paid · ${inr(s.remaining)} left` : STEP_WORDS[s.status]}
              </span>
            </div>
          </li>
        ))}
      </ol>

      {/* Pay */}
      {m.due > 0 && (
        <div className="mt-4 rounded-xl bg-white/60 p-4">
          {m.plan.next ? (
            <p className="text-sm">Next: <b>{inr(m.plan.next.amount)}</b> <span className="text-[var(--color-text-muted)]">· {m.plan.next.label.toLowerCase()}</span></p>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">Your booking amount is paid. {expert} will share the dates for the balance.</p>
          )}
          {m.payTo ? (
            <div className="mt-3 space-y-2">
              {!m.payTo.link && (
                <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">
                  Amount to pay ₹
                  <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Up to ${inr(m.due)}`} className="min-h-11 rounded-xl border border-[var(--color-border-default)] bg-white px-3 text-base" aria-label="Amount to pay" />
                  {amount && !typedOk && <span role="alert" className="text-xs text-[#B42318]">Enter whole rupees, up to {inr(m.due)}.</span>}
                </label>
              )}
              {payLink ? (
                <a href={payLink} className="flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-bold text-white">Pay {m.payTo.link ? inr(m.plan.next?.amount ?? 0) : inr(typed)} by UPI</a>
              ) : (
                <span aria-disabled className="flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)]/40 text-sm font-bold text-white">Pay by UPI</span>
              )}
              <p className="text-xs text-[var(--color-text-muted)]">To {m.payTo.payee} · {m.payTo.upiId}. After paying, send us the payment details below. It shows here as paid once we have checked it with the bank.</p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">Ask {expert} how to pay.</p>
          )}
        </div>
      )}

      {/* "I have paid" (22 Nov 2026): sent from here, signed in — never through the open link once the wedding exists */}
      {(m.canClaim || m.claims.length > 0) && <ClaimBox event={event} />}

      {/* Payments received */}
      <h3 className="mt-6 text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-primary-text)]">Payments received</h3>
      {m.receipts.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">No payments received yet. Each payment appears here with its receipt.</p>
      ) : (
        <ul className="mt-2 divide-y divide-white/70 rounded-xl border border-white/70">
          {m.receipts.map((r) => (
            <li key={r.number} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-semibold tabular-nums"><CheckCircle2 className="h-4 w-4 text-[#15803D]" aria-hidden />{inr(r.amount)} <span className="font-normal text-[var(--color-text-muted)]">· {r.method}</span></p>
                <p className="text-xs text-[var(--color-text-muted)]">{day(r.paidAt)} · {r.number}{r.reference && <> · Ref {r.reference}</>}</p>
              </div>
              <button type="button" onClick={() => onReceipt(r)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--color-border-default)] px-4 text-sm font-semibold text-[var(--color-primary-text)]">
                <Download className="h-4 w-4" aria-hidden />Receipt
              </button>
            </li>
          ))}
          <li className="flex justify-between px-3.5 py-2.5 text-sm font-bold"><span>Total received</span><span className="tabular-nums text-[#14532D]">{inr(m.receipts.reduce((s, r) => s + r.amount, 0))}</span></li>
        </ul>
      )}
    </section>
  );
}

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const dayShort = (iso: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
const claimField = 'min-h-11 w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 text-base';

// "I have paid": the couple sends the UTR (and, if they like, a screenshot) for staff to match with the bank. A claim is never money.
function ClaimBox({ event }: { event: ClientPortalEvent }) {
  const router = useRouter();
  const m = event.money;
  const [amount, setAmount] = useState(m.plan.next ? String(m.plan.next.amount) : '');
  const [utr, setUtr] = useState('');
  const [paidOn, setPaidOn] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const value = Number(amount.replace(/[,\s₹]/g, ''));
  const amountOk = Number.isInteger(value) && value > 0 && value <= m.due;
  const ok = amountOk && utr.trim().length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !ok) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append('amount', String(value));
    fd.append('utr', utr.trim());
    if (paidOn) fd.append('paidOn', paidOn);
    if (proof) fd.append('proof', proof);
    try {
      const res = await fetch(`/api/customer/weddings/${event.id}/payment-claims`, { method: 'POST', body: fd });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not send. Please try again.');
      setSent(true);
      setUtr('');
      setPaidOn('');
      setProof(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6">
      <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-primary-text)]">I have paid</h3>
      {sent && <p role="status" className="mt-2 rounded-xl bg-[#DCF3E5] px-3 py-2 text-sm text-[#14532D]">Thank you — we have your payment details. We check them with the bank and your receipt appears here.</p>}
      {m.canClaim ? (
        <form onSubmit={submit} className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-3 rounded-2xl border border-white/70 bg-white/60 p-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">Amount paid ₹
            <input aria-label="Amount paid" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={claimField} />
          </label>
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">UTR / transaction reference
            <input aria-label="UTR or transaction reference" value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="12 digits, e.g. 412345678901" autoComplete="off" className={`${claimField} font-mono`} />
          </label>
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">Date paid <span className="text-xs text-[var(--color-text-muted)]">(today if blank)</span>
            <input aria-label="Date paid" type="date" max={today()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={claimField} />
          </label>
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">Screenshot <span className="text-xs text-[var(--color-text-muted)]">(optional — photo or PDF, under 5 MB)</span>
            <input aria-label="Payment screenshot" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" onChange={(e) => setProof(e.target.files?.[0] ?? null)} className="w-full min-w-0 text-sm" />
          </label>
          {amount && !amountOk && <p className="text-sm text-[#78350F] sm:col-span-2">Enter whole rupees, up to {inr(m.due)}.</p>}
          {error && <p role="alert" className="text-sm text-[#B42318] sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy || !ok} className="min-h-11 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Sending…' : 'Send payment details'}</button>
          </div>
        </form>
      ) : (
        m.due > 0 && <p className="mt-2 text-sm text-[var(--color-text-secondary)]">We are still checking the payments you sent. Please wait for us, or call us.</p>
      )}
      {m.claims.length > 0 && (
        <ul className="mt-3 space-y-2">
          {m.claims.map((c) => (
            <li key={c.id} className={`rounded-xl px-3.5 py-2.5 text-sm ${c.status === 'PENDING' ? 'bg-[#FEF3C7] text-[#78350F]' : 'bg-[#FDE8E7] text-[#B42318]'}`}>
              <b className="tabular-nums">{inr(c.amount)}</b> · UTR {c.utr} · {c.status === 'PENDING' ? 'being checked' : 'could not be matched'} <span className="opacity-80">· sent {dayShort(c.submittedAt)}</span>
              {c.rejectReason && <span className="block text-xs">{c.rejectReason}. Please check the UTR and send it again, or call us.</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
