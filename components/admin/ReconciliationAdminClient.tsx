'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReconciliationReport } from '@/services/reconciliation.service';
import type { CheckStatus } from '@/lib/finance/reconciliation';

// The founder's money check (money design v1, PR 2, 25 Nov 2026). Read-only: each check says whether the records agree; a mismatch
// is listed with the record and both figures. Nothing on this page changes any record.

const TONE: Record<CheckStatus, { label: string; cls: string }> = {
  ok: { label: 'OK', cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  info: { label: 'Note', cls: 'bg-sky-50 text-sky-800 ring-sky-200' },
  warning: { label: 'Look at this', cls: 'bg-amber-50 text-amber-900 ring-amber-200' },
  error: { label: 'Mismatch', cls: 'bg-red-50 text-red-800 ring-red-200' },
};
const ORDER: CheckStatus[] = ['error', 'warning', 'info', 'ok'];
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function ReconciliationAdminClient() {
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/reconciliation', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not run the money check');
      setReport(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not run the money check');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const checks = report ? [...report.checks].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status)) : [];
  const problems = checks.filter((c) => c.status === 'error' || c.status === 'warning').length;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Money check</h1>
          <p className="text-sm text-gray-600">Do the invoices, payments, agreements and vendor money all agree? Read-only: nothing here changes a record.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="min-h-10 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50">{loading ? 'Checking…' : 'Run again'}</button>
      </header>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!report && !error && <p className="text-sm text-gray-500">Checking…</p>}

      {report && (
        <>
          <section aria-label="Summary" className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-base font-semibold text-gray-900">{problems === 0 ? 'Everything agrees.' : `${problems} ${problems === 1 ? 'check needs' : 'checks need'} a look.`}</p>
            <p className="mt-1 text-xs text-gray-500">
              {plural(report.counts.invoices, 'invoice')} · {plural(report.counts.agreements, 'agreement')} · {plural(report.counts.assignments, 'vendor assignment')} · {plural(report.counts.auditEvents, 'money change')} logged in the last 30 days · checked {new Date(report.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
            </p>
          </section>

          <ul className="space-y-2">
            {checks.map((c) => (
              <li key={c.id} className="rounded-2xl border border-gray-100 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-gray-900">{c.title}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${TONE[c.status].cls}`}>{TONE[c.status].label}{c.items.length ? ` · ${c.items.length}` : ''}</span>
                </div>
                {c.items.length > 0 && (
                  <ul className="mt-2 divide-y divide-gray-100 text-sm">
                    {c.items.slice(0, 50).map((i, n) => (
                      <li key={n} className="py-2">
                        <p className="font-medium text-gray-900">{i.ref}</p>
                        <p className="text-gray-600">{i.detail}</p>
                        {(i.expected || i.actual) && <p className="text-xs text-gray-500">{i.expected && <>expected {i.expected}</>}{i.expected && i.actual && ' · '}{i.actual && <>found {i.actual}</>}</p>}
                      </li>
                    ))}
                    {c.items.length > 50 && <li className="py-2 text-xs text-gray-500">and {c.items.length - 50} more</li>}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
