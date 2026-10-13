'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { SourceType } from './types';

// "Delete lead" (13 Oct 2026) — shown to the founder only. The first tap asks the server what deleting would remove and whether
// it is allowed at all (services/leadDeletion.service.ts): a lead that already has a booking, a wedding,
// an invoice or a reported payment is a customer record and is refused there. Nothing is deleted until "Yes, delete".
type Check = { name: string; canDelete: boolean; blockers: string[]; goesWith: { quotations: number; tasks: number; notes: number; vendorEnquiries: number } };

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function DeleteLead({ sourceType, id, compact = false, onDeleted }: { sourceType: SourceType; id: string; compact?: boolean; onDeleted: (name: string) => void }) {
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = `/api/crm/leads/${sourceType}/${id}/delete`;

  async function run(method: 'GET' | 'DELETE') {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.success && method === 'GET') setCheck(b.data);
      else if (res.ok && b.success) onDeleted(b.data.name);
      else setError(b.error ?? 'That did not work. Please try again.');
    } catch {
      setError('Could not reach the server. Please try again.');
    }
    setBusy(false);
  }

  if (!check) {
    return (
      <div className={compact ? '' : 'space-y-2'}>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run('GET')}
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border border-red-200 bg-white font-semibold text-red-700 disabled:opacity-50 ${compact ? 'px-3 text-xs' : 'px-4 text-sm'}`}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden /> {busy ? 'Checking…' : compact ? 'Delete' : 'Delete this lead'}
        </button>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  const g = check.goesWith;
  const also = [g.quotations && count(g.quotations, 'quotation'), g.tasks && count(g.tasks, 'task'), g.notes && count(g.notes, 'history entry', 'history entries'), g.vendorEnquiries && count(g.vendorEnquiries, 'vendor request')].filter(Boolean) as string[];

  return (
    <div className={`space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-left text-red-900 ${compact ? 'w-64 max-w-[70vw] text-xs' : 'max-w-xl text-sm'}`} role="alertdialog" aria-label={`Delete ${check.name}`}>
      {check.canDelete ? (
        <>
          <p className="font-semibold">Delete {check.name} for good?</p>
          <p>{also.length ? `This also removes ${also.join(', ')}.` : 'Nothing else is attached to it.'} It cannot be undone.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void run('DELETE')} className="inline-flex min-h-11 items-center rounded-full bg-red-700 px-4 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button type="button" disabled={busy} onClick={() => setCheck(null)} className="inline-flex min-h-11 items-center rounded-full border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700">
              Keep
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="font-semibold">{check.name} cannot be deleted.</p>
          <p>It is a customer record now: {check.blockers.join(', ')}.</p>
          <button type="button" onClick={() => setCheck(null)} className="inline-flex min-h-11 items-center rounded-full border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700">
            OK
          </button>
        </>
      )}
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </div>
  );
}
