import type { FounderDashboard } from './types';

// Due Today / Overdue / Completed Today — not just a bare overdue count, per
// the explicit "tells you whether the sales process is healthy" ask.
export default function FollowUpHealthCard({ followUpHealth }: { followUpHealth: FounderDashboard['followUpHealth'] }) {
  const cards = [
    { label: 'Due Today', value: followUpHealth.dueToday, color: 'text-blue-600' },
    { label: 'Overdue', value: followUpHealth.overdue, color: 'text-red-600' },
    { label: 'Completed Today', value: followUpHealth.completedToday, color: 'text-emerald-600' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Follow-up Health</h2>
      <div className="grid grid-cols-3 gap-3">
        {cards.map(({ label, value, color }) => (
          <div key={label}>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
