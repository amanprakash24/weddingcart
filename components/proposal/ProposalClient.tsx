'use client';

import { useState } from 'react';
import type { CustomerProposal } from '@/lib/quotation/proposal';
import { SHAADI_PHONE, SHAADI_PHONE_DISPLAY } from '@/lib/shaadiContact';

// The couple's view of a proposal. Everything shown comes from the server-side allow-list (toCustomerProposal) —
// this component never receives internal notes, ids or contact details. Visual polish is Step 7.

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const formatDate = (value: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(d);
};
const serif = { fontFamily: 'var(--font-playfair, serif)' };

function TextBlock({ title, text }: { title: string; text: string | null }) {
  if (!text?.trim()) return null;
  return (
    <section className="rounded-2xl border border-[#C5A46D]/20 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8B1A4A]">{title}</h2>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#4A3F38]">{text}</p>
    </section>
  );
}

export default function ProposalClient({ token, initial }: { token: string; initial: CustomerProposal }) {
  const [p, setP] = useState(initial);
  const [agree, setAgree] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'accept' | 'changes' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showChanges, setShowChanges] = useState(false);

  async function post(path: 'accept' | 'request-changes', body: unknown): Promise<boolean> {
    setError(null);
    try {
      const res = await fetch(`/api/proposal/${token}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setError(json.error ?? 'Something went wrong — please try again');
        return false;
      }
      return true;
    } catch {
      setError('Could not reach us — please check your connection and try again');
      return false;
    }
  }

  async function accept() {
    if (!agree || busy) return;
    setBusy('accept');
    if (await post('accept', { agreeToTerms: true })) setP((cur) => ({ ...cur, state: 'ACCEPTED', acceptedAt: cur.acceptedAt ?? new Date().toISOString() }));
    setBusy(null);
  }

  async function requestChanges() {
    if (!note.trim() || busy) return;
    setBusy('changes');
    if (await post('request-changes', { note })) {
      setP((cur) => ({ ...cur, changesRequested: true }));
      setNote('');
      setShowChanges(false);
    }
    setBusy(null);
  }

  const groups = p.items.reduce<Record<string, CustomerProposal['items']>>((acc, item) => {
    const key = item.category || 'Services';
    (acc[key] ??= []).push(item);
    return acc;
  }, {});
  const weddingDate = formatDate(p.wedding.date);

  return (
    <div className="bg-[#FFFAF5] px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="rounded-2xl bg-[#8B1A4A] p-6 text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-[#F3D9A4]">Wedding proposal</p>
          <h1 className="mt-2 text-3xl font-semibold" style={serif}>{p.couple.name ?? 'Your wedding'}</h1>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/85">
            {weddingDate && <span>{weddingDate}</span>}
            {p.wedding.guestCount != null && <span>{p.wedding.guestCount} guests</span>}
            {p.wedding.city && <span>{p.wedding.city}</span>}
          </div>
          <p className="mt-4 text-xs text-white/70">
            {p.number} · Version {p.version}
            {p.validUntil && p.state === 'OPEN' && <> · Valid until {formatDate(p.validUntil)}</>}
          </p>
        </header>

        {p.state === 'ACCEPTED' && (
          <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
            <p className="font-semibold">Thank you — you accepted this proposal{p.acceptedAt ? ` on ${formatDate(p.acceptedAt)}` : ''}.</p>
            <p className="mt-1">Our team will contact you about the advance of {rupees(p.advanceAmount)} to confirm your booking.</p>
          </div>
        )}
        {p.state === 'EXPIRED' && (
          <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-semibold">This proposal has expired.</p>
            <p className="mt-1">Please contact us and we will send you an updated proposal.</p>
          </div>
        )}
        {p.state === 'OPEN' && p.changesRequested && (
          <div role="status" className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-900">
            <p className="font-semibold">We have received your request for changes.</p>
            <p className="mt-1">We will send you an updated proposal. You can still accept this version if you prefer.</p>
          </div>
        )}

        <section className="rounded-2xl border border-[#C5A46D]/20 bg-white p-5">
          {Object.entries(groups).map(([category, items]) => (
            <div key={category} className="border-b border-gray-100 py-3 last:border-0">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8B1A4A]">{category}</h2>
              {items.map((item, i) => (
                <div key={i} className="mt-2 flex items-start justify-between gap-4 text-sm">
                  <div>
                    <p className="font-medium text-[#2A1F1B]">{item.vendorName ?? item.description}</p>
                    <p className="text-[#6B5B4D]">
                      {item.vendorName ? `${item.description} · ` : ''}
                      {item.functionLabel ? `${item.functionLabel} · ` : ''}
                      {item.quantity} × {rupees(item.unitPrice)}
                    </p>
                  </div>
                  <p className="whitespace-nowrap font-medium text-[#2A1F1B]">{rupees(item.lineTotal)}</p>
                </div>
              ))}
            </div>
          ))}

          <dl className="mt-4 space-y-1 border-t border-gray-200 pt-4 text-sm">
            <div className="flex justify-between text-[#6B5B4D]"><dt>Subtotal</dt><dd>{rupees(p.subtotal)}</dd></div>
            {p.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount</dt><dd>− {rupees(p.discount)}</dd></div>}
            {p.gstAmount != null && <div className="flex justify-between text-[#6B5B4D]"><dt>GST</dt><dd>{rupees(p.gstAmount)}</dd></div>}
            <div className="flex justify-between pt-2 text-lg font-semibold text-[#2A1F1B]"><dt>Total</dt><dd>{rupees(p.total)}</dd></div>
            {p.advanceAmount > 0 && (
              <div className="flex justify-between text-[#8B1A4A]"><dt>Advance to confirm</dt><dd>{rupees(p.advanceAmount)}</dd></div>
            )}
          </dl>
        </section>

        <TextBlock title="What's included" text={p.inclusions} />
        <TextBlock title="What's not included" text={p.exclusions} />
        <TextBlock title="Terms" text={p.terms} />

        {p.state === 'OPEN' && (
          <section className="rounded-2xl border border-[#C5A46D]/30 bg-white p-5 space-y-4">
            <label className="flex items-start gap-3 text-sm text-[#2A1F1B]">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#8B1A4A]" />
              <span>I have read this proposal and agree to its terms.</span>
            </label>
            <button
              type="button"
              onClick={accept}
              disabled={!agree || busy !== null}
              className="min-h-[48px] w-full rounded-xl bg-[#8B1A4A] px-5 text-base font-semibold text-white disabled:opacity-40"
            >
              {busy === 'accept' ? 'Accepting…' : 'Accept proposal'}
            </button>

            {!showChanges ? (
              <button type="button" onClick={() => setShowChanges(true)} className="min-h-[44px] w-full rounded-xl border border-[#8B1A4A]/40 px-5 text-sm font-semibold text-[#8B1A4A]">
                Request changes
              </button>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={1000}
                  rows={4}
                  placeholder="For example: Can you reduce the decoration budget? Or: Please change catering from 350 to 300 guests."
                  className="w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-[#C5A46D]"
                />
                <button
                  type="button"
                  onClick={requestChanges}
                  disabled={!note.trim() || busy !== null}
                  className="min-h-[44px] w-full rounded-xl bg-[#2A1F1B] px-5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {busy === 'changes' ? 'Sending…' : 'Send my request'}
                </button>
              </div>
            )}
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          </section>
        )}

        <p className="text-center text-sm text-[#6B5B4D]">
          Questions? Call or WhatsApp us on <a href={`tel:${SHAADI_PHONE}`} className="font-semibold text-[#8B1A4A]">{SHAADI_PHONE_DISPLAY}</a>
        </p>
      </div>
    </div>
  );
}
