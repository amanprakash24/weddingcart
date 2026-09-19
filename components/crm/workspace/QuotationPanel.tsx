'use client';

import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceQuotation } from './types';

// Quotation panel (docs/wedding-os/08-quotation.md, slice S1): create, edit and delete a DRAFT.
// Sending, revising and recording acceptance arrive in the next slice. Totals shown while typing
// are only a preview — the server recomputes and stores the real ones on every save.

const STATUS_LABEL: Record<WorkspaceQuotation['status'], string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  SUPERSEDED: 'Replaced',
};
const STATUS_COLOR: Record<WorkspaceQuotation['status'], string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-amber-100 text-amber-700',
  SUPERSEDED: 'bg-gray-100 text-gray-500',
};

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

function errorMessage(payload: { error?: string; issues?: { message?: string }[] }): string {
  const first = payload.issues?.find((i) => i.message)?.message;
  return first ?? payload.error ?? 'Request failed';
}

export default function QuotationPanel({
  sourceType,
  sourceId,
  readOnly,
  prefill,
}: {
  sourceType: string;
  sourceId: string;
  readOnly: boolean; // the source already converted to a Wedding
  prefill: QuotationPrefillLine[];
}) {
  const [quotations, setQuotations] = useState<WorkspaceQuotation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/quotations?sourceType=${sourceType}&sourceId=${sourceId}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok || !body.success) throw new Error(errorMessage(body));
        setQuotations(body.data);
        setLoadError(null);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [sourceType, sourceId]);

  // Deferred like the other workspace panels (react-hooks/set-state-in-effect).
  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  const openQuotation = quotations?.find((q) => q.status === 'DRAFT' || q.status === 'SENT') ?? null;

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
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this draft quote?')) return;
    const res = await fetch(`/api/quotations/${id}`, { method: 'DELETE' });
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      setLoadError(errorMessage(payload));
      return;
    }
    load();
  };

  const setLine = (index: number, patch: Partial<DraftLine>) =>
    setEditing((e) => (e ? { ...e, draft: { ...e.draft, items: e.draft.items.map((l, i) => (i === index ? { ...l, ...patch } : l)) } } : e));
  const setDraft = (patch: Partial<Draft>) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e));

  const inputClass =
    'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-colors';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">Quote</h2>
        {!readOnly && !editing && !openQuotation && quotations !== null && (
          <button
            onClick={() => setEditing({ id: null, draft: draftFromPrefill(prefill) })}
            className="px-3 py-1.5 rounded-xl text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            Create quote
          </button>
        )}
      </div>

      {loadError && <p className="text-sm text-red-500 mb-2">{loadError}</p>}
      {quotations === null && !loadError && <p className="text-sm text-gray-400">Loading…</p>}
      {quotations !== null && quotations.length === 0 && !editing && (
        <p className="text-sm text-gray-400">{readOnly ? 'No quote was made before this converted.' : 'No quote yet.'}</p>
      )}

      {!editing && quotations && quotations.length > 0 && (
        <ul className="space-y-2">
          {quotations.map((q) => (
            <li key={q.id} className="border border-gray-100 rounded-xl px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-gray-900">
                  {q.quotationNumber}
                  {q.revision > 1 && <span className="text-gray-400 font-normal"> · revision {q.revision}</span>}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[q.status]}`}>{STATUS_LABEL[q.status]}</span>
              </div>
              <div className="mt-1 text-gray-600 flex flex-wrap gap-x-4 gap-y-0.5">
                <span>Total {rupees(q.total)}</span>
                <span>Advance {rupees(q.advanceAmount)}</span>
                <span>Balance {rupees(q.balance)}</span>
                {q.validUntil && <span>Valid until {new Date(q.validUntil).toLocaleDateString('en-IN')}</span>}
              </div>
              <ul className="mt-1.5 text-xs text-gray-500 space-y-0.5">
                {q.items.map((i) => (
                  <li key={i.id}>
                    {i.description} — {i.quantity} × {rupees(i.unitPrice)} = {rupees(i.lineTotal)}
                  </li>
                ))}
              </ul>
              {q.status === 'DRAFT' && !readOnly && (
                <div className="mt-2 flex gap-3 text-xs">
                  <button onClick={() => setEditing({ id: q.id, draft: draftFromQuotation(q) })} className="text-amber-600 hover:underline">
                    Edit
                  </button>
                  <button onClick={() => remove(q.id)} className="text-red-500 hover:underline">
                    Delete draft
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="space-y-3">
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
              Valid until
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
    </div>
  );
}
