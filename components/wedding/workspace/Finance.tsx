'use client';

import { useState } from 'react';
import type { WorkspaceFinance, WorkspaceInvoice, CreateInvoiceInput } from './types';
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  PAYMENT_LINK_STATUS_LABELS,
  PAYMENT_LINK_STATUS_COLORS,
} from './constants';

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

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
}: {
  weddingId: string;
  invoice: WorkspaceInvoice;
  onGeneratePaymentLink: (invoiceId: string) => Promise<void>;
}) {
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const hasActiveLink = invoice.paymentLinks.some((l) => l.status === 'CREATED');

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
    <li className="border border-gray-100 rounded-xl p-3">
      <div className="flex items-center justify-between mb-1">
        <div>
          <span className="font-medium text-gray-900 text-sm">{invoice.invoiceNumber}</span>
          <span className="text-gray-400 text-xs ml-2">{invoice.clientName}</span>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${INVOICE_STATUS_COLORS[invoice.status]}`}>
          {INVOICE_STATUS_LABELS[invoice.status]}
        </span>
      </div>
      <div className="text-xs text-gray-500 flex items-center gap-3 mb-2">
        <span>Total: {money(invoice.total)}</span>
        <span>Paid: {money(invoice.amountPaid)}</span>
        <span className={invoice.outstanding > 0 ? 'text-amber-600' : ''}>Outstanding: {money(invoice.outstanding)}</span>
      </div>
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
                {money(p.amount)} via {p.method} — {new Date(p.paidAt).toLocaleDateString()}
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
      {invoice.outstanding > 0 && !hasActiveLink && (
        <button disabled={generating} onClick={generate} className="text-xs text-emerald-600 hover:underline disabled:opacity-40">
          {generating ? 'Generating…' : '+ Generate Payment Link'}
        </button>
      )}
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
}: {
  weddingId: string;
  finance: WorkspaceFinance;
  onCreateInvoice: (input: CreateInvoiceInput) => Promise<void>;
  onGeneratePaymentLink: (invoiceId: string) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Finance</h2>
      <BudgetBlock budget={finance.budget} />

      {finance.invoices.length === 0 ? (
        <p className="text-sm text-gray-400 mb-2">No invoices yet.</p>
      ) : (
        <ul className="space-y-2 mb-2">
          {finance.invoices.map((invoice) => (
            <InvoiceCard key={invoice.id} weddingId={weddingId} invoice={invoice} onGeneratePaymentLink={onGeneratePaymentLink} />
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
  );
}
