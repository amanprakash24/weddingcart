'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { STAGE_LABELS, STAGE_COLORS, SOURCE_LABELS } from '@/components/crm/types';
import type { LeadWorkspace } from './types';

export default function LeadWorkspaceHeader({ subject, customerName }: { subject: LeadWorkspace['subject']; customerName: string }) {
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
          <p className="text-gray-500 text-sm mt-0.5">
            {SOURCE_LABELS[subject.sourceType]} · Assigned to {subject.assignedTo?.name ?? 'Unassigned'}
          </p>
        </div>
        <span className={`text-xs font-medium px-3 py-1 rounded-full ${STAGE_COLORS[subject.pipelineStage]}`}>
          {STAGE_LABELS[subject.pipelineStage]}
        </span>
      </div>

      {subject.pipelineStage === 'LOST' && subject.lostReason && (
        <div className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2">
          Lost reason: {subject.lostReason}
        </div>
      )}
    </div>
  );
}
