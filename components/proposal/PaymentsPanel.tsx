'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { ProposalPayments, CustomerReceipt } from '@/lib/payments/customerPayment';
import { upiLink } from '@/lib/payments/upi';
import { SHAADI_PHONE_DISPLAY } from '@/lib/shaadiContact';

// Roadmap 1.3 (docs/wedding-os/08-quotation.md §20) — the couple's Payments view on the proposal link: where they stand (total → paid →
// pending → due date), pay by UPI (QR, or the UPI app on a phone), "I have paid" with the UTR, and their receipts.
// Everything comes from the server's allow-list (toProposalPayments). A claim is only ever shown as "being checked" — what counts as
// paid is what staff have verified.

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const formatDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(iso)) : null;
const serif = { fontFamily: 'var(--font-playfair), serif' };
const field =
  'min-h-[48px] w-full rounded-xl border border-[#E8DCC8] bg-[#FFFCF7] px-3.5 text-sm outline-none focus:border-[#C5A46D] focus:ring-2 focus:ring-[#C5A46D]/25';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#B08D55]">
      <span className="h-px w-8 bg-[#C5A46D]" />
      {children}
    </p>
  );
}

function UpiQr({ link }: { link: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#2A1F1B', light: '#FFFFFF' } })
      .then((s) => live && setSvg(s))
      .catch(() => live && setSvg(null));
    return () => {
      live = false;
    };
  }, [link]);
  return (
    <div
      role="img"
      aria-label="UPI QR code — scan with any UPI app"
      className="mx-auto aspect-square w-48 rounded-xl bg-white p-2 ring-1 ring-[#E8DCC8] sm:w-56 [&>svg]:h-full [&>svg]:w-full"
      // The SVG is generated locally from the UPI link (no third-party service sees the amount or the payee).
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}

export default function PaymentsPanel({
  token,
  number,
  coupleName,
  weddingDate,
  initial,
}: {
  token: string;
  number: string;
  coupleName: string | null;
  weddingDate: string | null;
  initial: ProposalPayments;
}) {
  const [m, setM] = useState(initial);
  const [amount, setAmount] = useState(String(initial.payNow));
  const [utr, setUtr] = useState('');
  const [paidOn, setPaidOn] = useState('');
  const [note, setNote] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [printing, setPrinting] = useState<CustomerReceipt | null>(null);

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(null);
    window.addEventListener('afterprint', done);
    const t = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [printing]);

  const value = Number(amount.replace(/[,\s₹]/g, ''));
  const validAmount = Number.isInteger(value) && value > 0 && value <= m.outstanding;
  const link = m.upi && validAmount ? upiLink(m.upi, value, number) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append('amount', String(value));
    fd.append('utr', utr);
    if (paidOn) fd.append('paidOn', paidOn);
    if (note.trim()) fd.append('note', note.trim());
    if (proof) fd.append('proof', proof);
    try {
      const res = await fetch(`/api/proposal/${token}/payments`, { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setError(json.error ?? 'Something went wrong — please try again');
      } else {
        setM(json.data.payments);
        setAmount(String(json.data.payments.payNow));
        setUtr('');
        setPaidOn('');
        setNote('');
        setProof(null);
        setSent(true);
      }
    } catch {
      setError('Could not reach us — please check your connection and try again');
    }
    setBusy(false);
  }

  async function copyUpi() {
    if (!m.upi) return;
    try {
      await navigator.clipboard.writeText(m.upi.vpa);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the UPI ID is on screen to copy by hand */
    }
  }

  const due = m.dueDate ? formatDate(m.dueDate) : null;
  const tiles: { label: string; value: string; tone?: string }[] = [
    { label: 'Total', value: rupees(m.total) },
    { label: m.bookingConfirmed ? 'Advance' : `To confirm (${m.confirmationPercent}%)`, value: rupees(m.confirmationAmount) },
    { label: 'Paid', value: rupees(m.received), tone: m.received > 0 ? 'text-emerald-700' : undefined },
    { label: 'Pending', value: rupees(m.outstanding) },
  ];
  if (due) tiles.push({ label: 'Due date', value: due, tone: 'text-[#8B1A4A]' });

  return (
    <div role="tabpanel" aria-label="Payments" className="space-y-6">
      <div className="space-y-6 print:hidden">
        {/* Where things stand: Total → Advance → Paid → Pending → Due date (master doc §27) */}
        <section className="rounded-[24px] bg-white p-5 shadow-[0_20px_60px_rgba(42,6,20,0.06)] ring-1 ring-[#E8DCC8]/70 sm:p-8">
          <Eyebrow>Your payments</Eyebrow>
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-xl border border-[#F0E6D6] bg-[#FFFCF7] p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9A8676]">{t.label}</dt>
                <dd className={`mt-1 text-lg tabular-nums ${t.tone ?? 'text-[#2A1F1B]'}`} style={serif}>
                  {t.value}
                </dd>
              </div>
            ))}
          </dl>
          {m.inReview > 0 && (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              {rupees(m.inReview)} you sent is being checked by our team. It will show as paid once we confirm it.
            </p>
          )}
        </section>

        {/* Pay by UPI */}
        {m.upi && m.outstanding > 0 && (
          <section className="space-y-5 rounded-[24px] border border-[#C5A46D]/40 bg-white p-5 sm:p-8">
            <Eyebrow>Pay by UPI</Eyebrow>
            <label className="grid gap-1.5 text-sm text-[#5A4A40]">
              Amount to pay
              <input
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label="Amount to pay"
                className={`${field} text-lg`}
              />
              <span className="text-xs text-[#9A8676]">
                {m.remainingToConfirm > 0
                  ? `${rupees(m.remainingToConfirm)} confirms your booking. You may pay more, up to ${rupees(m.outstanding)}.`
                  : `Up to ${rupees(m.outstanding)} is due.`}
              </span>
            </label>
            {link ? (
              <div className="grid items-center gap-5 sm:grid-cols-[auto_1fr]">
                <UpiQr link={link} />
                <div className="space-y-3 text-sm text-[#4A3F38]">
                  <p>Scan with any UPI app (Google Pay, PhonePe, Paytm, BHIM…), or on your phone:</p>
                  <a
                    href={link}
                    className="flex min-h-[48px] items-center justify-center rounded-full bg-gradient-to-r from-[#8B1A4A] via-[#9E2A55] to-[#C5A46D] px-6 text-sm font-semibold text-white"
                  >
                    Pay {rupees(value)} with a UPI app
                  </a>
                  <div className="rounded-xl bg-[#FFFAF5] p-3">
                    <p className="text-xs text-[#9A8676]">Paying to</p>
                    <p className="font-semibold text-[#2A1F1B]">{m.upi.payee}</p>
                    <p className="flex flex-wrap items-center gap-2 font-mono text-sm">
                      {m.upi.vpa}
                      <button type="button" onClick={copyUpi} className="rounded-full border border-[#E8DCC8] px-2.5 py-0.5 font-sans text-xs text-[#8B1A4A]">
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </p>
                  </div>
                  <p className="text-xs text-[#9A8676]">Check that your UPI app shows “{m.upi.payee}” before you pay. Add {number} in the note if your app asks.</p>
                </div>
              </div>
            ) : (
              <p role="alert" className="text-sm text-amber-800">
                Enter an amount in whole rupees, up to {rupees(m.outstanding)}.
              </p>
            )}
          </section>
        )}

        {/* I have paid */}
        {m.upi && m.outstanding > 0 && (
          <section className="space-y-4 rounded-[24px] border border-[#E8DCC8] bg-white p-5 sm:p-8">
            <Eyebrow>I have paid</Eyebrow>
            {sent && (
              <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
                Thank you — we have your payment details. Our team will check it with the bank, and your receipt will appear here.
              </p>
            )}
            {m.canSubmit ? (
              <form onSubmit={submit} className="grid gap-3">
                <p className="text-sm text-[#5A4A40]">After paying, send us the UTR (the transaction reference in your UPI app) so we can match your payment.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm text-[#5A4A40]">
                    Amount paid ₹
                    <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount paid" className={field} />
                  </label>
                  <label className="grid gap-1.5 text-sm text-[#5A4A40]">
                    UTR / transaction reference
                    <input value={utr} onChange={(e) => setUtr(e.target.value)} aria-label="UTR or transaction reference" placeholder="12 digits, e.g. 412345678901" autoComplete="off" className={`${field} font-mono`} />
                  </label>
                  <label className="grid gap-1.5 text-sm text-[#5A4A40]">
                    Date paid <span className="text-xs text-[#9A8676]">(today if blank)</span>
                    <input type="date" max={today()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} aria-label="Date paid" className={field} />
                  </label>
                  <label className="grid gap-1.5 text-sm text-[#5A4A40]">
                    Screenshot <span className="text-xs text-[#9A8676]">(optional — photo or PDF, under 5 MB)</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                      onChange={(e) => setProof(e.target.files?.[0] ?? null)}
                      aria-label="Payment screenshot"
                      className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[#F5EDE0] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#8B1A4A]"
                    />
                  </label>
                </div>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} aria-label="Note (optional)" placeholder="Anything we should know? (optional)" className={`${field} py-3`} />
                <button type="submit" disabled={busy || !validAmount || !utr.trim()} className="min-h-[52px] rounded-full bg-[#2A1F1B] px-6 text-sm font-semibold text-white disabled:opacity-40">
                  {busy ? 'Sending…' : 'Send payment details'}
                </button>
                {error && (
                  <p role="alert" className="text-sm text-red-600">
                    {error}
                  </p>
                )}
                <p className="text-xs text-[#9A8676]">Your screenshot is only seen by the Shaadi Shopping team.</p>
              </form>
            ) : (
              <p className="text-sm text-[#5A4A40]">We are still checking the payments you sent. Please wait for us, or call {SHAADI_PHONE_DISPLAY}.</p>
            )}
          </section>
        )}

        {m.submissions.length > 0 && (
          <section className="rounded-[24px] border border-[#E8DCC8] bg-white p-5 sm:p-6">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#8B1A4A]">Payments you sent</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {m.submissions.map((s) => (
                <li key={s.id} className={`rounded-xl p-3 ${s.status === 'PENDING' ? 'bg-amber-50 text-amber-950' : 'bg-red-50 text-red-900'}`}>
                  <p className="font-semibold">
                    {rupees(s.amount)} · UTR {s.utr} · {s.status === 'PENDING' ? 'Being checked' : 'Could not be matched'}
                  </p>
                  <p className="text-xs opacity-80">
                    Sent {formatDate(s.submittedAt)}
                    {s.rejectReason && <> — {s.rejectReason}. Please check the UTR and send it again, or call {SHAADI_PHONE_DISPLAY}.</>}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-[24px] border border-[#E8DCC8] bg-white p-5 sm:p-6">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#8B1A4A]">Receipts</h3>
          {m.receipts.length === 0 ? (
            <p className="mt-2 text-sm text-[#6B5B4D]">No payments received yet. Each payment we receive appears here with its receipt.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#F0E6D6] text-sm">
              {m.receipts.map((r) => (
                <li key={r.number} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-semibold text-[#2A1F1B]">
                      {rupees(r.amount)} · {r.method}
                    </p>
                    <p className="text-xs text-[#7A6556]">
                      {r.number} · {formatDate(r.paidAt)}
                      {r.reference && <> · Ref {r.reference}</>}
                    </p>
                  </div>
                  <button type="button" onClick={() => setPrinting(r)} className="rounded-full border border-[#E8DCC8] px-4 py-2 text-xs font-semibold text-[#8B1A4A] hover:border-[#C5A46D]">
                    Download / print
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {!m.upi && m.outstanding > 0 && (
          <p className="rounded-2xl border border-[#E8DCC8] bg-white p-4 text-sm text-[#5A4A40]">To pay, please call us on {SHAADI_PHONE_DISPLAY} — our team will share the payment details.</p>
        )}
      </div>

      {/* The printed receipt — only this prints while a receipt is chosen. */}
      {printing && (
        <section aria-label="Payment receipt" className="hidden text-[#2A1F1B] print:block">
          <p className="text-2xl" style={serif}>
            Shaadi Shopping — Payment receipt
          </p>
          <p className="mt-1 text-sm">Receipt {printing.number}</p>
          <dl className="mt-6 grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt>Received from</dt>
            <dd className="font-semibold">{coupleName ?? '—'}</dd>
            <dt>Amount</dt>
            <dd className="font-semibold">{rupees(printing.amount)}</dd>
            <dt>Paid by</dt>
            <dd>{printing.method}</dd>
            {printing.reference && (
              <>
                <dt>Reference</dt>
                <dd>{printing.reference}</dd>
              </>
            )}
            <dt>Date</dt>
            <dd>{formatDate(printing.paidAt)}</dd>
            <dt>For</dt>
            <dd>
              Quotation {number}
              {weddingDate && <> · Wedding on {formatDate(weddingDate)}</>}
            </dd>
            <dt>Agreed total</dt>
            <dd>{rupees(m.total)}</dd>
          </dl>
          <p className="mt-8 text-xs">Shaadi Shopping · {SHAADI_PHONE_DISPLAY} · This receipt was generated from our records.</p>
        </section>
      )}
    </div>
  );
}
