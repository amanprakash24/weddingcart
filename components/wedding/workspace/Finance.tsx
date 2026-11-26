'use client';

import { useState } from 'react';
import AgreementCard, { type PaymentResult, type RecordPaymentInput } from '@/components/money/AgreementCard';
import type { WorkspaceFinance, WorkspaceInvoice, CreateInvoiceInput, ManualPaymentMethod } from './types';
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  INVOICE_KIND_LABELS,
  MANUAL_PAYMENT_LABELS,
  PAYMENT_LINK_STATUS_LABELS,
  PAYMENT_LINK_STATUS_COLORS,
} from './constants';

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

type RecordPayment = (invoiceId: string, input: { amount: number; method: ManualPaymentMethod; reference?: string }) => Promise<void>;

// What was agreed with the customer: the accepted quotation the wedding was booked on. Read-only, because the accepted terms never
// change; this is where an operator checks what the invoices should add up to.
function AgreementBlock({ agreement, onCreateBalance }: { agreement: NonNullable<WorkspaceFinance['agreement']>; onCreateBalance: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCreateBalance();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the balance invoice');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50/60 p-3" aria-label="Agreed with the customer">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-gray-900">
          Agreed with the customer · Quotation {agreement.quotationNumber}
          {agreement.revision > 1 ? <span className="font-normal text-gray-500"> (revision {agreement.revision})</span> : null}
        </div>
        {agreement.acceptedAt && <div className="text-[11px] text-gray-500">Accepted {new Date(agreement.acceptedAt).toLocaleDateString('en-IN')}</div>}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white p-2"><div className="text-[10px] uppercase text-gray-400">Total</div><div className="text-sm font-semibold text-gray-900">{money(agreement.total)}</div></div>
        <div className="rounded-lg bg-white p-2"><div className="text-[10px] uppercase text-gray-400">Advance</div><div className="text-sm font-semibold text-gray-900">{money(agreement.advance)}</div></div>
        <div className="rounded-lg bg-white p-2"><div className="text-[10px] uppercase text-gray-400">Balance</div><div className="text-sm font-semibold text-gray-900">{money(agreement.balance)}</div></div>
      </div>
      <details className="mt-2 text-xs text-gray-600">
        <summary className="cursor-pointer font-medium">What was agreed ({agreement.lines.length} {agreement.lines.length === 1 ? 'line' : 'lines'})</summary>
        <ul className="mt-1.5 grid gap-1">
          {agreement.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span>{l.description}{l.quantity > 1 ? ` × ${l.quantity} at ${money(l.unitPrice)}` : ''}</span>
              <span className="tabular-nums">{money(l.unitPrice * l.quantity)}</span>
            </li>
          ))}
          {agreement.discount > 0 && <li className="flex justify-between gap-2"><span>Discount</span><span className="tabular-nums">−{money(agreement.discount)}</span></li>}
          {agreement.gstAmount > 0 && <li className="flex justify-between gap-2"><span>Tax</span><span className="tabular-nums">{money(agreement.gstAmount)}</span></li>}
        </ul>
      </details>
      {agreement.terms && (
        <details className="mt-1.5 text-xs text-gray-600">
          <summary className="cursor-pointer font-medium">Terms &amp; conditions accepted</summary>
          <p className="mt-1.5 whitespace-pre-line">{agreement.terms}</p>
        </details>
      )}
      {!agreement.hasBalanceInvoice && agreement.balance > 0 && (
        <div className="mt-2">
          <button disabled={busy} onClick={create} className="text-xs text-emerald-600 hover:underline disabled:opacity-40">
            {busy ? 'Creating…' : `+ Create balance invoice (${money(agreement.balance)})`}
          </button>
          {error && <p role="alert" className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
}

// Money received outside Razorpay: cash, UPI, bank transfer, cheque.
function RecordPaymentForm({ invoice, onRecord, onDone }: { invoice: WorkspaceInvoice; onRecord: RecordPayment; onDone: () => void }) {
  const [amount, setAmount] = useState(String(invoice.outstanding));
  const [method, setMethod] = useState<ManualPaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onRecord(invoice.id, { amount: Number(amount), method, reference: reference.trim() || undefined });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record the payment');
    } finally {
      setBusy(false);
    }
  };
  const field = 'rounded-lg border border-gray-200 px-2 py-1 text-xs';
  return (
    <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Amount received" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} w-24`} />
        <select aria-label="How it was received" value={method} onChange={(e) => setMethod(e.target.value as ManualPaymentMethod)} className={field}>
          {(Object.keys(MANUAL_PAYMENT_LABELS) as ManualPaymentMethod[]).map((m) => <option key={m} value={m}>{MANUAL_PAYMENT_LABELS[m]}</option>)}
        </select>
        <input aria-label="Reference (optional)" placeholder="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} className={`${field} w-40`} />
        <button disabled={busy} onClick={submit} className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save payment'}</button>
        <button onClick={onDone} className="text-xs text-gray-400 hover:underline">Cancel</button>
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function BudgetBlock({ budget }: { budget: WorkspaceFinance['budget'] }) {
  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      <div className="border border-gray-100 rounded-xl p-3">
        <div className="text-[10px] text-gray-400 uppercase tracking-wide">Planned Budget</div>
        <div className="text-sm font-semibold text-gray-900 mt-0.5">
          {budget.planned !== null ? money(budget.planned) : '—'}
        </div>
      </div>
      <div className="border border-gray-100 rounded-xl p-3">
        <div className="text-[10px] text-gray-400 uppercase tracking-wide">Vendor Cost (Committed)</div>
        <div className="text-sm font-semibold text-gray-900 mt-0.5">{money(budget.committed)}</div>
      </div>
      <div className="border border-gray-100 rounded-xl p-3">
        <div className="text-[10px] text-gray-400 uppercase tracking-wide">Remaining</div>
        <div className={`text-sm font-semibold mt-0.5 ${budget.variance !== null && budget.variance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
          {budget.variance !== null ? money(budget.variance) : '—'}
        </div>
      </div>
    </div>
  );
}

function InvoiceCard({
  weddingId,
  invoice,
  onGeneratePaymentLink,
  onIssueInvoice,
  onRecordPayment,
  agreementManaged,
  onChanged,
}: {
  weddingId: string;
  invoice: WorkspaceInvoice;
  onChanged?: () => unknown; // after a credit note or a cancellation (PR 7)
  onGeneratePaymentLink: (invoiceId: string) => Promise<void>;
  onIssueInvoice: (invoiceId: string) => Promise<void>;
  onRecordPayment: RecordPayment;
  // Money v1: this invoice belongs to the booking agreement, which takes the payments (the card above) — so no separate form here.
  agreementManaged: boolean;
}) {
  const [issuing, setIssuing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  // PR 7: issue a credit note / cancel the invoice — each needs a reason
  const [action, setAction] = useState<{ kind: 'credit' | 'void'; amount: string; reason: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const voided = invoice.voidedAt !== null;
  const issued = invoice.status !== 'DRAFT' || invoice.issuedAt !== null;
  const canCredit = !voided && issued && invoice.total - invoice.creditedAmount > 0;
  const canVoid = !voided && invoice.kind === 'OTHER' && invoice.amountPaid === 0 && invoice.creditedAmount === 0;
  const saveAction = async () => {
    if (!action) return;
    setSaving(true);
    setGenError(null);
    try {
      const res = await fetch(`/api/weddings/${weddingId}/invoices/${invoice.id}/${action.kind === 'credit' ? 'credit-notes' : 'void'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.kind === 'credit' ? { amount: action.amount, reason: action.reason } : { reason: action.reason }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) throw new Error(body?.error || 'Could not save. Please try again.');
      setAction(null);
      await onChanged?.();
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const hasActiveLink = invoice.paymentLinks.some((l) => l.status === 'CREATED');

  const issue = async () => {
    setIssuing(true);
    setGenError(null);
    try {
      await onIssueInvoice(invoice.id);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Could not issue the invoice');
    } finally {
      setIssuing(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      await onGeneratePaymentLink(invoice.id);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Failed to generate payment link');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <li className={`border border-gray-100 rounded-xl p-3 ${voided ? 'bg-gray-50 opacity-75' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <div>
          <span className="font-medium text-gray-900 text-sm">{invoice.invoiceNumber}</span>
          {invoice.kind !== 'OTHER' && <span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">{INVOICE_KIND_LABELS[invoice.kind]}</span>}
          <span className="text-gray-400 text-xs ml-2">{invoice.clientName}</span>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${voided ? 'bg-gray-200 text-gray-700' : INVOICE_STATUS_COLORS[invoice.status]}`}>
          {voided ? 'Cancelled' : invoice.creditedAmount > 0 && invoice.outstanding === 0 && invoice.amountPaid < invoice.total ? 'Settled' : INVOICE_STATUS_LABELS[invoice.status]}
        </span>
      </div>
      <div className="text-xs text-gray-500 flex items-center gap-3 mb-2">
        <span>Total: {money(invoice.total)}</span>
        <span>Paid: {money(invoice.amountPaid)}</span>
        {invoice.creditedAmount > 0 && <span>Credited: {money(invoice.creditedAmount)}</span>}
        <span className={invoice.outstanding > 0 ? 'text-amber-600' : ''}>Outstanding: {money(invoice.outstanding)}</span>
      </div>
      {voided && (
        <p className="mb-2 rounded-lg bg-gray-100 p-2 text-xs text-gray-700">
          Cancelled {invoice.voidedAt ? new Date(invoice.voidedAt).toLocaleDateString('en-IN') : ''}: {invoice.voidReason}. It counts for nothing and the couple does not see it.
        </p>
      )}
      {invoice.refundOwed > 0 && (
        <p className="mb-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
          {money(invoice.refundOwed)} is owed back to the couple (payments and credit notes pass the total). It shows as owed until it is really paid back.
        </p>
      )}
      {invoice.creditNotes.length > 0 && (
        <ul className="mb-2 space-y-1">
          {invoice.creditNotes.map((c) => (
            <li key={c.id} className="text-xs text-gray-600">
              Credit note <b>{c.number}</b> · − {money(c.amount)}{c.gstAmount > 0 ? ` (incl. GST ${money(c.gstAmount)})` : ''} · {new Date(c.issuedAt).toLocaleDateString('en-IN')} · {c.reason}
            </li>
          ))}
        </ul>
      )}
      <ul className="space-y-1 mb-2">
        {invoice.items.map((item) => (
          <li key={item.id} className="text-xs text-gray-500 flex items-center justify-between">
            <span>
              {item.description}
              {item.vendorName && <span className="text-gray-400"> · {item.vendorName}</span>}
              {item.quantity > 1 && <span className="text-gray-400"> × {item.quantity}</span>}
            </span>
            <span>{money(item.amount * item.quantity)}</span>
          </li>
        ))}
      </ul>
      {invoice.payments.length === 0 ? (
        <p className="text-xs text-gray-400">No payments recorded yet.</p>
      ) : (
        <ul className="space-y-1 mb-2">
          {invoice.payments.map((p) => (
            <li key={p.id} className="text-xs text-gray-500 flex items-center justify-between">
              <span>
                {money(p.amount)} via {p.method} — {new Date(p.paidAt).toLocaleDateString()}{p.reference ? ` · ref ${p.reference}` : ''}{p.recordedByName ? ` · ${p.recordedByName}` : ''}
              </span>
              <a
                href={`/api/weddings/${weddingId}/invoices/${invoice.id}/payments/${p.id}/receipt`}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-600 hover:underline"
              >
                Receipt
              </a>
            </li>
          ))}
        </ul>
      )}

      {invoice.paymentLinks.length > 0 && (
        <ul className="space-y-1 mb-2">
          {invoice.paymentLinks.map((l) => (
            <li key={l.id} className="text-xs text-gray-500 flex items-center gap-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${PAYMENT_LINK_STATUS_COLORS[l.status]}`}>
                {PAYMENT_LINK_STATUS_LABELS[l.status]}
              </span>
              {l.status === 'CREATED' && (
                <a href={l.shortUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">
                  {l.shortUrl}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {genError && <p className="text-xs text-red-500 mb-1">{genError}</p>}
      <div className="flex flex-wrap items-center gap-3">
        {invoice.status === 'DRAFT' && !voided && (
          <button disabled={issuing} onClick={issue} className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-40">
            {issuing ? 'Issuing…' : 'Mark as issued'}
          </button>
        )}
        {invoice.outstanding > 0 && !hasActiveLink && (
          <button disabled={generating} onClick={generate} className="text-xs text-emerald-600 hover:underline disabled:opacity-40">
            {generating ? 'Generating…' : '+ Generate Payment Link'}
          </button>
        )}
        {invoice.outstanding > 0 && !recording && !agreementManaged && (
          <button onClick={() => setRecording(true)} className="text-xs text-emerald-600 hover:underline">+ Record payment</button>
        )}
        {canCredit && !action && (
          <button onClick={() => setAction({ kind: 'credit', amount: '', reason: '' })} className="text-xs text-gray-700 hover:underline">Issue credit note</button>
        )}
        {canVoid && !action && (
          <button onClick={() => setAction({ kind: 'void', amount: '', reason: '' })} className="text-xs text-red-600 hover:underline">Cancel invoice</button>
        )}
      </div>
      {action && (
        <form onSubmit={(e) => { e.preventDefault(); void saveAction(); }} className="mt-2 grid gap-2 rounded-lg bg-gray-50 p-2 sm:grid-cols-3">
          {action.kind === 'credit' && (
            <label className="grid gap-1 text-xs text-gray-600">Credit ₹ (up to {money(invoice.total - invoice.creditedAmount)}, incl. GST)
              <input aria-label="Credit amount" inputMode="numeric" value={action.amount} onChange={(e) => setAction({ ...action, amount: e.target.value })} className="min-h-10 rounded-lg border border-gray-300 px-2.5 text-sm" />
            </label>
          )}
          <label className={`grid gap-1 text-xs text-gray-600 ${action.kind === 'credit' ? 'sm:col-span-2' : 'sm:col-span-3'}`}>
            {action.kind === 'credit' ? 'Why (printed on the credit note the couple sees)' : 'Why is this invoice cancelled?'}
            <input aria-label={action.kind === 'credit' ? 'Credit note reason' : 'Cancellation reason'} value={action.reason} maxLength={300} onChange={(e) => setAction({ ...action, reason: e.target.value })} className="min-h-10 rounded-lg border border-gray-300 px-2.5 text-sm" />
          </label>
          <div className="flex gap-2 sm:col-span-3">
            <button type="submit" disabled={saving} className={`min-h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-40 ${action.kind === 'void' ? 'bg-red-700' : 'bg-gray-900'}`}>
              {saving ? 'Saving…' : action.kind === 'credit' ? 'Issue credit note' : 'Cancel this invoice'}
            </button>
            <button type="button" onClick={() => setAction(null)} className="min-h-10 px-2 text-sm text-gray-600">Back</button>
          </div>
        </form>
      )}
      {recording && <RecordPaymentForm invoice={invoice} onRecord={onRecordPayment} onDone={() => setRecording(false)} />}
    </li>
  );
}

type ItemRow = { description: string; vendorName: string; amount: string; quantity: string };
const emptyRow: ItemRow = { description: '', vendorName: '', amount: '', quantity: '1' };

// Admin-typed line items, discount and GST amount — no auto-calculated GST %,
// per docs/wedding-os/06-finance.md §5: tax treatment is a real compliance
// question, not something to default in a product spec.
function CreateInvoiceForm({
  onCreate,
  onCancel,
}: {
  onCreate: (input: CreateInvoiceInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [items, setItems] = useState<ItemRow[]>([{ ...emptyRow }]);
  const [discount, setDiscount] = useState('0');
  const [gstEnabled, setGstEnabled] = useState(true);
  const [gstAmount, setGstAmount] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateItem = (index: number, patch: Partial<ItemRow>) => {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const addItem = () => setItems((prev) => [...prev, { ...emptyRow }]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const valid =
    clientName.trim() &&
    clientPhone.trim() &&
    items.every((row) => row.description.trim() && Number(row.amount) > 0 && Number(row.quantity) > 0);

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        gstEnabled,
        gstAmount: Number(gstAmount) || 0,
        discount: Number(discount) || 0,
        items: items.map((row) => ({
          description: row.description.trim(),
          vendorName: row.vendorName.trim() || undefined,
          amount: Number(row.amount),
          quantity: Number(row.quantity) || 1,
        })),
      });
      onCancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-dashed border-gray-200 rounded-xl p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <input
          autoFocus
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Client name"
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"
        />
        <input
          value={clientPhone}
          onChange={(e) => setClientPhone(e.target.value)}
          placeholder="Client phone"
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"
        />
      </div>

      <div className="space-y-2">
        {items.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_90px_60px_auto] gap-2 items-center">
            <input
              value={row.description}
              onChange={(e) => updateItem(i, { description: e.target.value })}
              placeholder="Description"
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"
            />
            <input
              value={row.vendorName}
              onChange={(e) => updateItem(i, { vendorName: e.target.value })}
              placeholder="Vendor (optional)"
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"
            />
            <input
              type="number"
              min={1}
              value={row.amount}
              onChange={(e) => updateItem(i, { amount: e.target.value })}
              placeholder="Amount"
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"
            />
            <input
              type="number"
              min={1}
              value={row.quantity}
              onChange={(e) => updateItem(i, { quantity: e.target.value })}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"
            />
            {items.length > 1 && (
              <button onClick={() => removeItem(i)} className="text-xs text-red-500 hover:underline">
                Remove
              </button>
            )}
          </div>
        ))}
        <button onClick={addItem} className="text-xs text-emerald-600 hover:underline">
          + Add line item
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 items-center">
        <input
          type="number"
          min={0}
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          placeholder="Discount"
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"
        />
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" checked={gstEnabled} onChange={(e) => setGstEnabled(e.target.checked)} />
          GST
        </label>
        <input
          type="number"
          min={0}
          value={gstAmount}
          onChange={(e) => setGstAmount(e.target.value)}
          placeholder="GST amount"
          disabled={!gstEnabled}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 disabled:opacity-40"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          disabled={!valid || submitting}
          onClick={submit}
          className="text-xs text-emerald-600 hover:underline disabled:opacity-40"
        >
          {submitting ? 'Creating…' : 'Create Invoice'}
        </button>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function Finance({
  weddingId,
  finance,
  onCreateInvoice,
  onGeneratePaymentLink,
  onIssueInvoice,
  onCreateBalanceInvoice,
  onRecordPayment,
  onRecordAgreementPayment,
  onMoneyChanged,
}: {
  weddingId: string;
  finance: WorkspaceFinance;
  onCreateInvoice: (input: CreateInvoiceInput) => Promise<void>;
  onGeneratePaymentLink: (invoiceId: string) => Promise<void>;
  onIssueInvoice: (invoiceId: string) => Promise<void>;
  onCreateBalanceInvoice: () => Promise<void>;
  onRecordPayment: RecordPayment;
  onRecordAgreementPayment: (input: RecordPaymentInput) => Promise<PaymentResult | void>;
  onMoneyChanged?: () => Promise<unknown> | void; // a verified "I have paid" claim (Roadmap 1.3) changed the money
}) {
  const [creating, setCreating] = useState(false);
  const money = finance.agreement?.money ?? null;

  return (
    <div className="space-y-4">
    {money && <AgreementCard money={money} onRecordPayment={onRecordAgreementPayment} onRefresh={onMoneyChanged} />}
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Finance</h2>
      {finance.agreement && <AgreementBlock agreement={finance.agreement} onCreateBalance={onCreateBalanceInvoice} />}
      <BudgetBlock budget={finance.budget} />

      {finance.invoices.length === 0 ? (
        <p className="text-sm text-gray-400 mb-2">No invoices yet.</p>
      ) : (
        <ul className="space-y-2 mb-2">
          {finance.invoices.map((invoice) => (
            <InvoiceCard key={invoice.id} weddingId={weddingId} invoice={invoice} onGeneratePaymentLink={onGeneratePaymentLink} onIssueInvoice={onIssueInvoice} onRecordPayment={onRecordPayment} onChanged={onMoneyChanged} agreementManaged={Boolean(money) && invoice.kind !== 'OTHER' && invoice.quotationId === finance.agreement?.quotationId} />
          ))}
        </ul>
      )}

      {creating ? (
        <CreateInvoiceForm onCreate={onCreateInvoice} onCancel={() => setCreating(false)} />
      ) : (
        <button onClick={() => setCreating(true)} className="text-xs text-emerald-600 hover:underline">
          + Create Invoice
        </button>
      )}
    </div>
    </div>
  );
}
