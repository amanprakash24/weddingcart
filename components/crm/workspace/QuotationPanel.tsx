'use client';

import { useCallback, useEffect, useState } from 'react';
import { buildQuotationMessage, formatQuoteDate } from '@/lib/quotation/message';
import type { WorkspaceQuotation } from './types';

// Quotation panel (docs/wedding-os/08-quotation.md). S1: create / edit / delete a draft.
// S2: send, revise, record the customer's answer, and a prepared message to send them.
// Totals shown while typing are only a preview — the server recomputes and stores the real ones.
// V1 has no customer login or link: staff record the customer's answer on their behalf.

const STATUS_LABEL: Record<WorkspaceQuotation['status'], string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  REJECTED: 'Declined',
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
const CHANNELS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'PHONE', label: 'Phone call' },
  { value: 'IN_PERSON', label: 'In person' },
  { value: 'OTHER', label: 'Other' },
] as const;
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

function errorMessage(payload: { error?: string; issues?: { message?: string }[] }): string {
  const first = payload.issues?.find((i) => i.message)?.message;
  return first ?? payload.error ?? 'Request failed';
}

type RowAction = { type: 'accept' | 'reject'; id: string } | null;

export default function QuotationPanel({
  sourceType,
  sourceId,
  readOnly,
  prefill,
  customerName,
  customerPhone,
  onChanged,
}: {
  sourceType: string;
  sourceId: string;
  readOnly: boolean; // the source already converted to a Wedding
  prefill: QuotationPrefillLine[];
  customerName: string | null;
  customerPhone: string | null;
  // Called after send / accept / decline so the workspace (stage, timeline) reloads.
  onChanged: () => void;
}) {
  const [quotations, setQuotations] = useState<WorkspaceQuotation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowAction, setRowAction] = useState<RowAction>(null);
  const [channel, setChannel] = useState<string>('WHATSAPP');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  // One helper for every lifecycle call: shows the server's message on failure, reloads on success.
  const act = async (id: string, path: string, body?: unknown, okNotice?: string) => {
    setBusyId(id);
    setLoadError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/quotations/${id}${path}`, {
        method: path ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(errorMessage(payload));
      setRowAction(null);
      setNote('');
      setReason('');
      if (okNotice) setNotice(okNotice);
      load();
      onChanged();
      return payload;
    } catch (e) {
      setLoadError((e as Error).message);
      load(); // the state may have moved under us (e.g. it just expired) — show the truth
      return null;
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this draft quote?')) return;
    await act(id, '');
  };

  const messageFor = (q: WorkspaceQuotation) => buildQuotationMessage(q, customerName);
  const copyMessage = async (q: WorkspaceQuotation) => {
    try {
      await navigator.clipboard.writeText(messageFor(q));
      setNotice('Message copied — paste it into WhatsApp or SMS.');
    } catch {
      setNotice('Could not copy automatically — use "Open WhatsApp" instead.');
    }
  };
  const whatsappLink = (q: WorkspaceQuotation) => {
    const digits = (customerPhone ?? '').replace(/\D/g, '').slice(-10);
    return digits.length === 10 ? `https://wa.me/91${digits}?text=${encodeURIComponent(messageFor(q))}` : null;
  };

  const setLine = (index: number, patch: Partial<DraftLine>) =>
    setEditing((e) => (e ? { ...e, draft: { ...e.draft, items: e.draft.items.map((l, i) => (i === index ? { ...l, ...patch } : l)) } } : e));
  const setDraft = (patch: Partial<Draft>) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e));

  const inputClass =
    'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-colors';
  const linkBtn = 'text-xs hover:underline disabled:opacity-40';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">Quote</h2>
        {!readOnly && !editing && !openQuotation && quotations !== null && !quotations.some((q) => q.status === 'ACCEPTED') && (
          <button
            onClick={() => setEditing({ id: null, draft: draftFromPrefill(prefill) })}
            className="px-3 py-1.5 rounded-xl text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            Create quote
          </button>
        )}
      </div>

      {loadError && <p className="text-sm text-red-500 mb-2">{loadError}</p>}
      {notice && <p className="text-sm text-emerald-600 mb-2">{notice}</p>}
      {quotations === null && !loadError && <p className="text-sm text-gray-400">Loading…</p>}
      {quotations !== null && quotations.length === 0 && !editing && (
        <p className="text-sm text-gray-400">{readOnly ? 'No quote was made before this converted.' : 'No quote yet.'}</p>
      )}

      {!editing && quotations && quotations.length > 0 && (
        <ul className="space-y-2">
          {quotations.map((q) => {
            const busy = busyId === q.id;
            const wa = q.status === 'SENT' ? whatsappLink(q) : null;
            return (
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
                  {q.validUntil && <span>Valid until {formatQuoteDate(q.validUntil)}</span>}
                </div>
                <ul className="mt-1.5 text-xs text-gray-500 space-y-0.5">
                  {q.items.map((i) => (
                    <li key={i.id}>
                      {i.description} — {i.quantity} × {rupees(i.unitPrice)} = {rupees(i.lineTotal)}
                    </li>
                  ))}
                </ul>

                {q.status === 'ACCEPTED' && (
                  <p className="mt-1.5 text-xs text-emerald-700">
                    Accepted via {CHANNEL_LABEL[q.acceptedChannel ?? 'OTHER'] ?? q.acceptedChannel}
                    {q.acceptedAt ? ` on ${formatQuoteDate(q.acceptedAt)}` : ''}
                    {q.acceptedNote ? ` — ${q.acceptedNote}` : ''}
                  </p>
                )}
                {q.status === 'REJECTED' && (
                  <p className="mt-1.5 text-xs text-red-600">Declined{q.rejectionReason ? `: ${q.rejectionReason}` : ''}</p>
                )}
                {q.status === 'EXPIRED' && <p className="mt-1.5 text-xs text-amber-700">This quote passed its valid-until date.</p>}

                {!readOnly && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {q.status === 'DRAFT' && (
                      <>
                        <button
                          disabled={busy}
                          onClick={() => act(q.id, '/send', undefined, 'Quote sent. Copy the message below to send it to the customer.')}
                          className="px-3 py-1 rounded-lg text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40"
                        >
                          {busy ? 'Sending…' : 'Send quote'}
                        </button>
                        <button onClick={() => setEditing({ id: q.id, draft: draftFromQuotation(q) })} className={`${linkBtn} text-amber-600`}>
                          Edit
                        </button>
                        <button disabled={busy} onClick={() => remove(q.id)} className={`${linkBtn} text-red-500`}>
                          {q.revision > 1 ? 'Discard revision' : 'Delete draft'}
                        </button>
                      </>
                    )}
                    {q.status === 'SENT' && (
                      <>
                        <button onClick={() => copyMessage(q)} className={`${linkBtn} text-amber-600`}>
                          Copy message
                        </button>
                        {wa && (
                          <a href={wa} target="_blank" rel="noreferrer" className={`${linkBtn} text-amber-600`}>
                            Open WhatsApp
                          </a>
                        )}
                        <button disabled={busy} onClick={() => setRowAction({ type: 'accept', id: q.id })} className={`${linkBtn} text-emerald-700 font-medium`}>
                          Customer accepted
                        </button>
                        <button disabled={busy} onClick={() => setRowAction({ type: 'reject', id: q.id })} className={`${linkBtn} text-red-600`}>
                          Customer declined
                        </button>
                        <button disabled={busy} onClick={() => act(q.id, '/revise', undefined, 'A new draft was created from this quote.')} className={`${linkBtn} text-gray-600`}>
                          Revise
                        </button>
                      </>
                    )}
                    {(q.status === 'REJECTED' || q.status === 'EXPIRED') && (
                      <button disabled={busy} onClick={() => act(q.id, '/revise', undefined, 'A new draft was created from this quote.')} className={`${linkBtn} text-amber-600`}>
                        Revise
                      </button>
                    )}
                  </div>
                )}

                {rowAction?.id === q.id && rowAction.type === 'accept' && (
                  <div className="mt-2 rounded-xl bg-emerald-50 border border-emerald-100 p-3 space-y-2">
                    <div className="text-xs font-medium text-emerald-800">How did the customer accept?</div>
                    <select className={inputClass} value={channel} onChange={(e) => setChannel(e.target.value)}>
                      {CHANNELS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <input className={inputClass} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                    <div className="flex gap-2">
                      <button
                        disabled={busy}
                        onClick={() => act(q.id, '/accept', { channel, note: note || null }, 'Accepted. You can now move this deal to Booked.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white disabled:opacity-40"
                      >
                        {busy ? 'Saving…' : 'Record acceptance'}
                      </button>
                      <button onClick={() => setRowAction(null)} className="px-3 py-1.5 text-xs text-gray-600">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {rowAction?.id === q.id && rowAction.type === 'reject' && (
                  <div className="mt-2 rounded-xl bg-red-50 border border-red-100 p-3 space-y-2">
                    <div className="text-xs font-medium text-red-800">Why did the customer decline?</div>
                    <input className={inputClass} placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                    <div className="flex gap-2">
                      <button
                        disabled={busy || !reason.trim()}
                        onClick={() => act(q.id, '/reject', { reason })}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white disabled:opacity-40"
                      >
                        {busy ? 'Saving…' : 'Record decline'}
                      </button>
                      <button onClick={() => setRowAction(null)} className="px-3 py-1.5 text-xs text-gray-600">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
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
    </div>
  );
}
