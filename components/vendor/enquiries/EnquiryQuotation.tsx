'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, Plus, Trash2 } from 'lucide-react';
import { Card, CardSkeleton } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import StatusPill, { type PillStatus } from '@/components/ui/StatusPill';
import { requiredConfirmation } from '@/lib/commercial/rules';
import Link from 'next/link';
import { whatsappTo } from '@/lib/venue/enquiry';
import { FUNCTION_TYPES, FUNCTION_TYPE_LABELS, groupOfferings, offeringPriceWords, type FunctionType, type Offering } from '@/lib/venue/offering';
import { QUOTE_STAGE_LABEL, quoteShareMessage, VENUE_QUOTE_LIMITS, type QuoteStage, type VenueQuoteErrors } from '@/lib/venue/quotation';
import { gstPercentText, gstTotals, parseGstPercent } from '@/lib/quotation/lineGst';
import type { VenueQuotationState, VenueQuotationView } from '@/services/venueQuotation.service';
import BookingMoney from './BookingMoney';

// The venue's own quotation for one of its own enquiries (Phase C): write it, send it with the couple's link on WhatsApp, and see
// what the couple did — opened it, asked for changes, accepted. Phone-first. No totals are typed: the total is the lines minus the
// discount plus GST, and the amount that confirms the booking is the venue's own rule (Settings).
// GST (6 Oct 2026): each line has its own "GST %" box, empty until the venue types a rate — there is no default. The form shows the
// GST and the line total as they type, worked out by the same code the server uses (lib/quotation/lineGst.ts).

type Line = { description: string; quantity: string; unitPrice: string; function: FunctionType | ''; gstPercent: string };
type Form = { items: Line[]; discount: string; validUntil: string; inclusions: string; exclusions: string; terms: string };

const TONE: Record<QuoteStage, PillStatus> = { DRAFT: 'dateHeld', SENT: 'info', CHANGES: 'overdue', ACCEPTED: 'confirmed', ENDED: 'neutral' };
const big = 'flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold';
const primary = `${big} w-full bg-[var(--primary)] text-[var(--color-on-primary)] disabled:opacity-50`;
const secondary = `${big} w-full border border-[var(--color-border-default)] text-[var(--color-text-primary)] disabled:opacity-50`;

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const istDay = (offsetDays = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + offsetDays * 86_400_000));
const dayWords = (value: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(value.length === 10 ? `${value}T12:00:00+05:30` : value));
const num = (raw: string) => Number(raw.replace(/[₹,\s]/g, '')) || 0;

const FUNCTION_OPTIONS = [{ value: '', label: 'Not for one function' }, ...FUNCTION_TYPES.map((fn) => ({ value: fn, label: FUNCTION_TYPE_LABELS[fn] }))];
const emptyLine = (): Line => ({ description: '', quantity: '1', unitPrice: '', function: '', gstPercent: '' });
const blankForm = (): Form => ({ items: [emptyLine()], discount: '', validUntil: istDay(7), inclusions: '', exclusions: '', terms: '' });
const formOf = (q: VenueQuotationView): Form => ({
  items: q.items.map((i) => ({ description: i.description, quantity: String(i.quantity), unitPrice: String(i.unitPrice), function: i.function ?? '', gstPercent: i.gstRateBp === null ? '' : gstPercentText(i.gstRateBp) })),
  discount: q.discount ? String(q.discount) : '',
  validUntil: q.validUntil && q.validUntil >= istDay() ? q.validUntil : istDay(7),
  inclusions: q.inclusions ?? '',
  exclusions: q.exclusions ?? '',
  terms: q.terms ?? '',
});

export default function EnquiryQuotation({ enquiryId, closed, onChanged }: { enquiryId: string; closed: boolean; onChanged: () => void }) {
  const [state, setState] = useState<VenueQuotationState | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(blankForm);
  const [errors, setErrors] = useState<VenueQuoteErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null); // the couple's link — the server shows it once
  const [copied, setCopied] = useState(false);
  const [weddingDate, setWeddingDate] = useState('');

  const api = `/api/vendor-os/enquiries/${enquiryId}/quotation`;

  useEffect(() => {
    let live = true;
    fetch(api)
      .then((r) => r.json())
      .then((b) => live && (b.success ? setState(b.data) : setError(b.error ?? 'The quotation could not be loaded.')))
      .catch(() => live && setError('Could not reach Vivah OS — please check your connection.'));
    return () => {
      live = false;
    };
  }, [api]);

  // One request at a time; on success the enquiry above is refreshed too (its next step and history changed).
  async function call(path: string, body?: unknown, method = 'POST'): Promise<(VenueQuotationState & { linkPath?: string }) | null> {
    if (busy) return null;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${api}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.success) {
        setState(b.data);
        setErrors({});
        if (b.data.linkPath) {
          setLink(`${window.location.origin}${b.data.linkPath}`);
          setCopied(false);
        }
        onChanged();
        setBusy(false);
        return b.data;
      }
      setErrors(b.fieldErrors ?? {});
      const onlyGstNumber = b.fieldErrors && Object.keys(b.fieldErrors).length === 1 && 'gst' in b.fieldErrors;
      setError(onlyGstNumber ? null : b.fieldErrors ? 'Please check the highlighted boxes.' : (b.error ?? 'Something went wrong. It was not saved — please try again.'));
    } catch {
      setError('Could not reach Vivah OS. It was not saved — please check your connection.');
    }
    setBusy(false);
    return null;
  }

  if (!state) return error ? <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p> : <CardSkeleton lines={2} />;

  const q = state.quotation;
  const first = state.customer.name.split(' ')[0];
  const percent = state.rules.confirmationPercent;

  const setLine = (i: number, key: keyof Line, value: string) => {
    setForm((f) => ({ ...f, items: f.items.map((l, n) => (n === i ? { ...l, [key]: value } : l)) }));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== `items.${i}.${key}` && k !== 'items' && k !== 'gst')));
  };
  const setField = (key: Exclude<keyof Form, 'items'>, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)));
  };
  // One tap adds a line from the venue's "What we offer" list — it carries its function (Haldi, Reception …).
  const addOffering = (o: Offering) =>
    setForm((f) => {
      const line: Line = { description: o.perPlate ? `${o.name} (per plate)` : o.name, quantity: '1', unitPrice: String(o.price), function: o.function, gstPercent: '' };
      const only = f.items.length === 1 && !f.items[0].description.trim() && !f.items[0].unitPrice.trim();
      return { ...f, items: only ? [line] : [...f.items, line] };
    });
  const addPackage = (p: VenueQuotationState['packages'][number]) =>
    setForm((f) => {
      const line: Line = { description: p.perPlate ? `${p.name} (per plate)` : p.name, quantity: '1', unitPrice: String(p.price), function: '', gstPercent: '' };
      const only = f.items.length === 1 && !f.items[0].description.trim() && !f.items[0].unitPrice.trim();
      return { ...f, items: only ? [line] : [...f.items, line] };
    });

  const startEditing = () => {
    setForm(q?.stage === 'DRAFT' ? formOf(q) : blankForm());
    setErrors({});
    setError(null);
    setEditing(true);
  };

  async function save() {
    if (await call('', form, 'PUT')) setEditing(false);
  }

  // A sent / expired quotation is changed through a new draft, opened for editing straight away.
  async function revise() {
    const next = await call('/revise');
    if (next?.quotation) {
      setLink(null);
      setForm(formOf(next.quotation));
      setEditing(true);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const money = gstTotals(form.items.map((l) => ({ quantity: num(l.quantity), unitPrice: num(l.unitPrice), gstRateBp: parseGstPercent(l.gstPercent) ?? null })), num(form.discount));
  const total = money.total;

  const heading = (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Quotation{q ? ` ${q.number}` : ''}</h2>
      {q && !editing && <StatusPill status={TONE[q.stage]}>{QUOTE_STAGE_LABEL[q.stage]}</StatusPill>}
    </div>
  );

  if (editing) {
    return (
      <section aria-label="Quotation" className="space-y-3">
        {heading}
        <Card className="space-y-4">
          {groupOfferings(state.offerings).map((g) => (
            <div key={g.function}>
              <p className="mb-2 text-xs font-medium text-[var(--color-text-muted)]">Add for {g.label}</p>
              <div className="flex flex-wrap gap-2">
                {g.items.map((o) => (
                  <button key={o.id} type="button" onClick={() => addOffering(o)} className="min-h-10 rounded-full border border-[var(--color-border-default)] px-3 text-sm text-[var(--color-text-primary)]">
                    {o.name} · {offeringPriceWords(o)}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {state.offerings.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)]">
              Tip: add your services and prices for each function in <Link href="/vendor/offerings" className="font-medium text-[var(--primary)] underline underline-offset-2">What we offer</Link> — they will appear here as one-tap lines.
            </p>
          )}
          {state.packages.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-[var(--color-text-muted)]">Add from your packages</p>
              <div className="flex flex-wrap gap-2">
                {state.packages.map((p) => (
                  <button key={`${p.name}-${p.price}`} type="button" onClick={() => addPackage(p)} className="min-h-10 rounded-full border border-[var(--color-border-default)] px-3 text-sm text-[var(--color-text-primary)]">
                    {p.name} · {inr(p.price)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <ul className="space-y-4">
            {form.items.map((l, i) => (
              <li key={i} className="space-y-2 border-b border-[var(--color-border-subtle)] pb-4 last:border-b-0 last:pb-0">
                <Input label={`Line ${i + 1}`} value={l.description} onChange={(ev) => setLine(i, 'description', ev.target.value)} error={errors[`items.${i}.description`]} placeholder="Hall for the reception" maxLength={VENUE_QUOTE_LIMITS.descriptionMax} className="min-h-12 text-base" />
                <Select label="For which function? (optional)" value={l.function} onChange={(ev) => setLine(i, 'function', ev.target.value)} error={errors[`items.${i}.function`]} options={FUNCTION_OPTIONS} className="min-h-12 text-base" />
                <div className="grid grid-cols-[1fr_1.5fr_auto] items-start gap-2">
                  <Input label="How many" inputMode="numeric" value={l.quantity} onChange={(ev) => setLine(i, 'quantity', ev.target.value)} error={errors[`items.${i}.quantity`]} className="min-h-12 text-base" />
                  <Input label="Price each (₹)" inputMode="numeric" value={l.unitPrice} onChange={(ev) => setLine(i, 'unitPrice', ev.target.value)} error={errors[`items.${i}.unitPrice`]} placeholder="200000" className="min-h-12 text-base" />
                  <button type="button" aria-label={`Remove line ${i + 1}`} disabled={form.items.length === 1} onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, n) => n !== i) }))} className="mt-6 flex min-h-12 min-w-12 items-center justify-center rounded-lg text-[var(--color-text-muted)] disabled:opacity-30">
                    <Trash2 className="h-5 w-5" aria-hidden />
                  </button>
                </div>
                <div className="grid grid-cols-[7rem_1fr] items-start gap-3">
                  <Input label="GST %" inputMode="decimal" value={l.gstPercent} onChange={(ev) => setLine(i, 'gstPercent', ev.target.value.replace(/[^0-9.]/g, '').slice(0, 5))} error={errors[`items.${i}.gstPercent`] ?? (parseGstPercent(l.gstPercent) === undefined ? 'Enter a rate like 5, 12 or 18' : undefined)} placeholder="e.g. 18" helperText="Empty = no GST" className="min-h-12 text-base" />
                  <dl className="mt-6 space-y-0.5 rounded-lg bg-[var(--color-bg-surface-muted)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                    <div className="flex justify-between"><dt>Amount</dt><dd>{inr(money.lines[i].amount)}</dd></div>
                    {money.lines[i].discount > 0 && <div className="flex justify-between"><dt>After discount</dt><dd>{inr(money.lines[i].taxable)}</dd></div>}
                    <div className="flex justify-between"><dt>GST{money.lines[i].gstRateBp ? ` at ${gstPercentText(money.lines[i].gstRateBp as number)}%` : ''}</dt><dd>{money.lines[i].gstRateBp ? inr(money.lines[i].gst) : '—'}</dd></div>
                    <div className="flex justify-between font-semibold text-[var(--color-text-primary)]"><dt>Line total</dt><dd>{inr(money.lines[i].taxable + money.lines[i].gst)}</dd></div>
                  </dl>
                </div>
              </li>
            ))}
          </ul>
          {errors.items && <p role="alert" className="text-xs text-[var(--color-danger-text)]">{errors.items}</p>}
          {form.items.length < VENUE_QUOTE_LIMITS.maxLines && (
            <button type="button" onClick={() => setForm((f) => ({ ...f, items: [...f.items, emptyLine()] }))} className={secondary}>
              <Plus className="h-5 w-5" aria-hidden /> Add a line
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input label="Discount (₹)" inputMode="numeric" value={form.discount} onChange={(ev) => setField('discount', ev.target.value)} error={errors.discount} helperText="If any" className="min-h-12 text-base" />
            <Input label="Valid until" type="date" min={istDay()} value={form.validUntil} onChange={(ev) => setField('validUntil', ev.target.value)} error={errors.validUntil} className="min-h-12 text-base" />
          </div>
          <Textarea label="What is included (optional)" value={form.inclusions} onChange={(ev) => setField('inclusions', ev.target.value)} error={errors.inclusions} rows={3} placeholder="Hall and lawn, basic lighting, parking…" />
          <Textarea label="What is not included (optional)" value={form.exclusions} onChange={(ev) => setField('exclusions', ev.target.value)} error={errors.exclusions} rows={2} placeholder="Decoration, DJ…" />
          <Textarea label="Terms (optional)" value={form.terms} onChange={(ev) => setField('terms', ev.target.value)} error={errors.terms} rows={3} placeholder="Balance before the event, cancellation…" />

          <dl className="space-y-1 rounded-lg bg-[var(--color-bg-subtle,transparent)] text-sm">
            <div className="flex justify-between text-[var(--color-text-secondary)]"><dt>Subtotal</dt><dd>{inr(money.subtotal)}</dd></div>
            {money.discount > 0 && <div className="flex justify-between text-[var(--color-text-secondary)]"><dt>Discount</dt><dd>− {inr(money.discount)}</dd></div>}
            {money.gst > 0 && <div className="flex justify-between text-[var(--color-text-secondary)]"><dt>GST</dt><dd>+ {inr(money.gst)}</dd></div>}
            <div className="flex justify-between border-t border-[var(--color-border-subtle)] pt-1 font-semibold text-[var(--color-text-primary)]"><dt>Total</dt><dd>{inr(total)}</dd></div>
            <div className="flex justify-between text-[var(--color-text-secondary)]"><dt>To confirm the booking ({percent}%)</dt><dd>{inr(requiredConfirmation(total, { confirmationPercent: percent }))}</dd></div>
          </dl>

          {errors.gst && (
            <p role="alert" className="rounded-lg border border-[var(--color-danger-default)]/40 p-3 text-sm text-[var(--color-danger-text)]">
              {errors.gst}. <Link href="/vendor/profile" className="font-semibold underline underline-offset-2">Open your business profile</Link>
            </p>
          )}
          {error && <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>}
          <button type="button" disabled={busy} onClick={save} className={primary}>{busy ? 'Saving…' : 'Save quotation'}</button>
          <button type="button" disabled={busy} onClick={() => { setEditing(false); setError(null); setErrors({}); }} className={secondary}>Cancel</button>
        </Card>
      </section>
    );
  }

  if (!q) {
    if (closed) return null;
    return (
      <section aria-label="Quotation" className="space-y-3">
        {heading}
        <Card className="space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)]">Send {first} your price — they can open it on their phone and accept it or ask for changes.</p>
          <button type="button" onClick={startEditing} className={primary}>Make a quotation</button>
        </Card>
      </section>
    );
  }

  const share = link ? whatsappTo(state.customer.phone, quoteShareMessage({ customerName: state.customer.name, venueName: state.venueName, number: q.number, total: q.total, url: link })) : null;

  return (
    <section aria-label="Quotation" className="space-y-3">
      {heading}
      <Card className="space-y-4">
        {/* Who the quotation is from — what the customer sees at the top of the document. */}
        <div className="flex items-center gap-3 border-b border-[var(--color-border-subtle)] pb-3">
          {q.letterhead.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- the business's own logo, an address we stored ourselves
            <img src={q.letterhead.logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-[var(--color-border-subtle)] bg-white object-contain p-1" />
          ) : (
            <Link href="/vendor/profile" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-[var(--color-border-default)] text-center text-[10px] leading-tight text-[var(--color-text-muted)]">Add logo</Link>
          )}
          <div className="min-w-0">
            <p className="truncate font-playfair text-base font-bold text-[var(--color-text-primary)]">{q.letterhead.name}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{q.letterhead.gstin ? `GSTIN ${q.letterhead.gstin}` : 'No GST number on this quotation'}</p>
          </div>
        </div>
        <ul className="space-y-2 text-sm">
          {q.items.map((i, n) => (
            <li key={n} className="flex justify-between gap-3">
              <span className="text-[var(--color-text-primary)]">{i.function && <span className="text-[var(--color-text-muted)]">{FUNCTION_TYPE_LABELS[i.function]} · </span>}{i.description}{i.quantity > 1 && <span className="text-[var(--color-text-muted)]"> · {i.quantity.toLocaleString('en-IN')} × {inr(i.unitPrice)}</span>}</span>
              <span className="shrink-0 text-right text-[var(--color-text-primary)]">
                {inr(i.lineTotal)}
                {i.gstRateBp !== null && i.gstRateBp > 0 && <span className="block text-xs text-[var(--color-text-muted)]">+ GST {gstPercentText(i.gstRateBp)}%{i.taxable !== i.lineTotal && <> on {inr(i.taxable)}</>} {inr(i.gst)}</span>}
              </span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t border-[var(--color-border-subtle)] pt-3 text-sm">
          {(q.discount > 0 || q.gstAmount > 0) && <div className="flex justify-between text-[var(--color-text-secondary)]"><dt>Subtotal</dt><dd>{inr(q.subtotal)}</dd></div>}
          {q.discount > 0 && <div className="flex justify-between text-[var(--color-text-secondary)]"><dt>Discount</dt><dd>− {inr(q.discount)}</dd></div>}
          {q.gstAmount > 0 && <div className="flex justify-between text-[var(--color-text-secondary)]"><dt>GST</dt><dd>+ {inr(q.gstAmount)}</dd></div>}
          <div className="flex justify-between font-semibold text-[var(--color-text-primary)]"><dt>Total</dt><dd>{inr(q.total)}</dd></div>
          <div className="flex justify-between text-[var(--color-text-secondary)]"><dt>To confirm the booking ({q.confirmationPercent}%)</dt><dd>{inr(q.toConfirm)}</dd></div>
        </dl>

        {q.stage === 'DRAFT' && (
          <>
            <p className="text-sm text-[var(--color-text-secondary)]">Not sent yet{q.validUntil && <> · valid until {dayWords(q.validUntil)}</>}. Once sent it cannot be edited — you change it by making a new version.</p>
            <button type="button" disabled={busy} onClick={() => call('/send')} className={primary}>{busy ? 'Sending…' : `Send to ${first}`}</button>
            <button type="button" disabled={busy} onClick={startEditing} className={secondary}>Edit</button>
          </>
        )}

        {(q.stage === 'SENT' || q.stage === 'CHANGES') && (
          <>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {q.sentAt && <>Sent {dayWords(q.sentAt)}</>}
              {q.validUntil && <> · valid until {dayWords(q.validUntil)}</>}
              {' · '}
              {q.openedAt ? `${first} opened it ${dayWords(q.openedAt)}` : `${first} has not opened it yet`}
            </p>
            {q.stage === 'CHANGES' && (
              <div className="rounded-lg bg-[var(--color-warning-bg)] p-3 text-sm text-[var(--color-warning-text)]">
                <p className="font-semibold">{first} asked for changes</p>
                {q.changesNote && <p className="mt-1 whitespace-pre-line">{q.changesNote}</p>}
              </div>
            )}
            {link && share ? (
              <div className="space-y-2 rounded-lg border border-[var(--color-border-subtle)] p-3">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">Share this link with {first}</p>
                <p className="break-all text-xs text-[var(--color-text-secondary)]">{link}</p>
                <p className="text-xs text-[var(--color-text-muted)]">It is shown only now. If you lose it, make a new link — the old one then stops working.</p>
                <a href={share} target="_blank" rel="noopener noreferrer" className={primary}><MessageCircle className="h-5 w-5" aria-hidden /> Share on WhatsApp</a>
                <button type="button" onClick={copy} className={secondary}>{copied ? 'Copied' : 'Copy link'}</button>
              </div>
            ) : (
              <button type="button" disabled={busy} onClick={() => call('/link')} className={secondary}>{q.hasLink ? 'Make a new link (the old one stops working)' : `Make a link for ${first}`}</button>
            )}
            <button type="button" disabled={busy} onClick={revise} className={q.stage === 'CHANGES' ? primary : secondary}>Change the quotation</button>
          </>
        )}

        {q.stage === 'ACCEPTED' && (
          <>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {first} accepted{q.acceptedAt && <> on {dayWords(q.acceptedAt)}</>}. {inr(q.toConfirm)} ({q.confirmationPercent}%) confirms the booking.
            </p>
            {q.moneyHidden ? (
              <p className="text-sm text-[var(--color-text-secondary)]">The booking is made. Payments for it are kept by the owner of the business.</p>
            ) : q.booking ? (
              <BookingMoney q={q} money={q.booking} state={state} busy={busy} errors={errors} onPay={async (body) => (await call('/payments', body)) !== null} />
            ) : (
              <>
                {!state.customer.weddingDate && <Input label="Wedding date" type="date" min={istDay()} value={weddingDate} onChange={(ev) => setWeddingDate(ev.target.value)} helperText="Needed to make the booking" className="min-h-12 text-base" />}
                <button type="button" disabled={busy || (!state.customer.weddingDate && !weddingDate)} onClick={() => call('/book', { weddingDate })} className={primary}>{busy ? 'Saving…' : 'Make the booking'}</button>
              </>
            )}
            {q.wedding && (
              <Link href={`/vendor/weddings/${q.wedding.id}`} className={secondary}>Open the wedding · {q.wedding.number}</Link>
            )}
            {q.canCreateWedding && (
              <>
                <p className="text-sm text-[var(--color-text-secondary)]">The booking is confirmed. Create its wedding to plan the functions and see what is still to do.</p>
                <button type="button" disabled={busy} onClick={() => call('/wedding')} className={primary}>{busy ? 'Creating…' : 'Create the wedding'}</button>
              </>
            )}
          </>
        )}

        {q.stage === 'ENDED' && (
          <>
            <p className="text-sm text-[var(--color-text-secondary)]">This quotation is no longer valid{q.validUntil && <> — it was valid until {dayWords(q.validUntil)}</>}.</p>
            {!closed && <button type="button" disabled={busy} onClick={revise} className={primary}>Make a new one from this</button>}
          </>
        )}

        {error && <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>}
      </Card>
    </section>
  );
}
