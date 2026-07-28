import { STAGE_LABELS } from '@/components/crm/types';
import type { FounderDashboard } from './types';

// Average days spent in each stage before leaving it — 0-sample stages show
// "Not enough data yet" rather than a misleading 0d, per the Sprint 5.4 plan
// (expected on staging today: no real transitions recorded yet).
export default function PipelineVelocityCard({ velocity }: { velocity: FounderDashboard['velocity'] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Pipeline Velocity</h2>
      <ul className="space-y-1.5">
        {velocity.map(({ stage, avgDays, sampleSize }) => (
          <li key={stage} className="flex justify-between text-sm">
            <span className="text-gray-500">{STAGE_LABELS[stage]}</span>
            <span className="text-gray-900 font-medium">
              {avgDays != null ? `${avgDays.toFixed(1)}d avg (${sampleSize})` : 'Not enough data yet'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
