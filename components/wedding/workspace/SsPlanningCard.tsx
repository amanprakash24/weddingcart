import { SS_PLANNING, planningScope } from '@/lib/planning/ssPlanning';
import { functionDisplayName } from '@/lib/wedding/coupleFunctions';

// Shaadi Shopping's own planning & coordination on the staff wedding page (26 Nov 2026). The couple sees the same row on their
// link, invoice and My Wedding. It is not a vendor booking: no price, no payout, no work order — "Included", always.
export default function SsPlanningCard({ events, coordinatorName }: { events: { type: string; label: string | null }[]; coordinatorName: string | null }) {
  return (
    <section aria-label={SS_PLANNING.service} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50/60 px-4 py-3.5">
      <div className="min-w-0">
        <p className="font-semibold text-gray-900">
          {SS_PLANNING.provider} <span className="font-normal text-gray-500">· {SS_PLANNING.service}</span>
        </p>
        <p className="mt-0.5 text-sm text-gray-600">
          {planningScope(events.map(functionDisplayName))}
          {' · '}
          {coordinatorName ? `Coordinator: ${coordinatorName}` : 'No coordinator assigned yet'}
        </p>
      </div>
      <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{SS_PLANNING.included}</span>
    </section>
  );
}
