import type { Prisma } from '@/generated/prisma/client';
import { ActivityType, type PipelineStage } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { activityLogRepository } from '@/repositories/activityLog.repository';
import { subjectCreateData } from '@/lib/crm/subject';
import { EVENT_REASON, stageAfterEvent, type CommercialEvent } from '@/lib/crm/stageEvents';
import { STAGE_LABELS } from '@/components/crm/types';
import type { SourceType } from '@/services/leadInbox.service';

type Client = Prisma.TransactionClient | typeof prisma;

// Deliberately its own module: quotation.service and weddingConversion.service both call it, and leadWorkspace.service
// already imports weddingConversion, so putting this there would make an import cycle.
async function currentStage(db: Client, sourceType: SourceType, id: string): Promise<PipelineStage | null> {
  const select = { pipelineStage: true } as const;
  const row =
    sourceType === 'LEAD'
      ? await db.lead.findUnique({ where: { id }, select })
      : sourceType === 'ENQUIRY'
        ? await db.enquiry.findUnique({ where: { id }, select })
        : await db.consultation.findUnique({ where: { id }, select });
  return row?.pipelineStage ?? null;
}

// Moves the lead's stage to match a commercial fact, and records it on the timeline. Returns the new stage, or null when
// nothing needed to change. Runs inside the caller's transaction when given one, so a wedding never appears without the
// lead reading "Booked".
export async function applyCommercialEvent(
  db: Client,
  sourceType: SourceType,
  id: string,
  event: CommercialEvent,
  actorId: string | null
): Promise<PipelineStage | null> {
  const from = await currentStage(db, sourceType, id);
  if (!from) return null;
  const to = stageAfterEvent(from, event);
  if (!to || to === from) return null;

  // Leaving a pause clears its reason.
  const data = { pipelineStage: to, ...(from === 'ON_HOLD' ? { holdReason: null } : {}) };
  if (sourceType === 'LEAD') await db.lead.update({ where: { id }, data });
  else if (sourceType === 'ENQUIRY') await db.enquiry.update({ where: { id }, data });
  else await db.consultation.update({ where: { id }, data });

  await activityLogRepository.create(
    {
      type: ActivityType.STATUS_CHANGED,
      summary: `Stage changed: ${STAGE_LABELS[from]} → ${STAGE_LABELS[to]}`,
      detail: `Automatic — ${EVENT_REASON[event]}`,
      fromStage: from,
      toStage: to,
      performedBy: actorId ? { connect: { id: actorId } } : undefined,
      ...subjectCreateData(sourceType, id),
    },
    db as Prisma.TransactionClient
  );
  return to;
}
