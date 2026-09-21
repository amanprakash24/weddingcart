'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, CalendarDays, Check, MapPin, MoreHorizontal, Users } from 'lucide-react';
import type { ControlRoomView } from '@/lib/wedding/controlRoom';
import type { WeddingStatus } from '@/components/wedding/workspace/types';

const STAGE_TONE: Record<string, string> = {
  PLANNING: 'bg-blue-50 text-blue-700',
  FINAL_WEEK: 'bg-amber-100 text-amber-800',
  WEDDING_DAY: 'bg-rose-100 text-rose-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  POSTPONED: 'bg-amber-100 text-amber-800',
  CANCELLED: 'bg-gray-200 text-gray-600',
};

type Pending = { to: WeddingStatus; label: string; question: string } | null;

// Who and when, at a glance: the couple, the date, the place, the guests, and where the wedding stands. Everything else about the
// wedding is one tab away; the number, the quotation and the lead are here too, but small.
export default function ControlRoomHeader({ view, onTransition }: { view: ControlRoomView; onTransition: (to: WeddingStatus) => Promise<void> }) {
  const [menu, setMenu] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options: NonNullable<Pending>[] = [
    ...(view.canComplete ? [{ to: 'COMPLETED' as const, label: 'Mark wedding as completed', question: 'Mark this wedding as completed?' }] : []),
    ...(view.canResume ? [{ to: 'PLANNING' as const, label: 'Resume planning', question: 'Resume planning for this wedding?' }] : []),
    ...(view.canPostponeOrCancel ? [
      { to: 'POSTPONED' as const, label: 'Postpone wedding', question: 'Postpone this wedding?' },
      { to: 'CANCELLED' as const, label: 'Cancel wedding', question: 'Cancel this wedding? This cannot be undone.' },
    ] : []),
  ];

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await onTransition(pending.to);
      setPending(null);
      setMenu(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change the wedding');
    } finally {
      setBusy(false);
    }
  };

  const { lead } = view.secondary;

  return (
    <header className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <Link href="/admin/dashboard?section=upcoming" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Weddings
        </Link>
        {options.length > 0 && (
          <div className="relative">
            <button
              type="button"
              aria-label="More actions"
              aria-expanded={menu}
              onClick={() => { setMenu((v) => !v); setPending(null); setError(null); }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </button>
            {menu && (
              <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                {pending ? (
                  <div className="p-2">
                    <p className="text-sm font-medium text-gray-900">{pending.question}</p>
                    {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
                    <div className="mt-2 flex gap-2">
                      <button type="button" disabled={busy} onClick={confirm} className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Yes'}</button>
                      <button type="button" disabled={busy} onClick={() => setPending(null)} className="rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">No</button>
                    </div>
                  </div>
                ) : (
                  options.map((o) => (
                    <button key={o.to} type="button" onClick={() => setPending(o)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50 ${o.to === 'CANCELLED' ? 'text-red-600' : 'text-gray-800'}`}>
                      {o.label}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <h1 className="mt-3 break-words font-[Playfair_Display,serif] text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">{view.title}</h1>

      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700 sm:text-base">
        {view.facts.map((fact, i) => (
          <span key={fact} className="inline-flex items-center gap-1.5">
            {i === 0 ? <CalendarDays className="h-4 w-4 text-rose-500" aria-hidden /> : fact.endsWith('guests') ? <Users className="h-4 w-4 text-rose-500" aria-hidden /> : <MapPin className="h-4 w-4 text-rose-500" aria-hidden />}
            {fact}
          </span>
        ))}
        {view.when && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{view.when}</span>}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
          <Check className="h-3.5 w-3.5" aria-hidden /> {view.bookingLabel}
        </span>
        <span className={`rounded-full px-3 py-1 ${STAGE_TONE[view.stage]}`}>{view.stageLabel}</span>
      </div>
      {view.banner && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{view.banner}</p>}

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
        <span>{view.secondary.weddingNumber}</span>
        {view.secondary.quotationNumber && <span>Quotation {view.secondary.quotationNumber}</span>}
        <span>Coordinator: {view.secondary.coordinator ?? 'not assigned'}</span>
        {lead && <Link href={`/admin/crm/leads/${lead.sourceType}/${lead.id}`} className="text-gray-500 underline-offset-2 hover:underline">View lead</Link>}
      </p>
    </header>
  );
}
