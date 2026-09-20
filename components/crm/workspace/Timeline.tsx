'use client';

import { useState } from 'react';
import { activityView } from '@/lib/crm/activityDisplay';
import type { WorkspaceActivity } from './types';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const DOT_CLASS = { note: 'border-blue-300', key: 'border-amber-500', stop: 'border-slate-400', plain: 'border-gray-300' } as const;

// Every activity reads as the sentence it already stores ("Quotation sent to customer", "Customer accepted the quotation",
// "Lead assigned to Gaurav"). The technical event type is kept for audit and appears only behind "Audit details".
//
// "Notes" is a quick-add box here, not a separate panel/table — a NOTE is an ActivityType, so it posts into the same feed it
// renders in. See the Sprint 5.2 plan's "Notes vs. Timeline" decision.
export default function Timeline({
  activities,
  onAddNote,
  lostReasonText,
}: {
  activities: WorkspaceActivity[];
  onAddNote: (detail: string) => Promise<void>;
  lostReasonText?: string | null;
}) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [audit, setAudit] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onAddNote(note.trim());
      setNote('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white" aria-label="Activity and notes">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-1.5 pt-5">
        <h2 className="text-lg font-bold text-gray-900 font-[Playfair_Display,serif]">Activity &amp; notes</h2>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-gray-500">
          <input type="checkbox" checked={audit} onChange={(e) => setAudit(e.target.checked)} className="h-4 w-4" />
          Audit details
        </label>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 px-5 pb-4 pt-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note…"
          aria-label="Add a note"
          className="min-h-[44px] flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-all focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
        />
        <button
          type="submit"
          disabled={submitting || !note.trim()}
          className="min-h-[44px] rounded-xl bg-amber-500 px-4 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-40"
        >
          Add
        </button>
      </form>

      {activities.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-gray-400">No activity recorded.</p>
      ) : (
        <ul className="m-0 grid list-none gap-0 px-5 pb-4">
          {activities.map((a) => {
            const v = activityView(a, { lostReasonText });
            return (
              <li key={a.id} className="relative border-l-2 border-gray-100 pb-4 pl-5 last:border-transparent last:pb-1">
                <span aria-hidden className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full border-[3px] bg-white ${DOT_CLASS[v.tone]}`} />
                <div className="text-sm font-semibold text-gray-900">{v.headline}</div>
                {v.body && <p className="mt-0.5 text-sm text-gray-600">{v.body}</p>}
                <p className="mt-0.5 text-xs text-gray-400">
                  {timeAgo(a.createdAt)} · {v.by}
                  {audit && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10.5px] tracking-wide text-gray-500">{v.auditCode}</span>}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
