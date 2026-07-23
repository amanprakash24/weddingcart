'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Link as LinkIcon } from 'lucide-react';
import { STAGE_LABELS, STAGE_COLORS, SOURCE_LABELS } from '@/components/crm/types';
import { LOST_REASON_LABELS } from '@/lib/crm/pipeline';
import StageControl, { type StageTransitionInput } from './StageControl';
import AssignControl from './AssignControl';
import ConvertToWeddingDialog, { type ConvertToWeddingInput } from './ConvertToWeddingDialog';
import type { LeadWorkspace } from './types';

export default function LeadWorkspaceHeader({
  subject,
  customerName,
  customerCity,
  onTransition,
  onAssign,
  onConvert,
}: {
  subject: LeadWorkspace['subject'];
  customerName: string;
  customerCity: string;
  onTransition: (input: StageTransitionInput) => Promise<void>;
  onAssign: (assignedToId: string | null) => Promise<void>;
  onConvert: (input: ConvertToWeddingInput) => Promise<void>;
}) {
  const router = useRouter();
  const [showConvertDialog, setShowConvertDialog] = useState(false);

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

      {subject.wedding ? (
        // Converted — pipeline/deal fields are read-only from here
        // (domain-model.md §5.1); Notes stay editable, handled by Timeline.
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2">
          <LinkIcon className="w-4 h-4" />
          Converted to Wedding {subject.wedding.weddingNumber} — this record is read-only.
          <a href={`/admin/weddings/${subject.wedding.id}`} className="font-medium underline ml-auto">
            Open Wedding Workspace
          </a>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Assigned to</span>
            <AssignControl assignedTo={subject.assignedTo} onAssign={onAssign} />
          </div>
          <StageControl currentStage={subject.pipelineStage} onTransition={onTransition} />
          {subject.pipelineStage === 'WON' && (
            <button
              onClick={() => setShowConvertDialog(true)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
            >
              Create Wedding Workspace
            </button>
          )}
        </div>
      )}

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

      {showConvertDialog && (
        <ConvertToWeddingDialog
          defaultCity={customerCity}
          onClose={() => setShowConvertDialog(false)}
          onConvert={async (input) => {
            await onConvert(input);
            setShowConvertDialog(false);
          }}
        />
      )}
    </div>
  );
}
