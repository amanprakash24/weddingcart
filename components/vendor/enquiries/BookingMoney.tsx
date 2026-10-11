'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import Input from '@/components/ui/Input';
import { whatsappTo } from '@/lib/venue/enquiry';
import { TO_CHECK_CHANGED } from '@/components/vendor/vendorNav';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, paymentRequestMessage, type PaymentMethod } from '@/lib/venue/payment';
import { claimNotReceivedMessage, claimReceivedMessage } from '@/lib/payments/claimMessages';
import type { VenueBookingMoney, VenueClaim, VenueQuotationState, VenueQuotationView } from '@/services/venueQuotation.service';

// The money on a venue's own booking (Phase C): what has been received, what still confirms the booking, and "record a payment".
// The venue records what arrived — cash, UPI, bank transfer or cheque; nothing is charged from here. A part payment holds the
// date; the booking is confirmed by itself once the amount to confirm is in.

const big = 'flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold';
const primary = `${big} w-full bg-[var(--primary)] text-[var(--color-on-primary)] disabled:opacity-50`;
const secondary = `${big} w-full border border-[var(--color-border-default)] text-[var(--color-text-primary)] disabled:opacity-50`;

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const istDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const dayWords = (iso: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
// One key per open form: sending the same form twice (double tap, retry) records the payment once.
const newKey = () => `venue-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// "I have paid" from the couple's link. Nothing is counted until the business has seen the money in its own account and says so.
function Claims({ claims, first, busy, onClaim, tell }: { claims: VenueClaim[]; first: string; busy: boolean; onClaim: (claim: VenueClaim, body: { received: boolean; reason?: string }) => Promise<boolean>; tell: (c: VenueClaim) => string }) {
  const [refusing, setRefusing] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const waiting = claims.filter((c) => c.status === 'PENDING');
  const refused = claims.filter((c) => c.status === 'REJECTED');
  return (
    <section aria-label="Payments to check" className="space-y-2">
      {waiting.map((c) => (
        <div key={c.id} className="space-y-3 rounded-lg border border-[var(--color-warning-text)] bg-[var(--color-warning-bg)] p-3 text-sm">
          <p className="font-semibold text-[var(--color-text-primary)]">{first} says they paid {inr(c.amount)} by UPI</p>
          <p className="text-[var(--color-text-secondary)]">
            UPI reference (UTR) <span className="font-mono text-[var(--color-text-primary)]">{c.utr}</span> · {c.paidOn ? `paid ${dayWords(c.paidOn)}` : `sent ${dayWords(c.sentAt)}`}
          </p>
          {c.note && <p className="text-[var(--color-text-secondary)]">“{c.note}”</p>}
          {c.proofUrl && <a href={c.proofUrl} target="_blank" rel="noopener noreferrer" className="inline-block font-semibold text-[var(--primary)] underline">See their screenshot</a>}
          <p className="text-xs text-[var(--color-text-muted)]">Look for this money in your bank or UPI app first. It is not counted until you say you received it.</p>
          {refusing === c.id ? (
            <>
              <Input label={`What should ${first} know?`} value={reason} onChange={(ev) => setReason(ev.target.value)} helperText={`${first} will read this on their link`} placeholder="e.g. We cannot find this reference" className="min-h-12 text-base" />
              <button type="button" disabled={busy || reason.trim().length < 3} onClick={async () => { if (await onClaim(c, { received: false, reason })) { setRefusing(null); setReason(''); } }} className={primary}>{busy ? 'Saving…' : `Tell ${first} it was not received`}</button>
              <button type="button" disabled={busy} onClick={() => setRefusing(null)} className={secondary}>Back</button>
            </>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={() => onClaim(c, { received: true })} className={primary}>{busy ? 'Saving…' : `Yes, I received ${inr(c.amount)}`}</button>
              <button type="button" disabled={busy} onClick={() => { setReason(''); setRefusing(c.id); }} className={secondary}>Not received</button>
            </>
          )}
        </div>
      ))}
      {refused.map((c) => (
        <p key={c.id} className="text-xs text-[var(--color-text-muted)]">
          {inr(c.amount)} · UTR {c.utr} — you marked it as not received{c.rejectReason && <>: {c.rejectReason}</>}.{' '}
          <a href={tell(c)} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--primary)] underline">Tell {first} on WhatsApp</a>
        </p>
      ))}
    </section>
  );
}

export default function BookingMoney({
  q,
  money,
  state,
  busy,
  errors,
  onPay,
  onClaim,
}: {
  q: VenueQuotationView;
  money: VenueBookingMoney;
  state: VenueQuotationState;
  busy: boolean;
  errors: Record<string, string>;
  onPay: (body: Record<string, string>) => Promise<boolean>;
  onClaim: (claimId: string, body: { received: boolean; reason?: string }) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(istDay());
  const [key, setKey] = useState(newKey);
  // The claim just marked as received: it is a payment now, so it is gone from the list — this keeps "tell them" on screen.
  const [justReceived, setJustReceived] = useState<{ amount: number } | null>(null);

  const first = state.customer.name.split(' ')[0];
  const fullyPaid = money.outstanding === 0;
  // What to ask the customer for next: the rest of the amount that confirms the booking, then the balance.
  const due = money.confirmed ? money.outstanding : money.toConfirmRemaining;

  function start() {
    setAmount(due > 0 ? String(due) : '');
    setReference('');
    setPaidOn(istDay());
    setKey(newKey());
    setOpen(true);
  }

  async function save() {
    if (await onPay({ amount, method, reference, paidOn, idempotencyKey: key })) setOpen(false);
  }

  const request = whatsappTo(
    state.customer.phone,
    paymentRequestMessage({ customerName: state.customer.name, venueName: state.venueName, number: q.number, amount: due, confirmsBooking: !money.confirmed, upiId: state.payTo?.upiId ?? null, upiName: state.payTo?.upiName ?? null })
  );

  return (
    <div className="space-y-3">
      <p className={`rounded-lg p-3 text-sm font-semibold ${money.confirmed ? 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]' : money.holdOver ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]' : 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]'}`}>
        {money.stateLabel}
      </p>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between text-[var(--color-text-primary)]"><dt>Received</dt><dd>{inr(money.received)}</dd></div>
        {!money.confirmed && <div className="flex justify-between font-semibold text-[var(--color-text-primary)]"><dt>Still needed to confirm</dt><dd>{inr(money.toConfirmRemaining)}</dd></div>}
        <div className="flex justify-between text-[var(--color-text-secondary)]"><dt>{fullyPaid ? 'Fully paid' : 'Balance of the total'}</dt><dd>{inr(money.outstanding)}</dd></div>
      </dl>
      {!money.confirmed && money.received === 0 && <p className="text-xs text-[var(--color-text-muted)]">A smaller payment holds the date for {money.holdWindowDays} days.</p>}
      {money.holdOver && <p className="text-xs text-[var(--color-text-muted)]">The {money.holdWindowDays} days are over and the booking is not confirmed. Speak to {first} — you decide whether to keep holding the date.</p>}

      {money.claims.length > 0 && (
        <Claims
          claims={money.claims}
          first={first}
          busy={busy}
          onClaim={async (c, body) => {
            const ok = await onClaim(c.id, body);
            if (ok) {
              setJustReceived(body.received ? { amount: c.amount } : null);
              window.dispatchEvent(new Event(TO_CHECK_CHANGED));
            }
            return ok;
          }}
          tell={(c) => whatsappTo(state.customer.phone, claimNotReceivedMessage({ customerName: state.customer.name, businessName: state.venueName, number: q.number, amount: c.amount, utr: c.utr, reason: c.rejectReason }))}
        />
      )}
      {justReceived && (
        <div role="status" className="space-y-2 rounded-lg bg-[var(--color-success-bg)] p-3 text-sm text-[var(--color-success-text)]">
          <p className="font-semibold">{inr(justReceived.amount)} recorded as received.</p>
          <a
            href={whatsappTo(state.customer.phone, claimReceivedMessage({ customerName: state.customer.name, businessName: state.venueName, number: q.number, amount: justReceived.amount, confirmed: money.confirmed }))}
            target="_blank"
            rel="noopener noreferrer"
            className={secondary}
          >
            <MessageCircle className="h-5 w-5" aria-hidden /> Tell {first} on WhatsApp
          </a>
        </div>
      )}

      {money.payments.length > 0 && (
        <ul className="space-y-1 border-t border-[var(--color-border-subtle)] pt-3 text-sm">
          {money.payments.map((p) => (
            <li key={p.id} className="flex justify-between gap-3">
              <span className="text-[var(--color-text-secondary)]">
                {dayWords(p.paidAt)} · {PAYMENT_METHOD_LABEL[p.method as PaymentMethod] ?? p.method}
                {p.reference && <span className="text-[var(--color-text-muted)]"> · {p.reference}</span>}
              </span>
              <span className="shrink-0 text-[var(--color-text-primary)]">{inr(p.amount)}</span>
            </li>
          ))}
        </ul>
      )}

      {money.invoices.length > 0 && (
        <section aria-label="Invoices" className="space-y-2 border-t border-[var(--color-border-subtle)] pt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Invoices</h4>
          <ul className="space-y-2">
            {money.invoices.map((i) => (
              <li key={i.number} className="rounded-lg border border-[var(--color-border-subtle)] p-3 text-sm">
                <p className="flex justify-between gap-3 font-semibold text-[var(--color-text-primary)]">
                  <span>{i.number} · {i.kind === 'ADVANCE' ? 'To confirm the booking' : 'Balance'}</span>
                  <span className="shrink-0">{inr(i.total)}</span>
                </p>
                {i.gst > 0 ? (
                  <dl className="mt-1 space-y-0.5 text-xs text-[var(--color-text-secondary)]">
                    <div className="flex justify-between"><dt>Taxable value</dt><dd>{inr(i.taxable)}</dd></div>
                    <div className="flex justify-between"><dt>GST</dt><dd>+ {inr(i.gst)}</dd></div>
                    <div className="flex justify-between"><dt>GSTIN</dt><dd className="tracking-wide">{i.gstin ?? '—'}</dd></div>
                  </dl>
                ) : (
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">No GST on this invoice</p>
                )}
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{i.paid >= i.total ? 'Paid' : i.paid > 0 ? `${inr(i.paid)} received` : 'Nothing received yet'}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {open ? (
        <div className="space-y-3 rounded-lg border border-[var(--color-border-subtle)] p-3">
          <Input label="Amount received (₹)" inputMode="numeric" value={amount} onChange={(ev) => setAmount(ev.target.value)} error={errors.amount} className="min-h-12 text-base" />
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">How was it paid?</legend>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)} className={`min-h-11 rounded-full border px-4 text-sm font-medium ${method === m ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--color-on-primary)]' : 'border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]'}`}>
                  {PAYMENT_METHOD_LABEL[m]}
                </button>
              ))}
            </div>
            {errors.method && <p className="mt-1 text-xs text-[var(--color-danger-text)]">{errors.method}</p>}
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Reference" value={reference} onChange={(ev) => setReference(ev.target.value)} error={errors.reference} helperText="UPI / cheque no., if any" className="min-h-12 text-base" />
            <Input label="Received on" type="date" max={istDay()} value={paidOn} onChange={(ev) => setPaidOn(ev.target.value)} error={errors.paidOn} className="min-h-12 text-base" />
          </div>
          <button type="button" disabled={busy || !amount.trim()} onClick={save} className={primary}>{busy ? 'Saving…' : 'Save payment'}</button>
          <button type="button" disabled={busy} onClick={() => setOpen(false)} className={secondary}>Cancel</button>
        </div>
      ) : (
        !fullyPaid && (
          <>
            <button type="button" disabled={busy} onClick={start} className={primary}>Record a payment</button>
            <a href={request} target="_blank" rel="noopener noreferrer" className={secondary}><MessageCircle className="h-5 w-5" aria-hidden /> Send payment details on WhatsApp</a>
            {!state.payTo && <p className="text-xs text-[var(--color-text-muted)]">Add your UPI ID in Settings to include it in this message.</p>}
          </>
        )
      )}
    </div>
  );
}
