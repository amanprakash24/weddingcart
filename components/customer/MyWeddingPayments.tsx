'use client';

import { useState } from 'react';
import { CheckCircle2, CreditCard, Download } from 'lucide-react';
import type { ClientPortalEvent } from '@/services/clientPortal.service';
import type { CustomerReceipt } from '@/lib/payments/customerPayment';
import { upiLink } from '@/lib/payments/upi';

// My Wedding → Payments (22 Nov 2026): the payment plan (booking amount, balance), every payment received with its own receipt,
// and paying by UPI. The plan comes from lib/customer/paymentPlan.ts — the balance is never shown as "the next payment".

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const day = (iso: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
const STEP_TONE = { PAID: 'bg-[#E6F0E9] text-[#1F5C37]', PART_PAID: 'bg-[#F5EEDD] text-[#7A5410]', DUE: 'bg-[#F0ECE7] text-[#4D3E36]' } as const;
const STEP_WORDS = { PAID: 'Paid', PART_PAID: 'Part paid', DUE: 'Due' } as const;

export default function MyWeddingPayments({ event, expert, onReceipt }: { event: ClientPortalEvent; expert: string; onReceipt: (r: CustomerReceipt) => void }) {
  const m = event.money;
  const [amount, setAmount] = useState('');
  if (m.agreed === 0) {
    return (
      <section id="payments" aria-labelledby="c-payments" className="scroll-mt-4 rounded-[22px] border border-[#EADFCC] bg-white p-5 sm:p-6">
        <h2 id="c-payments" className="flex items-center gap-2 text-[17px] font-bold"><CreditCard className="h-5 w-5 text-[#2F6B45]" aria-hidden />Payments</h2>
        <p className="mt-3 text-sm text-[#4D3E36]">Your payments appear here once your quotation is accepted.</p>
      </section>
    );
  }
  const typed = Number(amount.replace(/[,\s₹]/g, ''));
  const typedOk = Number.isInteger(typed) && typed > 0 && typed <= m.due;
  const payLink = m.payTo ? (m.payTo.link ?? (typedOk ? upiLink({ vpa: m.payTo.upiId, payee: m.payTo.payee }, typed, `${event.weddingNumber} payment`) : null)) : null;
  const pct = Math.min(100, Math.round((m.received / m.agreed) * 100));

  return (
    <section id="payments" aria-labelledby="c-payments" className="scroll-mt-4 rounded-[22px] border border-[#EADFCC] bg-white p-5 sm:p-6">
      <h2 id="c-payments" className="flex items-center gap-2 text-[17px] font-bold"><CreditCard className="h-5 w-5 text-[#2F6B45]" aria-hidden />Payments</h2>

      {/* Totals */}
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-[#FBF6EE] px-2 py-3"><dt className="text-xs text-[#6B5A4E]">Agreed</dt><dd className="mt-0.5 font-bold tabular-nums">{inr(m.agreed)}</dd></div>
        <div className="rounded-xl bg-[#E6F0E9] px-2 py-3"><dt className="text-xs text-[#1F5C37]">Paid</dt><dd className="mt-0.5 font-bold tabular-nums text-[#1F5C37]">{inr(m.received)}</dd></div>
        <div className="rounded-xl bg-[#FBF6EE] px-2 py-3"><dt className="text-xs text-[#6B5A4E]">Balance</dt><dd className="mt-0.5 font-bold tabular-nums">{inr(m.due)}</dd></div>
      </dl>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#F0E6D6]" role="progressbar" aria-label="Paid so far" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-[#2F6B45]" style={{ width: `${pct}%` }} />
      </div>

      {/* Payment plan */}
      <h3 className="mt-6 text-sm font-bold uppercase tracking-[0.12em] text-[#8A6A2F]">Payment plan</h3>
      <ol className="mt-2 space-y-2">
        {m.plan.steps.map((s) => (
          <li key={s.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#F0E6D6] px-3.5 py-3">
            <div className="min-w-0">
              <p className="font-semibold">{s.label}</p>
              {s.note && <p className="text-xs text-[#6B5A4E]">{s.note}</p>}
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
        <div className="mt-4 rounded-xl bg-[#FBF6EE] p-4">
          {m.plan.next ? (
            <p className="text-sm">Next: <b>{inr(m.plan.next.amount)}</b> <span className="text-[#6B5A4E]">· {m.plan.next.label.toLowerCase()}</span></p>
          ) : (
            <p className="text-sm text-[#4D3E36]">Your booking amount is paid. {expert} will share the dates for the balance.</p>
          )}
          {m.payTo ? (
            <div className="mt-3 space-y-2">
              {!m.payTo.link && (
                <label className="grid gap-1 text-sm text-[#4D3E36]">
                  Amount to pay ₹
                  <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Up to ${inr(m.due)}`} className="min-h-11 rounded-xl border border-[#E2D3BC] bg-white px-3 text-base" aria-label="Amount to pay" />
                  {amount && !typedOk && <span role="alert" className="text-xs text-[#B42318]">Enter whole rupees, up to {inr(m.due)}.</span>}
                </label>
              )}
              {payLink ? (
                <a href={payLink} className="flex min-h-11 items-center justify-center rounded-xl bg-[#7A1238] text-sm font-bold text-white">Pay {m.payTo.link ? inr(m.plan.next?.amount ?? 0) : inr(typed)} by UPI</a>
              ) : (
                <span aria-disabled className="flex min-h-11 items-center justify-center rounded-xl bg-[#7A1238]/40 text-sm font-bold text-white">Pay by UPI</span>
              )}
              <p className="text-xs text-[#6B5A4E]">To {m.payTo.payee} · {m.payTo.upiId}. After paying, tell us on WhatsApp so we can confirm it. It shows here as paid once we have checked it.</p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-[#6B5A4E]">Ask {expert} how to pay.</p>
          )}
        </div>
      )}

      {/* Payments received */}
      <h3 className="mt-6 text-sm font-bold uppercase tracking-[0.12em] text-[#8A6A2F]">Payments received</h3>
      {m.receipts.length === 0 ? (
        <p className="mt-2 text-sm text-[#4D3E36]">No payments received yet. Each payment appears here with its receipt.</p>
      ) : (
        <ul className="mt-2 divide-y divide-[#F0E6D6] rounded-xl border border-[#F0E6D6]">
          {m.receipts.map((r) => (
            <li key={r.number} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-semibold tabular-nums"><CheckCircle2 className="h-4 w-4 text-[#2F6B45]" aria-hidden />{inr(r.amount)} <span className="font-normal text-[#6B5A4E]">· {r.method}</span></p>
                <p className="text-xs text-[#6B5A4E]">{day(r.paidAt)} · {r.number}{r.reference && <> · Ref {r.reference}</>}</p>
              </div>
              <button type="button" onClick={() => onReceipt(r)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#E2D3BC] px-4 text-sm font-semibold text-[#7A1238]">
                <Download className="h-4 w-4" aria-hidden />Receipt
              </button>
            </li>
          ))}
          <li className="flex justify-between px-3.5 py-2.5 text-sm font-bold"><span>Total received</span><span className="tabular-nums text-[#1F5C37]">{inr(m.receipts.reduce((s, r) => s + r.amount, 0))}</span></li>
        </ul>
      )}
    </section>
  );
}
