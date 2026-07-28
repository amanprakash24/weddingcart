'use client';

import type { WorkspaceMilestone } from './types';

const STATUS_ICON: Record<WorkspaceMilestone['status'], string> = {
  PENDING: '○',
  IN_PROGRESS: '◐',
  DONE: '●',
  BLOCKED: '✕',
};

// Seeded once at conversion (docs/wedding-os/03-wedding-workspace.md §3's
// default 11-step sequence, not invented) — freely editable from here on,
// this is just the starting template, not a fixed schema.
export default function TimelineMilestones({
  milestones,
  onUpdateStatus,
}: {
  milestones: WorkspaceMilestone[];
  onUpdateStatus: (milestoneId: string, status: WorkspaceMilestone['status']) => Promise<void>;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Wedding Timeline</h2>
      {milestones.length === 0 ? (
        <p className="text-sm text-gray-400">No milestones yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <span className={m.status === 'DONE' ? 'text-emerald-500' : m.status === 'BLOCKED' ? 'text-red-500' : 'text-gray-300'}>
                {STATUS_ICON[m.status]}
              </span>
              <span className={m.status === 'DONE' ? 'text-gray-400 line-through flex-1' : 'text-gray-900 flex-1'}>{m.label}</span>
              {m.status !== 'DONE' && (
                <button onClick={() => onUpdateStatus(m.id, 'DONE')} className="text-xs text-emerald-600 hover:underline">
                  Mark done
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
