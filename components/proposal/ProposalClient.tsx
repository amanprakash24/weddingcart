'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { CustomerProposal } from '@/lib/quotation/proposal';
import { groupByFunction, nextStep, proposalStatus, type StatusTone } from '@/lib/quotation/proposalView';
import { SHAADI_PHONE, SHAADI_PHONE_DISPLAY } from '@/lib/shaadiContact';

// The couple's wedding proposal (docs/wedding-os/08-quotation.md §15–16). Everything shown comes from the server-side
// allow-list (toCustomerProposal) — this component never receives internal notes, ids, contact details or vendor
// prices. It adds no data of its own: a missing vendor, function or inclusion is simply not shown.

type Item = CustomerProposal['items'][number];

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const formatDate = (value: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(d);
};
const serif = { fontFamily: 'var(--font-playfair, serif)' };
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

const TONE: Record<StatusTone, string> = {
  open: 'bg-white/15 text-white',
  changes: 'bg-sky-100 text-sky-900',
  accepted: 'bg-amber-100 text-amber-900',
  booked: 'bg-emerald-100 text-emerald-900',
  expired: 'bg-white/20 text-white/80',
};

function TextBlock({ title, text }: { title: string; text: string | null }) {
  if (!text?.trim()) return null;
  return (
    <section className="rounded-2xl border border-[#C5A46D]/20 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8B1A4A]">{title}</h2>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#4A3F38]">{text}</p>
    </section>
  );
}

function ServiceCard({ item }: { item: Item }) {
  const profile = item.vendor?.profile ?? null;
  // The headline is who provides it; without a linked vendor, what the line says.
  const title = item.vendor?.name ?? item.description;
  const detail = item.vendor && item.description !== item.service ? item.description : null;
  return (
    <article className="rounded-2xl border border-[#C5A46D]/20 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#8B1A4A]">
        {item.service && <span>{item.service}</span>}
        {item.functionLabel && <span className="rounded-full bg-[#FFFAF5] px-2 py-0.5 normal-case tracking-normal text-[#6B5B4D]">{item.functionLabel}</span>}
      </div>

      <div className="mt-2 flex gap-4">
        {profile?.image && (
          <Image src={profile.image} alt={title} width={96} height={96} unoptimized className="h-20 w-20 shrink-0 rounded-xl object-cover sm:h-24 sm:w-24" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-[#2A1F1B]" style={serif}>{title}</h3>
          {detail && <p className="text-sm text-[#4A3F38]">{detail}</p>}
          {profile && (
            <p className="mt-1 text-sm text-[#6B5B4D]">
              {[
                profile.location,
                profile.guestCapacity ? `Up to ${profile.guestCapacity.toLocaleString('en-IN')} guests` : null,
                profile.venueType ? capitalize(profile.venueType) : null,
                profile.rating ? `★ ${profile.rating.value.toFixed(1)} (${profile.rating.reviews} ${profile.rating.reviews === 1 ? 'review' : 'reviews'})` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
      </div>

      {profile && (profile.about || profile.features.length > 0) && (
        <div className="mt-3 rounded-xl bg-[#FFFAF5] p-3 text-sm text-[#4A3F38]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6B5B4D]">About {item.vendor!.name}</p>
          {profile.about && <p className="mt-1 leading-relaxed">{profile.about}</p>}
          {profile.features.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {profile.features.map((f) => (
                <li key={f} className="rounded-full border border-[#C5A46D]/30 bg-white px-2 py-0.5 text-xs">{f}</li>
              ))}
            </ul>
          )}
          <a href={profile.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-[#8B1A4A] underline underline-offset-2">
            View profile
          </a>
        </div>
      )}

      <div className="mt-3 flex items-baseline justify-between border-t border-gray-100 pt-3 text-sm">
        <span className="text-[#6B5B4D]">{item.quantity} × {rupees(item.unitPrice)}</span>
        <span className="text-base font-semibold text-[#2A1F1B]">{rupees(item.lineTotal)}</span>
      </div>
    </article>
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

  const status = proposalStatus(p);
  const groups = groupByFunction(p.items);
  const weddingDate = formatDate(p.wedding.date);

  return (
    <div className="min-h-screen bg-[#FFFAF5]">
      <div className="border-b border-[#C5A46D]/20 bg-white px-4 py-3">
        <p className="mx-auto max-w-2xl text-lg font-semibold text-[#8B1A4A]" style={serif}>Shaadi Shopping</p>
      </div>

      <div className="mx-auto max-w-2xl space-y-5 px-4 py-8 sm:py-10">
        <header className="rounded-2xl bg-[#8B1A4A] p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.2em] text-[#F3D9A4]">Wedding proposal</p>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[status.tone]}`}>{status.label}</span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold" style={serif}>{p.couple.name ?? 'Your wedding'}</h1>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/85">
            {weddingDate && <span>{weddingDate}</span>}
            {p.wedding.guestCount != null && <span>{p.wedding.guestCount} guests</span>}
            {p.wedding.city && <span>{p.wedding.city}</span>}
          </div>
          {p.venueName && <p className="mt-2 text-sm text-white">Venue: <span className="font-semibold">{p.venueName}</span></p>}
          <p className="mt-4 text-xs text-white/70">
            Proposal {p.number} · Version {p.version}
            {p.validUntil && p.state === 'OPEN' && <> · Valid until {formatDate(p.validUntil)}</>}
          </p>
        </header>

        <div role="status" className="rounded-2xl border border-[#C5A46D]/30 bg-white p-4 text-sm text-[#2A1F1B]">
          {nextStep(p)}
        </div>

        {groups.map((group, gi) => (
          <section key={group.title ?? gi} className="space-y-3">
            {group.title && <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-[#8B1A4A]">{group.title}</h2>}
            {group.items.map((item, i) => (
              <ServiceCard key={i} item={item} />
            ))}
          </section>
        ))}

        <section className="rounded-2xl border border-[#C5A46D]/20 bg-white p-5">
          <dl className="space-y-1 text-sm">
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

        {p.confirmedVendors.length > 0 && (
          <section className="rounded-2xl border border-emerald-200 bg-white p-5" aria-label="Your confirmed vendors">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Your confirmed vendors</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {p.confirmedVendors.map((v, i) => (
                <li key={i} className="rounded-xl bg-emerald-50/60 p-3">
                  <p className="font-semibold text-[#2A1F1B]">{v.name}</p>
                  <p className="text-[#6B5B4D]">
                    {[v.category, capitalize(v.function), formatDate(v.date), v.venueName].filter(Boolean).join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {p.state === 'OPEN' && (
          <section className="space-y-4 rounded-2xl border border-[#C5A46D]/30 bg-white p-5">
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

        <p className="pb-6 text-center text-sm text-[#6B5B4D]">
          Questions? Call or WhatsApp us on <a href={`tel:${SHAADI_PHONE}`} className="font-semibold text-[#8B1A4A]">{SHAADI_PHONE_DISPLAY}</a>
        </p>
      </div>
    </div>
  );
}
