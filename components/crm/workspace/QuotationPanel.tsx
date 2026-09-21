'use client';

import { forwardRef, useImperativeHandle, useState } from 'react';
import { formatQuoteDate } from '@/lib/quotation/message';
import { bookingChip, quotationChip, type JourneyState } from '@/lib/crm/leadJourney';
import { StatusChip } from './JourneyParts';
import { errorMessage, type QuotationsApi } from './useQuotations';
import type { WorkspaceQuotation } from './types';
import QuotationHistory from './QuotationHistory';

// The quotation card (docs/wedding-os/08-quotation.md). It shows the CURRENT quotation like a document you could hand to
// a customer — services, quantity × price, total, advance, balance, validity — with the quotation's status and the
// booking's status as two separate chips, so "Accepted" is never mistaken for "Booked". Earlier versions sit below it.
//
// What to DO next (send, follow up, record acceptance, create/confirm the booking, not proceeding) lives in the Next-action
// card and its dialogs (LeadWorkspaceClient); this card keeps only the actions that belong to the document itself: edit or
// discard a draft, revise a sent quote. Totals shown while typing are only a preview — the server recomputes and stores the
// real ones. V1 has no customer login or link: staff record the customer's answer on their behalf.

const CHANNEL_LABEL: Record<string, string> = { WHATSAPP: 'WhatsApp', PHONE: 'phone', IN_PERSON: 'in person', OTHER: 'another channel' };

export interface QuotationPrefillLine {
  description: string;
  category?: string;
  vendorId?: string;
}

interface DraftLine {
  description: string;
  category: string;
  functionLabel: string;
  vendorId: string;
  unitPrice: string;
  quantity: string;
}

interface Draft {
  items: DraftLine[];
  discount: string;
  gstEnabled: boolean;
  gstAmount: string;
  advanceAmount: string;
  validUntil: string; // YYYY-MM-DD
  terms: string;
  notes: string;
}

const emptyLine = (): DraftLine => ({ description: '', category: '', functionLabel: '', vendorId: '', unitPrice: '', quantity: '1' });

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const toNumber = (value: string) => Math.max(0, Math.floor(Number(value) || 0));

function draftFromPrefill(prefill: QuotationPrefillLine[]): Draft {
  return {
    items: prefill.length
      ? prefill.map((p) => ({ ...emptyLine(), description: p.description, category: p.category ?? '', vendorId: p.vendorId ?? '' }))
      : [emptyLine()],
    discount: '',
    gstEnabled: false,
    gstAmount: '',
    advanceAmount: '',
    validUntil: '',
    terms: '',
    notes: '',
  };
}

function draftFromQuotation(q: WorkspaceQuotation): Draft {
  return {
    items: q.items.map((i) => ({
      description: i.description,
      category: i.category ?? '',
      functionLabel: i.functionLabel ?? '',
      vendorId: i.vendorId ?? '',
      unitPrice: String(i.unitPrice),
      quantity: String(i.quantity),
    })),
    discount: q.discount ? String(q.discount) : '',
    gstEnabled: q.gstEnabled,
    gstAmount: q.gstAmount ? String(q.gstAmount) : '',
    advanceAmount: q.advanceAmount ? String(q.advanceAmount) : '',
    validUntil: q.validUntil ? q.validUntil.slice(0, 10) : '',
    terms: q.terms ?? '',
    notes: q.notes ?? '',
  };
}

// Preview only — mirrors lib/quotation/totals.ts, which is the authority.
function previewTotals(d: Draft) {
  const subtotal = d.items.reduce((sum, i) => sum + toNumber(i.unitPrice) * Math.max(1, toNumber(i.quantity)), 0);
  const discount = toNumber(d.discount);
  const gst = d.gstEnabled ? toNumber(d.gstAmount) : 0;
  const total = Math.max(0, subtotal - discount + gst);
  const advance = toNumber(d.advanceAmount);
  return { subtotal, total, advance, balance: total - advance };
}

export interface QuotationPanelHandle {
  startCreate: () => void;
  startEdit: () => void;
  // Opens the price editor on a revision that was just created, so "Revise" ends with the prices ready to change.
  editRevision: (revision: WorkspaceQuotation) => void;
}

const BOX_CLASS = {
  amber: 'border border-amber-200 bg-amber-100 text-amber-900',
  green: 'bg-emerald-100 text-emerald-900',
  slate: 'bg-slate-200 text-slate-800',
  red: 'bg-red-50 text-red-800',
} as const;

const QuotationPanel = forwardRef<
  QuotationPanelHandle,
  {
    api: QuotationsApi;
    current: WorkspaceQuotation | null;
    state: JourneyState;
    sourceType: string;
    sourceId: string;
    readOnly: boolean; // the source already converted to a Wedding
    prefill: QuotationPrefillLine[];
    customerName: string;
    eventDate: string | null; // shown under the number, only when it is a real date
    guestCount: number | null;
    weddingNumber: string | null;
    closedReason: string | null;
    onChanged: () => void;
  }
>(function QuotationPanel(
  { api, current, state, sourceType, sourceId, readOnly, prefill, customerName, eventDate, guestCount, weddingNumber, closedReason, onChanged },
  ref
) {
  const { quotations, loadError, notice, busyId, load, act } = api;
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    startCreate: () => setEditing({ id: null, draft: draftFromPrefill(prefill) }),
    startEdit: () => {
      if (current?.status === 'DRAFT') setEditing({ id: current.id, draft: draftFromQuotation(current) });
    },
    editRevision: (revision) => setEditing({ id: revision.id, draft: draftFromQuotation(revision) }),
  }));

  const save = async () => {
    if (!editing || saving) return;
    setSaving(true);
    setFormError(null);
    const d = editing.draft;
    const body = {
      items: d.items.map((i) => ({
        description: i.description,
        category: i.category || null,
        functionLabel: i.functionLabel || null,
        vendorId: i.vendorId || null,
        unitPrice: toNumber(i.unitPrice),
        quantity: Math.max(1, toNumber(i.quantity)),
      })),
      discount: toNumber(d.discount),
      gstEnabled: d.gstEnabled,
      gstAmount: d.gstEnabled ? toNumber(d.gstAmount) : 0,
      advanceAmount: toNumber(d.advanceAmount),
      validUntil: d.validUntil || null,
      terms: d.terms || null,
      notes: d.notes || null,
    };
    try {
      const res = await fetch(editing.id ? `/api/quotations/${editing.id}` : '/api/quotations', {
        method: editing.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing.id ? body : { sourceType, sourceId, ...body }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(errorMessage(payload));
      setEditing(null);
      load();
      onChanged();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this draft quote?')) return;
    await act(id, '');
  };

  const setLine = (index: number, patch: Partial<DraftLine>) =>
    setEditing((e) => (e ? { ...e, draft: { ...e.draft, items: e.draft.items.map((l, i) => (i === index ? { ...l, ...patch } : l)) } } : e));
  const setDraft = (patch: Partial<Draft>) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e));

  const inputClass =
    'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-colors';
  const busy = current ? busyId === current.id : false;
  const acceptedWhen = current?.acceptedAt ? formatQuoteDate(current.acceptedAt) : null;
  const acceptedVia = current?.acceptedChannel ? CHANNEL_LABEL[current.acceptedChannel] ?? current.acceptedChannel : null;

  // The one coloured note under the totals. Its words come from the stored data (dates, channel, invoice) — never fixed text.
  const note = (() => {
    if (!current) return null;
    const accepted = current.status === 'ACCEPTED';
    const acceptedLine = accepted ? `Accepted by ${customerName}${acceptedWhen ? ` on ${acceptedWhen}` : ''}${acceptedVia ? ` via ${acceptedVia}` : ''}` : '';
    if (state === 'BOOKING_CONFIRMED' && accepted) {
      return {
        tone: 'green' as const,
        title: `Booking confirmed${weddingNumber ? ` · ${weddingNumber}` : ''}`,
        lines: current.advanceInvoice ? [`Advance invoice ${current.advanceInvoice.invoiceNumber} — ${rupees(current.advanceAmount)} (${current.advanceInvoice.status.toLowerCase()})`] : [],
      };
    }
    if (state === 'NOT_PROCEEDING' && accepted) {
      return { tone: 'slate' as const, title: `${acceptedLine} — did not proceed`, lines: [`${closedReason ?? 'Marked as not proceeding'}. The quotation is kept as a record.`] };
    }
    if (state === 'BOOKING_PENDING' && accepted) {
      return { tone: 'amber' as const, title: `${acceptedLine} · booking created, waiting for confirmation`, lines: current.acceptedNote ? [current.acceptedNote] : [] };
    }
    if (state === 'ACCEPTED' && accepted) {
      return { tone: 'amber' as const, title: acceptedLine, lines: [...(current.acceptedNote ? [current.acceptedNote] : []), 'This is not a confirmed booking yet — create the booking, then confirm it.'] };
    }
    if (current.status === 'REJECTED') return { tone: 'red' as const, title: 'Declined by the customer', lines: current.rejectionReason ? [current.rejectionReason] : [] };
    if (current.status === 'EXPIRED') return { tone: 'amber' as const, title: 'This quote passed its valid-until date', lines: [] };
    return null;
  })();

  return (
    <section className="rounded-2xl border border-gray-100 bg-white" aria-label="Quotation">
      {(loadError || notice) && (
        <div className="px-5 pt-4">
          {loadError && <p role="alert" className="text-sm text-red-600">{loadError}</p>}
          {notice && <p className="text-sm text-emerald-700">{notice}</p>}
        </div>
      )}
      {quotations === null && !loadError && <p className="p-5 text-sm text-gray-400">Loading…</p>}

      {!editing && quotations !== null && !current && (
        <div className="p-5">
          <h2 className="font-sans text-[11px] font-bold uppercase tracking-widest text-gray-400">Quotation</h2>
          <p className="mt-2 text-sm text-gray-500">{readOnly ? 'No quote was made before this converted.' : 'No quote yet.'}</p>
        </div>
      )}

      {!editing && current && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-5">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Quotation {current.quotationNumber}
                {current.revision > 1 && <span className="font-medium normal-case tracking-normal text-gray-400"> · revision {current.revision}</span>}
              </div>
              <h2 className="mt-1 text-xl font-bold text-gray-900 font-[Playfair_Display,serif]">{customerName}{eventDate ? ` · ${eventDate}` : ''}</h2>
              {guestCount != null && <div className="mt-0.5 text-sm text-gray-600">{guestCount} guests</div>}
            </div>
            <div className="grid gap-1.5 sm:justify-items-end">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                Quotation <StatusChip chip={quotationChip(current, state)} />
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                Booking <StatusChip chip={bookingChip(current, state)} />
              </div>
            </div>
          </div>

          <div role="table" aria-label="Services quoted">
            <div role="row" className="hidden grid-cols-[1fr_150px_120px] border-y border-gray-100 bg-gray-50 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 md:grid">
              <span role="columnheader">Service</span>
              <span role="columnheader" className="text-right">Qty × price</span>
              <span role="columnheader" className="text-right">Amount</span>
            </div>
            {current.items.map((i) => (
              <div key={i.id} role="row" className="grid grid-cols-[1fr_auto] gap-x-3 border-b border-gray-100 px-5 py-3 text-sm first:border-t md:grid-cols-[1fr_150px_120px] md:first:border-t-0">
                <span role="cell" className="font-medium text-gray-900">
                  {i.description}
                  {i.quantity > 1 && <span className="block text-xs font-normal text-gray-500 md:hidden">{i.quantity} × {rupees(i.unitPrice)}</span>}
                </span>
                <span role="cell" className="hidden text-right text-gray-500 md:block">{i.quantity} × {rupees(i.unitPrice)}</span>
                <span role="cell" className="text-right tabular-nums text-gray-900">{rupees(i.lineTotal)}</span>
              </div>
            ))}
          </div>

          <div className="grid justify-items-end gap-1.5 px-5 pb-1 pt-4 text-sm tabular-nums text-gray-700">
            {(current.discount > 0 || (current.gstEnabled && current.gstAmount > 0)) && (
              <div className="flex w-full max-w-[320px] justify-between"><span>Subtotal</span><span>{rupees(current.subtotal)}</span></div>
            )}
            {current.discount > 0 && (
              <div className="flex w-full max-w-[320px] justify-between"><span>Discount</span><span>−{rupees(current.discount)}</span></div>
            )}
            {current.gstEnabled && current.gstAmount > 0 && (
              <div className="flex w-full max-w-[320px] justify-between"><span>Tax</span><span>{rupees(current.gstAmount)}</span></div>
            )}
            <div className="mt-1 flex w-full max-w-[320px] justify-between border-t border-gray-200 pt-2 text-xl font-bold text-gray-900 font-[Playfair_Display,serif]">
              <span>Total</span><span>{rupees(current.total)}</span>
            </div>
            {current.advanceAmount > 0 && (
              <>
                <div className="flex w-full max-w-[320px] justify-between font-semibold text-gray-900"><span>Advance to confirm</span><span>{rupees(current.advanceAmount)}</span></div>
                <div className="flex w-full max-w-[320px] justify-between"><span>Balance</span><span>{rupees(current.balance)}</span></div>
              </>
            )}
          </div>

          <div className="grid gap-3 px-5 pb-5 pt-3">
            {current.validUntil && <div className="text-xs text-gray-500">Valid until {formatQuoteDate(current.validUntil)}</div>}
            {note && (
              <div className={`grid gap-0.5 rounded-xl px-3.5 py-3 text-sm ${BOX_CLASS[note.tone]}`}>
                <b className="font-bold">{note.title}</b>
                {note.lines.map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </div>
            )}
            {!readOnly && current.status === 'DRAFT' && (
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => setEditing({ id: current.id, draft: draftFromQuotation(current) })} className="min-h-[40px] rounded-xl border border-gray-200 px-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  Edit quote
                </button>
                <button type="button" disabled={busy} onClick={() => remove(current.id)} className="min-h-[40px] rounded-xl px-3 text-sm font-medium text-red-700 underline underline-offset-4 disabled:opacity-40">
                  {current.revision > 1 ? 'Discard revision' : 'Delete draft'}
                </button>
              </div>
            )}
          </div>

          <QuotationHistory quotations={quotations ?? []} currentId={current.id} />
        </>
      )}

      {editing && (
        <div className="space-y-3 p-5">
          <div className="space-y-2">
            {editing.draft.items.map((line, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-start">
                <input
                  className={`${inputClass} col-span-12 sm:col-span-5`}
                  placeholder="What is included, e.g. Grand Ballroom — 500 guests"
                  value={line.description}
                  onChange={(e) => setLine(index, { description: e.target.value })}
                />
                <input
                  className={`${inputClass} col-span-4 sm:col-span-2`}
                  placeholder="Function"
                  value={line.functionLabel}
                  onChange={(e) => setLine(index, { functionLabel: e.target.value })}
                />
                <input
                  className={`${inputClass} col-span-3 sm:col-span-1`}
                  inputMode="numeric"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) => setLine(index, { quantity: e.target.value })}
                />
                <input
                  className={`${inputClass} col-span-5 sm:col-span-3`}
                  inputMode="numeric"
                  placeholder="Price (₹)"
                  value={line.unitPrice}
                  onChange={(e) => setLine(index, { unitPrice: e.target.value })}
                />
                <button
                  type="button"
                  aria-label="Remove line"
                  disabled={editing.draft.items.length === 1}
                  onClick={() => setDraft({ items: editing.draft.items.filter((_, i) => i !== index) })}
                  className="col-span-12 sm:col-span-1 text-gray-400 hover:text-red-500 disabled:opacity-30 text-sm py-2"
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setDraft({ items: [...editing.draft.items, emptyLine()] })} className="text-xs text-amber-600 hover:underline">
              + Add line
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="text-xs text-gray-500">
              Discount (₹)
              <input className={inputClass} inputMode="numeric" value={editing.draft.discount} onChange={(e) => setDraft({ discount: e.target.value })} />
            </label>
            <label className="text-xs text-gray-500">
              Valid until (needed to send)
              <input className={inputClass} type="date" value={editing.draft.validUntil} onChange={(e) => setDraft({ validUntil: e.target.value })} />
            </label>
            <label className="text-xs text-gray-500">
              Advance (₹)
              <input className={inputClass} inputMode="numeric" value={editing.draft.advanceAmount} onChange={(e) => setDraft({ advanceAmount: e.target.value })} />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>Advance as % of total:</span>
            {[25, 30, 50].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setDraft({ advanceAmount: String(Math.round((previewTotals(editing.draft).total * pct) / 100)) })}
                className="px-2 py-0.5 rounded-lg border border-gray-200 hover:border-amber-400"
              >
                {pct}%
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
            <label className="text-xs text-gray-500 flex items-center gap-2">
              <input type="checkbox" checked={editing.draft.gstEnabled} onChange={(e) => setDraft({ gstEnabled: e.target.checked })} />
              Add a tax amount (typed by you — nothing is calculated)
            </label>
            {editing.draft.gstEnabled && (
              <input
                className={inputClass}
                inputMode="numeric"
                placeholder="Tax amount (₹)"
                value={editing.draft.gstAmount}
                onChange={(e) => setDraft({ gstAmount: e.target.value })}
              />
            )}
          </div>

          <textarea
            className={inputClass}
            rows={2}
            placeholder="Terms shown to the customer (optional)"
            value={editing.draft.terms}
            onChange={(e) => setDraft({ terms: e.target.value })}
          />
          <textarea
            className={inputClass}
            rows={2}
            placeholder="Internal note (never shown to the customer)"
            value={editing.draft.notes}
            onChange={(e) => setDraft({ notes: e.target.value })}
          />

          {(() => {
            const t = previewTotals(editing.draft);
            return (
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-sm flex flex-wrap gap-x-6 gap-y-1">
                <span>Total <strong>{rupees(t.total)}</strong></span>
                <span>Advance <strong>{rupees(t.advance)}</strong></span>
                <span>Balance <strong>{rupees(t.balance)}</strong></span>
              </div>
            );
          })()}

          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-amber-500 text-white disabled:opacity-40 hover:bg-amber-600 transition-colors"
            >
              {saving ? 'Saving…' : 'Save draft'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormError(null);
              }}
              className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
});

export default QuotationPanel;
