'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { STAGE_LABELS, STAGE_COLORS, SOURCE_LABELS } from '@/components/crm/types';
import { LOST_REASON_LABELS } from '@/lib/crm/pipeline';
import StageControl, { type StageTransitionInput } from './StageControl';
import AssignControl from './AssignControl';
import type { LeadWorkspace } from './types';

export default function LeadWorkspaceHeader({
  subject,
  customerName,
  onTransition,
  onAssign,
}: {
  subject: LeadWorkspace['subject'];
  customerName: string;
  onTransition: (input: StageTransitionInput) => Promise<void>;
  onAssign: (assignedToId: string | null) => Promise<void>;
}) {
  const router = useRouter();

  return (
    <div className="space-y-3">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" /> Back to CRM
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif]">{customerName}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{SOURCE_LABELS[subject.sourceType]}</p>
        </div>
        <span className={`text-xs font-medium px-3 py-1 rounded-full ${STAGE_COLORS[subject.pipelineStage]}`}>
          {STAGE_LABELS[subject.pipelineStage]}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Assigned to</span>
          <AssignControl assignedTo={subject.assignedTo} onAssign={onAssign} />
        </div>
        <StageControl currentStage={subject.pipelineStage} onTransition={onTransition} />
      </div>

      {subject.pipelineStage === 'LOST' && subject.lostReason && (
        <div className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2">
          Lost reason: {LOST_REASON_LABELS[subject.lostReason]}
          {subject.lostReasonDetail ? ` — ${subject.lostReasonDetail}` : ''}
        </div>
      )}
      {subject.pipelineStage === 'ON_HOLD' && subject.holdReason && (
        <div className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2">
          On hold: {subject.holdReason}
        </div>
      )}
    </div>
  );
}
