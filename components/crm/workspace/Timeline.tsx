'use client';

import { useState } from 'react';
import type { WorkspaceActivity } from './types';

const TYPE_LABELS: Record<string, string> = {
  CALL: 'Call', WHATSAPP: 'WhatsApp', EMAIL: 'Email', MEETING: 'Meeting', NOTE: 'Note',
  STATUS_CHANGED: 'Status Changed', VENDOR_CONFIRMED: 'Vendor Confirmed', VENDOR_DECLINED: 'Vendor Declined',
  PAYMENT_RECEIVED: 'Payment Received', TASK_CREATED: 'Task Created', TASK_COMPLETED: 'Task Completed',
  TASK_OVERDUE: 'Task Overdue', TIMELINE_DELAYED: 'Timeline Delayed', DOCUMENT_UPLOADED: 'Document Uploaded',
  AI_DRAFT_CREATED: 'AI Draft Created', ASSIGNED: 'Assigned',
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// "Notes" is a quick-add box here, not a separate panel/table — a NOTE is an
// ActivityType, so it posts into the same feed it renders in. See the
// Sprint 5.2 plan's "Notes vs. Timeline" decision.
export default function Timeline({
  activities,
  onAddNote,
}: {
  activities: WorkspaceActivity[];
  onAddNote: (detail: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Timeline & Notes</h2>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note…"
          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all bg-gray-50 focus:bg-white"
        />
        <button
          type="submit"
          disabled={submitting || !note.trim()}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-amber-500 text-white disabled:opacity-40 hover:bg-amber-600 transition-colors"
        >
          Add
        </button>
      </form>

      {activities.length === 0 ? (
        <p className="text-sm text-gray-400">No activity recorded.</p>
      ) : (
        <ul className="space-y-3">
          {activities.map((a) => (
            <li key={a.id} className="text-sm border-l-2 border-amber-100 pl-3">
              <div className="flex justify-between">
                <span className="font-medium text-gray-900">{TYPE_LABELS[a.type] ?? a.type}</span>
                <span className="text-gray-400 text-xs">{timeAgo(a.createdAt)}</span>
              </div>
              {a.detail && <p className="text-gray-600">{a.detail}</p>}
              <p className="text-gray-400 text-xs mt-0.5">{a.performedByName ?? (a.aiGenerated ? 'AI' : 'System')}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
