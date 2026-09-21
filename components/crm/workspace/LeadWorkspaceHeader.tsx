'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, MapPin, Users } from 'lucide-react';
import { STAGE_LABELS } from '@/components/crm/types';
import { allowedNextStages } from '@/lib/crm/pipeline';
import type { StatusChip as Chip } from '@/lib/crm/leadJourney';
import StageControl, { type StageTransitionInput } from './StageControl';
import AssignControl from './AssignControl';
import { StatusChip, StatusTrio } from './JourneyParts';
import type { LeadWorkspace } from './types';

// The top of the Lead Workspace: who the client is, where the deal stands (Quotation / Lead / Booking — three separate
// facts), who owns it, and — in the slot on the right — the one Next action. The lead's own stage is shown exactly as it is;
// accepting a quotation never changes it.
export default function LeadWorkspaceHeader({
  subject,
  customerName,
  weddingDate,
  guestCount,
  city,
  chips,
  nextAction,
  onTransition,
  onAssign,
}: {
  subject: LeadWorkspace['subject'];
  customerName: string;
  weddingDate: string | null;
  guestCount: number | null;
  city: string | null;
  chips: { quotation: Chip; booking: Chip };
  nextAction: React.ReactNode;
  onTransition: (input: StageTransitionInput) => Promise<void>;
  onAssign: (assignedToId: string | null) => Promise<void>;
}) {
  const router = useRouter();
  const [showStatus, setShowStatus] = useState(false);
  const locked = !!subject.wedding;
  const canChangeStatus = !locked && allowedNextStages(subject.pipelineStage).length > 0;

  return (
    <div className="grid gap-5 rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
      <div className="grid gap-3">
        <button type="button" onClick={() => router.back()} className="inline-flex w-fit items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Back to leads
        </button>

        <div>
          <h1 className="text-[26px] font-bold leading-tight text-gray-900 font-[Playfair_Display,serif] sm:text-3xl">{customerName}</h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            {weddingDate && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {weddingDate}
              </span>
            )}
            {guestCount != null && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {guestCount} guests
              </span>
            )}
            {city && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {city}
              </span>
            )}
          </div>
        </div>

        <StatusTrio quotation={chips.quotation} lead={{ label: STAGE_LABELS[subject.pipelineStage], tone: 'gray' }} booking={chips.booking} />

        {subject.pipelineStage === 'ON_HOLD' && subject.holdReason && <p className="text-sm text-gray-600">On hold: {subject.holdReason}</p>}
        {locked && subject.wedding && (
          <p className="text-sm text-gray-600">
            This lead is now part of wedding {subject.wedding.weddingNumber}, so it can no longer be edited.
          </p>
        )}

        {!locked && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Assigned to</span>
              <AssignControl assignedTo={subject.assignedTo} onAssign={onAssign} />
            </div>
            {canChangeStatus && (
              <button type="button" onClick={() => setShowStatus((v) => !v)} aria-expanded={showStatus} className="min-h-[40px] text-sm font-medium text-gray-600 underline underline-offset-4">
                {showStatus ? 'Hide status options' : 'Change status'}
              </button>
            )}
          </div>
        )}
        {locked && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Assigned to</span>
            <StatusChip chip={{ label: subject.assignedTo?.name ?? 'Unassigned', tone: 'gray' }} />
          </div>
        )}

        {showStatus && canChangeStatus && (
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <StageControl currentStage={subject.pipelineStage} onTransition={onTransition} />
          </div>
        )}
      </div>

      {nextAction}
    </div>
  );
}
