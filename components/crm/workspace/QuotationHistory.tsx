'use client';

import { Check } from 'lucide-react';
import { buildVersionHistory, negotiationSteps, type HistoryQuotation } from '@/lib/quotation/history';

const STATUS_LABEL: Record<HistoryQuotation['status'], string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  REJECTED: 'Declined',
  EXPIRED: 'Expired',
  SUPERSEDED: 'Replaced',
};

const STATUS_TONE: Record<HistoryQuotation['status'], string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-sky-100 text-sky-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-slate-200 text-slate-600',
  EXPIRED: 'bg-slate-200 text-slate-600',
  SUPERSEDED: 'bg-gray-100 text-gray-500',
};

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

// Negotiation and the quotation's version history, in one place. Every version is kept; nothing here changes a quotation — a
// replaced version is history, and only the current one can be acted on.
export default function QuotationHistory({ quotations, currentId }: { quotations: HistoryQuotation[]; currentId: string | null }) {
  const steps = negotiationSteps(quotations);
  const rows = buildVersionHistory(quotations, currentId);
  if (rows.length === 0 || (rows.length === 1 && !steps)) return null;

  return (
    <div className="border-t border-gray-100 px-5 py-4" aria-label="Negotiation and quotation versions">
      {steps && (
        <ol className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs" aria-label="Negotiation steps">
          {steps.map((step, i) => (
            <li key={step.key} className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${
                  step.state === 'done' ? 'bg-emerald-50 text-emerald-700' : step.state === 'current' ? 'bg-amber-100 text-amber-800' : 'bg-gray-50 text-gray-400'
                }`}
              >
                {step.state === 'done' && <Check className="h-3 w-3" aria-hidden />}
                {step.label}
                {step.state === 'current' && <span className="font-normal"> · now</span>}
              </span>
              {i < steps.length - 1 && <span className="text-gray-300" aria-hidden>→</span>}
            </li>
          ))}
        </ol>
      )}

      <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Quotation versions</h3>
      <ul className="mt-2 grid gap-2">
        {[...rows].reverse().map((row) => (
          <li key={row.id} className={`rounded-xl border p-3 text-sm ${row.isCurrent ? 'border-gray-300 bg-white' : 'border-gray-100 bg-gray-50/60'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-gray-900">{row.quotationNumber}</span>
                <span className="text-xs text-gray-500">revision {row.revision}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[row.status]}`}>{STATUS_LABEL[row.status]}</span>
                {row.isCurrent && <span className="text-[11px] font-semibold text-amber-700">Current</span>}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{day(row.date)}</span>
                <span className="text-sm font-semibold tabular-nums text-gray-900">{rupees(row.total)}</span>
              </div>
            </div>
            {row.changes.length > 0 && (
              <ul className="mt-1.5 grid gap-0.5 text-xs text-gray-600">
                {row.changes.map((change) => (
                  <li key={change}>· {change}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
