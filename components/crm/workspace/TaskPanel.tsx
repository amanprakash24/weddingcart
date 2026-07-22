'use client';

import { useState } from 'react';
import type { WorkspaceTask } from './types';

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-amber-100 text-amber-700',
  URGENT: 'bg-red-100 text-red-700',
};

export default function TaskPanel({
  tasks,
  onAddTask,
  onCompleteTask,
}: {
  tasks: WorkspaceTask[];
  onAddTask: (title: string) => Promise<void>;
  onCompleteTask: (taskId: string, status: 'DONE' | 'CANCELLED') => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onAddTask(title.trim());
      setTitle('');
    } finally {
      setSubmitting(false);
    }
  };

  const open = tasks.filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
  const closed = tasks.filter((t) => t.status === 'DONE' || t.status === 'CANCELLED');

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Follow-ups</h2>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New follow-up…"
          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all bg-gray-50 focus:bg-white"
        />
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-amber-500 text-white disabled:opacity-40 hover:bg-amber-600 transition-colors"
        >
          Add
        </button>
      </form>

      {open.length === 0 && closed.length === 0 ? (
        <p className="text-sm text-gray-400">No follow-ups scheduled.</p>
      ) : (
        <ul className="space-y-2">
          {open.map((t) => (
            <li key={t.id} className="flex items-center justify-between text-sm border border-gray-100 rounded-xl px-3 py-2">
              <div>
                <div className="text-gray-900 font-medium">{t.title}</div>
                <div className="text-gray-400 text-xs">
                  {t.assignedToName ?? 'Unassigned'}
                  {t.dueAt ? ` · due ${new Date(t.dueAt).toLocaleDateString()}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                <button onClick={() => onCompleteTask(t.id, 'DONE')} className="text-xs text-emerald-600 hover:underline">
                  Done
                </button>
              </div>
            </li>
          ))}
          {closed.map((t) => (
            <li key={t.id} className="flex items-center justify-between text-sm px-3 py-2 opacity-50">
              <span className="line-through text-gray-500">{t.title}</span>
              <span className="text-xs text-gray-400">{t.status === 'DONE' ? 'Done' : 'Cancelled'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
