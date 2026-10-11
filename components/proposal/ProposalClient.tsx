'use client';

import { useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import type { CustomerProposal } from '@/lib/quotation/proposal';
import {
  groupByFunction,
  nextStep,
  proposalContact,
  proposalHighlights,
  proposalStatus,
  quotationSummary,
  REQUEST_CHOICES,
  shaadiSection,
  tabFromHash,
  type ProposalTab,
  type StatusTone,
} from '@/lib/quotation/proposalView';
import { SHAADI_PHONE, SHAADI_PHONE_DISPLAY } from '@/lib/shaadiContact';
import PaymentsPanel from '@/components/proposal/PaymentsPanel';
import ReviewsPanel from '@/components/proposal/ReviewsPanel';
import YourBookingPanel from '@/components/proposal/YourBookingPanel';
import { coupleBookingWords } from '@/lib/quotation/coupleBooking';

// The couple's wedding proposal (docs/wedding-os/08-quotation.md §15–17). One link, two separate experiences
// (Decision 10): the visual, curated PROPOSAL, and the commercially detailed QUOTATION where the couple accepts.
// Everything shown comes from the server-side allow-list (toCustomerProposal) — this component never receives
// internal notes, ids, contact details or vendor prices. It adds no data of its own: a missing vendor, photo,
// function or inclusion is simply not shown. (The one id it holds is a line of the venue's own price list in "Add an event",
// which only says what the couple ticked.)

type Item = CustomerProposal['items'][number];

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const formatDate = (value: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      }).format(d);
};
const serif = { fontFamily: 'var(--font-playfair), serif' };
const script = { fontFamily: 'var(--font-cormorant), Georgia, serif' };
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

const TONE: Record<StatusTone, string> = {
  open: 'border-[#E8C98A]/50 text-[#F3D9A4]',
  changes: 'border-sky-200/60 bg-sky-100 text-sky-900',
  accepted: 'border-amber-200 bg-amber-100 text-amber-900',
  booked: 'border-emerald-200 bg-emerald-100 text-emerald-900',
  expired: 'border-white/30 text-white/80',
};

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p
      className={`flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] ${light ? 'text-[#E8C98A]' : 'text-[#B08D55]'}`}
    >
      <span className={`h-px w-8 ${light ? 'bg-[#E8C98A]/70' : 'bg-[#C5A46D]'}`} />
      {children}
    </p>
  );
}

function TextBlock({ title, text }: { title: string; text: string | null }) {
  if (!text?.trim()) return null;
  return (
    <section className="rounded-2xl border border-[#E8DCC8] bg-white p-5 sm:p-6 print:rounded-none print:border-0 print:border-t print:px-0">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#8B1A4A]">
        {title}
      </h3>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#4A3F38]">{text}</p>
    </section>
  );
}

// ── The proposal: who, what it looks like, and what it costs for each service ──────────────────────────────────

function ServiceShowcase({ item, grouped }: { item: Item; grouped: boolean }) {
  const profile = item.vendor?.profile ?? null;
  // The headline is who provides it; without a linked vendor, what the line says.
  const title = item.vendor?.name ?? item.description;
  const detail = item.vendor && item.description !== item.service ? item.description : null;
  const photos = [profile?.image, ...(profile?.gallery ?? [])].filter((x): x is string => !!x);
  const [active, setActive] = useState(0);
  const meta = profile
    ? [
        profile.location,
        profile.guestCapacity
          ? `Up to ${profile.guestCapacity.toLocaleString('en-IN')} guests`
          : null,
        profile.venueType ? capitalize(profile.venueType) : null,
        profile.rating
          ? `★ ${profile.rating.value.toFixed(1)} (${profile.rating.reviews} ${profile.rating.reviews === 1 ? 'review' : 'reviews'})`
          : null,
      ].filter(Boolean)
    : [];

  return (
    <article className="overflow-hidden rounded-[24px] bg-white shadow-[0_20px_60px_rgba(42,6,20,0.08)] ring-1 ring-[#E8DCC8]/70">
      {photos.length > 0 && (
        <div>
          <div className="relative aspect-[16/10] bg-[#F5EDE3]">
            <Image
              src={photos[active]}
              alt={title}
              fill
              unoptimized
              sizes="(min-width: 768px) 720px, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1E0510]/60 via-transparent to-transparent" />
            {item.service && (
              <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8B1A4A] backdrop-blur">
                {item.service}
              </span>
            )}
          </div>
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 pt-3 [scrollbar-width:none]">
              {photos.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Photo ${i + 1} of ${title}`}
                  aria-pressed={i === active}
                  className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition ${i === active ? 'ring-[#C5A46D]' : 'ring-transparent opacity-70 hover:opacity-100'}`}
                >
                  <Image src={src} alt="" fill unoptimized sizes="80px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#B08D55]">
          {photos.length === 0 && item.service && item.service !== title && (
            <span>{item.service}</span>
          )}
          {/* Under a function heading the chip would only repeat it. */}
          {!grouped && item.functionLabel && (
            <span className="rounded-full border border-[#E8DCC8] px-2.5 py-0.5 normal-case tracking-normal text-[#7A6556]">
              {item.functionLabel}
            </span>
          )}
        </div>
        <h3 className="mt-2 text-2xl leading-snug text-[#2A1F1B] sm:text-[28px]" style={serif}>
          {title}
        </h3>
        {detail && (
          <p className="mt-1 text-[15px] italic text-[#8B1A4A]" style={script}>
            {detail}
          </p>
        )}
        {meta.length > 0 && <p className="mt-2 text-sm text-[#7A6556]">{meta.join(' · ')}</p>}

        {profile?.about && (
          <p className="mt-4 text-[15px] leading-relaxed text-[#4A3F38]">{profile.about}</p>
        )}
        {profile && profile.features.length > 0 && (
          <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm text-[#4A3F38] sm:grid-cols-2">
            {profile.features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rotate-45 bg-[#C5A46D]"
                />
                {f}
              </li>
            ))}
          </ul>
        )}

        {profile && (
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
            {profile.video && (
              <a
                href={profile.video}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#8B1A4A] underline decoration-[#C5A46D] underline-offset-4"
              >
                Watch the video tour
              </a>
            )}
            <a
              href={profile.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8B1A4A] underline decoration-[#C5A46D] underline-offset-4"
            >
              View full profile
            </a>
          </div>
        )}

        <div className="mt-6 flex items-baseline justify-between border-t border-[#F0E6D6] pt-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7A6556]">
            For this service
          </span>
          <span className="text-xl text-[#2A1F1B]" style={serif}>
            {rupees(item.lineTotal)}
          </span>
        </div>
      </div>
    </article>
  );
}

// ── The detailed quotation: every line, every rupee, the terms ───────────────────────────────────────────────────

function QuotationTable({ items }: { items: Item[] }) {
  const groups = groupByFunction(items);
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-[#E8DCC8] text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7A6556]">
          <th className="py-3 pr-3 font-semibold">Item</th>
          <th className="hidden py-3 pr-3 text-right font-semibold sm:table-cell print:table-cell">
            Qty
          </th>
          <th className="hidden py-3 pr-3 text-right font-semibold sm:table-cell print:table-cell">
            Unit price
          </th>
          <th className="py-3 text-right font-semibold">Amount</th>
        </tr>
      </thead>
      {groups.map((group, gi) => (
        <tbody key={group.title ?? gi}>
          {group.title && (
            <tr>
              <td
                colSpan={4}
                className="pb-1 pt-5 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#8B1A4A]"
              >
                {group.title}
              </td>
            </tr>
          )}
          {group.items.map((item, i) => {
            const name = item.vendor?.name ?? item.description;
            // Nothing that only repeats the name (a line without a vendor is already named by its description).
            const sub = [
              ...new Set([
                item.service,
                item.vendor ? item.description : null,
                !group.title ? item.functionLabel : null,
              ]),
            ].filter((x) => x && x !== name);
            return (
              <tr key={i} className="border-b border-[#F0E6D6] align-top">
                <td className="py-3 pr-3">
                  <p className="font-medium text-[#2A1F1B]">{name}</p>
                  {sub.length > 0 && <p className="text-xs text-[#7A6556]">{sub.join(' · ')}</p>}
                  <p className="mt-0.5 text-xs text-[#7A6556] sm:hidden print:hidden">
                    {item.quantity} × {rupees(item.unitPrice)}
                  </p>
                </td>
                <td className="hidden py-3 pr-3 text-right tabular-nums text-[#4A3F38] sm:table-cell print:table-cell">
                  {item.quantity}
                </td>
                <td className="hidden py-3 pr-3 text-right tabular-nums text-[#4A3F38] sm:table-cell print:table-cell">
                  {rupees(item.unitPrice)}
                </td>
                <td className="py-3 text-right font-medium tabular-nums text-[#2A1F1B]">
                  {rupees(item.lineTotal)}
                  {item.gstPercent && (
                    <span className="block text-xs font-normal text-[#7A6556]">
                      + GST {item.gstPercent}%{item.taxable !== item.lineTotal && <> on {rupees(item.taxable)}</>} {rupees(item.gst)}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      ))}
    </table>
  );
}

function subscribeHash(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export default function ProposalClient({
  token,
  initial,
}: {
  token: string;
  initial: CustomerProposal;
}) {
  const [p, setP] = useState(initial);
  const [agree, setAgree] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'accept' | 'changes' | 'event' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showChanges, setShowChanges] = useState(false);
  // "Add an event" (a venue's own proposal): the function being added, what is ticked for it, and a line in their own words.
  const [addFn, setAddFn] = useState<string | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [eventNote, setEventNote] = useState('');
  const [eventSent, setEventSent] = useState<string | null>(null);
  // D8: the business whose quotation this is — Shaadi Shopping, or the venue (its own name and number).
  const contact = proposalContact(p.brand, { phone: SHAADI_PHONE, display: SHAADI_PHONE_DISPLAY });
  // On a venue's own link only: Shaadi Shopping's separate offer to help with the rest of the wedding.
  const shaadi = shaadiSection(p.brand, { phone: SHAADI_PHONE, display: SHAADI_PHONE_DISPLAY });

  // The view lives in the URL hash, so "#quotation" opens the detailed quotation directly (the server renders the proposal).
  const tab = tabFromHash(
    useSyncExternalStore(
      subscribeHash,
      () => window.location.hash,
      () => ''
    ),
    !!p.payments,
    !!p.reviews
  );

  function open(next: ProposalTab) {
    // replaceState keeps the token URL as it is and adds no history entry; no request is made.
    window.history.replaceState(
      null,
      '',
      next === 'proposal' ? window.location.pathname : `#${next}`
    );
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    document.getElementById('views')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function post(path: 'accept' | 'request-changes' | 'add-event', body: unknown): Promise<boolean> {
    setError(null);
    try {
      const res = await fetch(`/api/proposal/${token}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
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
    if (await post('accept', { agreeToTerms: true })) {
      setP((cur) => ({
        ...cur,
        state: 'ACCEPTED',
        acceptedAt: cur.acceptedAt ?? new Date().toISOString(),
      }));
      // Roadmap 1.3: reload onto the Payments view, which the server adds only for an accepted proposal. Opening a valid link
      // writes nothing, so the reload is free.
      window.location.hash = 'payments';
      window.location.reload();
      return;
    }
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

  function chooseFunction(fn: string | null) {
    setAddFn(fn);
    setPicks([]);
    setEventNote('');
    setError(null);
  }

  async function addEvent() {
    const group = p.addable.find((g) => g.function === addFn);
    if (!group || busy) return;
    setBusy('event');
    if (await post('add-event', { function: group.function, offeringIds: picks, note: eventNote })) {
      setP((cur) => ({ ...cur, changesRequested: true }));
      setEventSent(group.label);
      chooseFunction(null);
    }
    setBusy(null);
  }

  const status = proposalStatus(p);
  const groups = groupByFunction(p.items);
  const weddingDate = formatDate(p.wedding.date);
  const validUntil = p.validUntil && p.state === 'OPEN' ? formatDate(p.validUntil) : null;
  const facts = [
    weddingDate,
    p.wedding.guestCount != null ? `${p.wedding.guestCount.toLocaleString('en-IN')} guests` : null,
    p.wedding.city,
  ].filter(Boolean);

  const requestChangesBlock = p.state === 'OPEN' && (
    <div className="space-y-3">
      {!showChanges ? (
        <button
          type="button"
          onClick={() => setShowChanges(true)}
          className="min-h-[48px] w-full rounded-full border border-[#8B1A4A]/40 px-6 text-sm font-semibold text-[#8B1A4A] transition hover:bg-[#8B1A4A]/5"
        >
          Request changes or another option
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {REQUEST_CHOICES.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setNote((cur) => (cur.trim() ? cur : c.start))}
                className="rounded-full border border-[#E8DCC8] bg-[#FFFCF7] px-3.5 py-1.5 text-xs font-medium text-[#5A4A40] hover:border-[#C5A46D]"
              >
                {c.label}
              </button>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={4}
            aria-label="What would you like to change?"
            placeholder="For example: Can you show me another decorator? Or: Please change catering from 350 to 300 guests."
            className="w-full rounded-xl border border-[#E8DCC8] bg-[#FFFCF7] p-3.5 text-sm outline-none focus:border-[#C5A46D] focus:ring-2 focus:ring-[#C5A46D]/25"
          />
          <button
            type="button"
            onClick={requestChanges}
            disabled={!note.trim() || busy !== null}
            className="min-h-[48px] w-full rounded-full bg-[#2A1F1B] px-6 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy === 'changes' ? 'Sending…' : 'Send my request'}
          </button>
        </div>
      )}
    </div>
  );

  const adding = p.addable.find((g) => g.function === addFn);
  const addEventBlock = p.state === 'OPEN' && p.addable.length > 0 && (
    <section className="space-y-4 rounded-[24px] border border-[#E8DCC8] bg-white p-6 sm:p-8 print:hidden">
      <Eyebrow>Add an event</Eyebrow>
      <p className="text-sm leading-relaxed text-[#4A3F38]">
        Planning another function with {contact.name}? Choose it, tick what you would like, and we will send you an updated quotation.
      </p>
      {eventSent && !adding && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Your request to add {eventSent} has been sent.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {p.addable.map((g) => (
          <button
            key={g.function}
            type="button"
            aria-pressed={g.function === addFn}
            onClick={() => chooseFunction(g.function === addFn ? null : g.function)}
            className={`min-h-[44px] rounded-full border px-4 text-sm font-medium transition ${
              g.function === addFn ? 'border-[#8B1A4A] bg-[#8B1A4A] text-white' : 'border-[#E8DCC8] bg-[#FFFCF7] text-[#5A4A40] hover:border-[#C5A46D]'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
      {adding && (
        <div className="space-y-3">
          <ul className="divide-y divide-[#F0E6D6] rounded-xl border border-[#F0E6D6]">
            {adding.items.map((o) => (
              <li key={o.id}>
                <label className="flex min-h-[52px] cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-[#2A1F1B]">
                  <input
                    type="checkbox"
                    checked={picks.includes(o.id)}
                    onChange={(e) => setPicks((cur) => (e.target.checked ? [...cur, o.id] : cur.filter((id) => id !== o.id)))}
                    className="h-5 w-5 shrink-0 accent-[#8B1A4A]"
                  />
                  <span className="flex-1">{o.name}</span>
                  <span className="shrink-0 text-[#6B5B4D]">from {o.price}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-[#6B5B4D]">These are starting prices. Your updated quotation will show the exact amount.</p>
          <textarea
            value={eventNote}
            onChange={(e) => setEventNote(e.target.value)}
            maxLength={500}
            rows={2}
            aria-label={`Anything else about your ${adding.label}?`}
            placeholder="Anything else? For example the date, or how many guests."
            className="w-full rounded-xl border border-[#E8DCC8] bg-[#FFFCF7] p-3.5 text-sm outline-none focus:border-[#C5A46D] focus:ring-2 focus:ring-[#C5A46D]/25"
          />
          {/* The page's own alert is at the very bottom — repeated here (not as a second alert) so it is seen where the couple is. */}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={addEvent}
            disabled={busy !== null}
            className="min-h-[48px] w-full rounded-full bg-[#2A1F1B] px-6 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy === 'event' ? 'Sending…' : `Ask to add ${adding.label}`}
          </button>
        </div>
      )}
    </section>
  );

  return (
    <div className="min-h-screen bg-[#FFFAF5] print:bg-white">
      {/* Brand bar */}
      <div className="border-b border-[#C5A46D]/20 bg-[#1E0510] px-5 py-3 print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <p className="flex items-center gap-3 text-lg tracking-wide text-[#F3D9A4]" style={serif}>
            {p.brand.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- the business's own logo, an address stored by our own upload route
              <img src={p.brand.logoUrl} alt="" className="h-9 w-9 rounded-md bg-white object-contain p-0.5" />
            )}
            {contact.name}
          </p>
          {contact.phone && (
            <a
              href={`tel:${contact.phone.tel}`}
              className="text-xs font-medium text-white/75 hover:text-white"
            >
              {contact.phone.display}
            </a>
          )}
        </div>
      </div>

      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#2A0614] via-[#4A0B25] to-[#6B1238] px-5 pb-14 pt-12 text-white sm:pb-16 sm:pt-16 print:hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#C5A46D]/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Eyebrow light>Your wedding proposal</Eyebrow>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${TONE[status.tone]}`}
            >
              {status.label}
            </span>
          </div>
          <h1 className="mt-5 text-4xl leading-tight sm:text-5xl" style={serif}>
            {p.couple.name ?? 'Your wedding'}
          </h1>
          <p className="mt-2 text-2xl italic text-[#E8C98A]" style={script}>
            Curated for your celebration
          </p>
          {facts.length > 0 && (
            <p className="mt-5 text-sm tracking-wide text-white/85">{facts.join('  ·  ')}</p>
          )}
          {p.venueName && (
            <p className="mt-1 text-sm text-white/85">
              Venue · <span className="font-semibold text-white">{p.venueName}</span>
            </p>
          )}
          <p className="mt-6 text-xs text-white/55">
            Proposal {p.number} · Version {p.version}
            {validUntil && <> · Valid until {validUntil}</>}
          </p>
        </div>
      </header>

      {/* The two experiences */}
      <div
        id="views"
        className="sticky top-0 z-20 scroll-mt-0 border-b border-[#E8DCC8] bg-[#FFFAF5]/95 backdrop-blur print:hidden"
      >
        <div role="tablist" aria-label="Proposal views" className="mx-auto flex max-w-3xl overflow-x-auto px-5 [scrollbar-width:none]">
          {(
            [
              ['proposal', 'Your proposal'],
              ['quotation', 'Detailed quotation'],
              ...(p.payments ? [['payments', 'Payments']] : []),
              ...(p.reviews ? [['reviews', 'Reviews']] : []),
            ] as [ProposalTab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => open(key)}
              className={`relative flex-1 shrink-0 whitespace-nowrap px-3 py-4 text-sm font-medium transition ${tab === key ? 'text-[#8B1A4A]' : 'text-[#7A6556] hover:text-[#2A1F1B]'}`}
              style={serif}
            >
              {label}
              {tab === key && (
                <span className="absolute inset-x-6 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-[#C5A46D] to-transparent" />
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-3xl space-y-6 px-5 py-8 sm:py-10 print:max-w-none print:px-0 print:py-0">
        {/* The opening "take a look below" only belongs on the proposal; any other state message shows on both. */}
        {(tab === 'proposal' || p.state !== 'OPEN' || p.changesRequested) && (
          <div
            role="status"
            className="rounded-2xl border border-[#E8DCC8] bg-white p-4 text-sm leading-relaxed text-[#2A1F1B] print:hidden"
          >
            {p.yourBooking ? coupleBookingWords(p.yourBooking, contact.name).line : nextStep(p)}
          </div>
        )}

        {tab === 'proposal' ? (
          <div role="tabpanel" aria-label="Your proposal" className="space-y-10">
            {p.yourBooking && <YourBookingPanel booking={p.yourBooking} businessName={contact.name} />}
            {groups.map((group, gi) => (
              <section key={group.title ?? gi} className="space-y-5">
                {group.title && <Eyebrow>{group.title}</Eyebrow>}
                {group.items.map((item, i) => (
                  <ServiceShowcase key={i} item={item} grouped={!!group.title} />
                ))}
              </section>
            ))}

            {p.confirmedVendors.length > 0 && (
              <section
                className="rounded-[24px] border border-emerald-200 bg-white p-6"
                aria-label="Your confirmed vendors"
              >
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-800">
                  Your confirmed vendors
                </h2>
                <ul className="mt-4 space-y-2 text-sm">
                  {p.confirmedVendors.map((v, i) => (
                    <li key={i} className="rounded-xl bg-emerald-50/60 p-3">
                      <p className="font-semibold text-[#2A1F1B]">{v.name}</p>
                      <p className="text-[#6B5B4D]">
                        {[v.category, capitalize(v.function), formatDate(v.date), v.venueName]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Key commercial information only — the breakdown lives in the detailed quotation. */}
            <section className="overflow-hidden rounded-[24px] bg-gradient-to-br from-[#2A0614] to-[#5A0F2E] p-6 text-white sm:p-8">
              <Eyebrow light>At a glance</Eyebrow>
              <dl className="mt-5 space-y-3">
                {proposalHighlights(p).map((row, i) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-4">
                    <dt className={i === 0 ? 'text-sm text-white/80' : 'text-sm text-[#E8C98A]'}>
                      {row.label}
                    </dt>
                    <dd className={i === 0 ? 'text-3xl' : 'text-lg text-[#F3D9A4]'} style={serif}>
                      {rupees(row.amount)}
                    </dd>
                  </div>
                ))}
              </dl>
              <button
                type="button"
                onClick={() => open('quotation')}
                className="mt-7 min-h-[52px] w-full rounded-full bg-gradient-to-r from-[#C5A46D] to-[#E8C98A] px-6 text-[15px] font-semibold text-[#2A0614] shadow-[0_12px_32px_rgba(197,164,109,0.25)]"
              >
                {p.state === 'OPEN' ? 'Review quotation & accept' : 'View detailed quotation'}
              </button>
              {p.payments && (
                <button
                  type="button"
                  onClick={() => open('payments')}
                  className="mt-3 min-h-[48px] w-full rounded-full border border-[#E8C98A]/60 px-6 text-sm font-semibold text-[#F3D9A4]"
                >
                  {p.payments.outstanding > 0 && !p.payments.bookingConfirmed ? 'Pay & confirm your booking' : 'Payments & receipts'}
                </button>
              )}
              {p.reviews && (
                <button
                  type="button"
                  onClick={() => open('reviews')}
                  className="mt-3 min-h-[48px] w-full rounded-full border border-[#E8C98A]/60 px-6 text-sm font-semibold text-[#F3D9A4]"
                >
                  Review your vendors
                </button>
              )}
            </section>

            {addEventBlock}
            {requestChangesBlock}
          </div>
        ) : tab === 'reviews' && p.reviews ? (
          <ReviewsPanel token={token} initial={p.reviews} />
        ) : tab === 'payments' && p.payments ? (
          <PaymentsPanel token={token} number={p.number} coupleName={p.couple.name} weddingDate={p.wedding.date} initial={p.payments} from={{ name: contact.name, phone: contact.phone?.display ?? null, whatsApp: contact.isPlatform ? null : (contact.phone?.whatsApp ?? null) }} />
        ) : (
          <div role="tabpanel" aria-label="Detailed quotation" className="space-y-6">
            {/* Printed header — the on-screen hero does not print. */}
            <div className="hidden print:block">
              <p className="text-xl" style={serif}>
                {contact.name} — Quotation {p.number}
              </p>
              <p className="text-sm">
                {[p.couple.name, ...facts, p.venueName ? `Venue: ${p.venueName}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="text-xs">
                Version {p.version}
                {validUntil && <> · Valid until {validUntil}</>}
                {contact.phone && <> · {contact.phone.display}</>}
                {p.brand.gstin && <> · GSTIN {p.brand.gstin}</>}
              </p>
            </div>

            <section className="rounded-[24px] bg-white p-5 shadow-[0_20px_60px_rgba(42,6,20,0.06)] ring-1 ring-[#E8DCC8]/70 sm:p-8 print:p-0 print:shadow-none print:ring-0">
              <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
                <div>
                  <Eyebrow>Detailed quotation</Eyebrow>
                  <p className="mt-2 text-sm text-[#7A6556]">
                    {p.number} · Version {p.version}
                    {validUntil && <> · Valid until {validUntil}</>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-full border border-[#E8DCC8] px-4 py-2 text-xs font-semibold text-[#8B1A4A] hover:border-[#C5A46D]"
                >
                  Download / print
                </button>
              </div>

              {p.brand.gstin && (
                <p className="mt-3 text-xs text-[#7A6556] print:hidden">
                  {contact.name} · GSTIN <span className="font-medium tracking-wide text-[#4A3F38]">{p.brand.gstin}</span>
                </p>
              )}
              <div className="mt-4">
                <QuotationTable items={p.items} />
              </div>

              <dl className="ml-auto mt-5 max-w-sm space-y-2 text-sm">
                {quotationSummary(p).map((row) => (
                  <div
                    key={row.label}
                    className={`flex justify-between gap-4 ${row.kind === 'total' ? 'border-t border-[#E8DCC8] pt-3 text-lg font-semibold text-[#2A1F1B]' : row.kind === 'discount' ? 'text-emerald-700' : row.kind === 'advance' ? 'text-[#8B1A4A]' : 'text-[#5A4A40]'}`}
                  >
                    <dt>{row.label}</dt>
                    <dd className="tabular-nums">
                      {row.kind === 'discount' ? '− ' : ''}
                      {rupees(row.amount)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <TextBlock title="What's included" text={p.inclusions} />
            <TextBlock title="What's not included" text={p.exclusions} />
            <TextBlock title="Terms" text={p.terms} />

            {p.state === 'OPEN' && (
              <section className="space-y-4 rounded-[24px] border border-[#C5A46D]/40 bg-white p-6 sm:p-8 print:hidden">
                <Eyebrow>Accept</Eyebrow>
                <label className="flex items-start gap-3 rounded-xl border border-[#F0E6D6] bg-[#FFFAF5] p-4 text-sm text-[#2A1F1B]">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    className="mt-0.5 h-5 w-5 accent-[#8B1A4A]"
                  />
                  <span>I have read this quotation and agree to its terms.</span>
                </label>
                <button
                  type="button"
                  onClick={accept}
                  disabled={!agree || busy !== null}
                  className="min-h-[52px] w-full rounded-full bg-gradient-to-r from-[#8B1A4A] via-[#9E2A55] to-[#C5A46D] px-6 text-base font-semibold text-white shadow-[0_12px_32px_rgba(139,26,74,0.25)] disabled:opacity-40 disabled:shadow-none"
                >
                  {busy === 'accept' ? 'Accepting…' : 'Accept this quotation'}
                </button>
                {requestChangesBlock}
              </section>
            )}

            <button
              type="button"
              onClick={() => open('proposal')}
              className="text-sm font-medium text-[#8B1A4A] underline decoration-[#C5A46D] underline-offset-4 print:hidden"
            >
              ← Back to your proposal
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600 print:hidden">
            {error}
          </p>
        )}

        {contact.phone && (
          <p className="pt-2 text-center text-sm text-[#6B5B4D] print:hidden">
            Questions? Call{' '}
            <a href={`tel:${contact.phone.tel}`} className="font-semibold text-[#8B1A4A]">
              {contact.phone.display}
            </a>{' '}
            or{' '}
            <a
              href={contact.phone.whatsApp(
                `Hi, I have a question about my wedding proposal ${p.number}.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#8B1A4A]"
            >
              WhatsApp us
            </a>
          </p>
        )}
        {/* Below the venue's own "Questions?" line and only on the proposal view — never beside the quotation's numbers. */}
        {shaadi && tab === 'proposal' && (
          <section aria-label="Shaadi Shopping" className="space-y-4 rounded-[24px] border border-[#E8DCC8] bg-white p-6 sm:p-8 print:hidden">
            <Eyebrow>The rest of your wedding</Eyebrow>
            <h2 className="text-2xl leading-snug text-[#2A1F1B]" style={serif}>
              Planned around your guests and your budget
            </h2>
            <p className="text-sm leading-relaxed text-[#4A3F38]">
              Still putting the rest of your wedding together? Shaadi Shopping plans it with you — decoration, photography, mehndi, makeup
              and more — around your guests and what you want to spend.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={shaadi.whatsApp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[48px] flex-1 items-center justify-center rounded-full bg-[#8B1A4A] px-6 text-sm font-semibold text-white"
              >
                WhatsApp Shaadi Shopping
              </a>
              <a
                href={`tel:${shaadi.tel}`}
                className="flex min-h-[48px] flex-1 items-center justify-center rounded-full border border-[#8B1A4A]/40 px-6 text-sm font-semibold text-[#8B1A4A]"
              >
                Call {shaadi.display}
              </a>
            </div>
            <p className="text-xs leading-relaxed text-[#6B5B4D]">
              Shaadi Shopping is a separate service. Your quotation on this page is with {shaadi.venueName} — for anything about it, please
              contact {shaadi.venueName}.
            </p>
          </section>
        )}
        {!contact.isPlatform && (
          <p className="text-center text-xs text-[#6B5B4D]/70 print:hidden">Powered by Vivah OS</p>
        )}
        <div className="pb-8 print:hidden" />
      </main>
    </div>
  );
}
