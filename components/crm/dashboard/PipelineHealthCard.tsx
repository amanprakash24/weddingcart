import type { FounderDashboard } from './types';

// Movement, not just counts — per the user's explicit "show movement, not
// just counts" ask, distinct from StatsCards.tsx's static Pipeline by Stage.
export default function PipelineHealthCard({ pipelineHealth }: { pipelineHealth: FounderDashboard['pipelineHealth'] }) {
  const cards = [
    { label: 'New This Week', value: pipelineHealth.newThisWeek, color: 'text-blue-600' },
    { label: 'Converted This Week', value: pipelineHealth.convertedThisWeek, color: 'text-emerald-600' },
    { label: 'Lost This Week', value: pipelineHealth.lostThisWeek, color: 'text-gray-500' },
    { label: 'On Hold', value: pipelineHealth.onHold, color: 'text-slate-600' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Pipeline Health</h2>
      <div className="grid grid-cols-2 gap-3">
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
