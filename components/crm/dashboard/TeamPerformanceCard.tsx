import type { FounderDashboard } from './types';

// Built assuming multiple reps from day one, per explicit instruction — the
// "Unassigned" row is real data (most leads today), not a placeholder.
export default function TeamPerformanceCard({ teamPerformance }: { teamPerformance: FounderDashboard['teamPerformance'] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Team Performance</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="font-medium py-1">Rep</th>
            <th className="font-medium py-1 text-right">Open</th>
            <th className="font-medium py-1 text-right">Won (mo)</th>
            <th className="font-medium py-1 text-right">Lost (mo)</th>
          </tr>
        </thead>
        <tbody>
          {teamPerformance.map((row) => (
            <tr key={row.userId ?? 'unassigned'} className="border-t border-gray-50">
              <td className="py-1.5 text-gray-900">{row.name}</td>
              <td className="py-1.5 text-right text-gray-600">{row.open}</td>
              <td className="py-1.5 text-right text-emerald-600">{row.wonThisMonth}</td>
              <td className="py-1.5 text-right text-gray-500">{row.lostThisMonth}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
