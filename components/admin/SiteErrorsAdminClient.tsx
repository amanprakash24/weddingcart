'use client';

import { useCallback, useEffect, useState } from 'react';

// Errors people hit on the site (25 Oct 2026): one line per kind of problem, newest first, with how often and where.
// "Mark fixed" moves it to Fixed; if it happens again it comes back here on its own.
interface SiteErrorRow {
  id: string;
  source: 'SERVER' | 'BROWSER';
  message: string;
  location: string;
  detail: string | null;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  lastBrowser: string | null;
  resolvedAt: string | null;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

function ErrorItem({ row, onChange }: { row: SiteErrorRow; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const setFixed = async (fixed: boolean) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/site-errors/${row.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fixed }) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Could not save. Please try again.');
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
      setBusy(false);
    }
  };

  return (
    <li className="grid gap-2 py-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-words font-semibold text-gray-900">{row.message}</p>
          <p className="mt-1 text-gray-600">
            <span className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.source === 'SERVER' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
              {row.source === 'SERVER' ? 'Server' : 'Visitor’s browser'}
            </span>
            <span className="break-all font-mono text-xs">{row.location}</span>
          </p>
          <p className="mt-1 text-xs text-gray-500">
            <b className="text-gray-800">{row.count === 1 ? 'Once' : `${row.count} times`}</b> · last {when(row.lastSeenAt)} · first {when(row.firstSeenAt)}
            {row.lastBrowser ? ` · ${row.lastBrowser}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {row.detail && (
            <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50" aria-expanded={open}>
              {open ? 'Hide details' : 'Details'}
            </button>
          )}
          {row.resolvedAt ? (
            <button type="button" disabled={busy} onClick={() => setFixed(false)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-40">
              Open again
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => setFixed(true)} className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
              {busy ? 'Saving…' : 'Mark fixed'}
            </button>
          )}
        </div>
      </div>
      {open && row.detail && <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-700">{row.detail}</pre>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </li>
  );
}

export default function SiteErrorsAdminClient() {
  const [status, setStatus] = useState<'open' | 'fixed'>('open');
  const [rows, setRows] = useState<SiteErrorRow[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (which: 'open' | 'fixed') => {
    setError('');
    try {
      const res = await fetch(`/api/admin/site-errors?status=${which}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Could not load the errors.');
      setRows(data.data.errors);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the errors.');
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(status), 0);
    return () => clearTimeout(t);
  }, [load, status]);

  const tab = (which: 'open' | 'fixed', label: string) => (
    <button
      type="button"
      onClick={() => { setRows(null); setStatus(which); }}
      aria-pressed={status === which}
      className={`rounded-full px-4 py-2 text-sm font-semibold ${status === which ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Site errors</h1>
        <p className="text-sm text-gray-500">
          Problems people hit on the website and in Vivah OS, grouped. No visitor details are kept: no IP, no phone, and ids or private links are blanked out.
        </p>
      </div>
      <div className="flex gap-2">
        {tab('open', 'Needs a look')}
        {tab('fixed', 'Fixed')}
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="rounded-2xl border border-gray-100 bg-white px-4 sm:px-6">
        {rows === null && !error ? (
          <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
        ) : rows && rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">{status === 'open' ? 'No errors right now.' : 'Nothing marked fixed yet.'}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows?.map((row) => <ErrorItem key={row.id} row={row} onChange={() => load(status)} />)}
          </ul>
        )}
      </div>
    </div>
  );
}
