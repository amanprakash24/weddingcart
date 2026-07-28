import { PIPELINE_STAGES, STAGE_LABELS, STAGE_COLORS, type LeadInboxStats } from './types';

// Analytics, deliberately below the fold per the "Dashboard = Work, not
// analytics" principle — TodaysWork.tsx leads, this comes after.
export default function StatsCards({ stats, loading }: { stats: LeadInboxStats | null; loading: boolean }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 mb-3">Pipeline by Stage</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {PIPELINE_STAGES.map((stage) => (
          <div key={stage} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <div className="text-xl font-bold text-gray-900">{loading ? '—' : (stats?.byStage[stage] ?? 0)}</div>
            <div className={`inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${STAGE_COLORS[stage]}`}>
              {STAGE_LABELS[stage]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
