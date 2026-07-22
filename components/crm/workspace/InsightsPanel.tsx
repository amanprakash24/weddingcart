import type { WorkspaceInsight } from './types';

// Empty state is the default, not an edge case — LeadInsight has zero rows
// anywhere until AI generation is wired up (docs/wedding-os/07-ai-assistant.md).
export default function InsightsPanel({ insights }: { insights: WorkspaceInsight[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-2">Insights</h2>
      {insights.length === 0 ? (
        <p className="text-sm text-gray-400">No insights available yet.</p>
      ) : (
        <ul className="space-y-3">
          {insights.map((i) => (
            <li key={i.id} className="text-sm">
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                  {i.generatedBy === 'AI' ? (i.source ?? 'AI') : 'Manual'}
                </span>
                {i.sentiment && <span className="text-xs text-gray-400">{i.sentiment}</span>}
              </div>
              <p className="text-gray-900 mt-1">{i.summary}</p>
              {i.nextAction && <p className="text-gray-500 text-xs mt-0.5">Next: {i.nextAction}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
