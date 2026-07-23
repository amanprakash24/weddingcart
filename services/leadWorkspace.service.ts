import { prisma } from '@/lib/prisma';
import { resolveUserNames } from '@/lib/users';
import { leadRepository } from '@/repositories/lead.repository';
import { enquiryRepository } from '@/repositories/enquiry.repository';
import { consultationRepository } from '@/repositories/consultation.repository';
import { taskRepository } from '@/repositories/task.repository';
import { activityLogRepository } from '@/repositories/activityLog.repository';
import { leadInsightRepository } from '@/repositories/leadInsight.repository';
import { subjectWhere, subjectCreateData } from '@/lib/crm/subject';
import { canTransition } from '@/lib/crm/pipeline';
import { STAGE_LABELS } from '@/components/crm/types';
import { NotFoundError, InvalidTransitionError, ConversionLockedError } from '@/lib/errors';
import { findWeddingForSource } from '@/services/weddingConversion.service';
import type { SourceType } from '@/services/leadInbox.service';
import type { Lead, Enquiry, Consultation, Task, ActivityLog, LeadInsight, Wedding, Prisma } from '@/generated/prisma/client';
import {
  TaskContext,
  ActivityType,
  TaskPriority,
  type TaskStatus,
  type PipelineStage,
  type LostReason,
} from '@/generated/prisma/enums';

// Sprint 5.2 Lead Workspace — see docs/wedding-os/03-wedding-workspace.md and
// the plan's "Data model" section: one normalized DTO per subject, so the UI
// components never branch on sourceType. When a Lead/Enquiry/Consultation
// eventually converts to a real Wedding, a parallel adapter can produce this
// same shape from Wedding/WeddingEvent/VendorBooking and reuse every component.

export interface LeadWorkspace {
  subject: {
    sourceType: SourceType;
    id: string;
    pipelineStage: PipelineStage;
    assignedTo: { id: string; name: string | null } | null;
    assignedBy: { id: string; name: string | null } | null;
    assignedAt: Date | null;
    lostReason: LostReason | null;
    lostReasonDetail: string | null;
    holdReason: string | null;
    createdAt: Date;
    // Set once this subject has converted (domain-model.md §5.1) — presence
    // alone is what the UI uses to render the read-only banner + link
    // forward; absence means the mutation controls (stage/assign/task) stay live.
    wedding: { id: string; weddingNumber: string } | null;
  };
  customer: { name: string | null; phone: string; email: string | null; city: string | null };
  weddingDetails: {
    date: string | null;
    type: string | null;
    guestCount: number | null;
    budget: number | null;
    venueType: string | null;
    services: string[];
  };
  vendorInterest: { vendorId: string; vendorName: string; vendorCategory: string }[];
  timeline: (ActivityLog & { performedByName: string | null })[];
  tasks: (Task & { assignedToName: string | null })[];
  insights: LeadInsight[];
}

type Subject = Lead | Enquiry | Consultation;

async function findSubject(sourceType: SourceType, id: string): Promise<Subject> {
  const subject =
    sourceType === 'LEAD'
      ? await leadRepository.findById(id)
      : sourceType === 'ENQUIRY'
        ? await enquiryRepository.findById(id)
        : await consultationRepository.findById(id);

  if (!subject) throw new NotFoundError(sourceType, id);
  return subject;
}

// Lead/Enquiry/Consultation carry identical Sprint 5.3 fields (pipelineStage,
// lostReason(Detail), holdReason, assignedTo/By/At) — this shape is
// structurally valid update input for all three generated *UpdateInput types.
interface SubjectUpdateData {
  pipelineStage?: PipelineStage;
  lostReason?: LostReason | null;
  lostReasonDetail?: string | null;
  holdReason?: string | null;
  assignedTo?: { connect: { id: string } } | { disconnect: true };
  assignedBy?: { connect: { id: string } };
  assignedAt?: Date | null;
}

async function updateSubject(
  sourceType: SourceType,
  id: string,
  data: SubjectUpdateData,
  tx: Prisma.TransactionClient
): Promise<Subject> {
  if (sourceType === 'LEAD') return leadRepository.update(id, data, tx);
  if (sourceType === 'ENQUIRY') return enquiryRepository.update(id, data, tx);
  return consultationRepository.update(id, data, tx);
}

function toCustomer(sourceType: SourceType, subject: Subject): LeadWorkspace['customer'] {
  if (sourceType === 'LEAD') {
    const lead = subject as Lead;
    return { name: null, phone: lead.phone, email: null, city: null };
  }
  const entity = subject as Enquiry | Consultation;
  return { name: entity.name, phone: entity.phone, email: entity.email || null, city: entity.city ?? null };
}

function toWeddingDetails(sourceType: SourceType, subject: Subject): LeadWorkspace['weddingDetails'] {
  if (sourceType === 'ENQUIRY') {
    const enquiry = subject as Enquiry;
    return {
      date: enquiry.eventDate,
      type: enquiry.eventType,
      guestCount: enquiry.guestCount ? Number(enquiry.guestCount) || null : null,
      budget: null,
      venueType: null,
      services: [],
    };
  }
  if (sourceType === 'CONSULTATION') {
    const c = subject as Consultation;
    return {
      date: c.weddingDate,
      type: c.eventType,
      guestCount: c.guestCount,
      budget: c.totalBudget ?? null,
      venueType: c.venueType || null,
      services: c.services,
    };
  }
  return { date: null, type: null, guestCount: null, budget: null, venueType: null, services: [] };
}

function toVendorInterest(sourceType: SourceType, subject: Subject): LeadWorkspace['vendorInterest'] {
  if (sourceType === 'ENQUIRY') {
    const enquiry = subject as Enquiry;
    return [{ vendorId: enquiry.vendorId, vendorName: enquiry.vendorName, vendorCategory: enquiry.vendorCategory }];
  }
  if (sourceType === 'CONSULTATION') {
    const c = subject as Consultation;
    // Consultation only stores category names it's interested in (planning
    // wizard), not specific vendors — no vendorId/vendorName to show yet.
    return c.services.map((category) => ({ vendorId: '', vendorName: '', vendorCategory: category }));
  }
  return [];
}

// Shared guard for every mutation below except addNote — throws once the
// subject has a Wedding on file rather than leaving it to each call site to
// remember. Returns void; callers that already have the subject loaded don't
// need the return value, this is purely a gate.
async function assertNotConverted(sourceType: SourceType, id: string): Promise<void> {
  const wedding = await findWeddingForSource(sourceType, id);
  if (wedding) {
    throw new ConversionLockedError(
      `This ${sourceType.toLowerCase()} converted to Wedding ${wedding.weddingNumber} and is read-only`
    );
  }
}

export const leadWorkspaceService = {
  async getWorkspace(sourceType: SourceType, id: string): Promise<LeadWorkspace> {
    const subject = await findSubject(sourceType, id);
    const where = subjectWhere(sourceType, id);

    const [{ data: tasks }, { data: timeline }, { data: insights }, wedding] = await Promise.all([
      taskRepository.findMany({ where, orderBy: { createdAt: 'desc' } }),
      activityLogRepository.findMany({ where }),
      leadInsightRepository.findMany({ where }),
      findWeddingForSource(sourceType, id) as Promise<Wedding | null>,
    ]);

    const nameById = await resolveUserNames([
      subject.assignedToId,
      subject.assignedById,
      ...tasks.map((t) => t.assignedToId),
      ...timeline.map((a) => a.performedById),
    ]);
    const nameOf = (userId: string | null): { id: string; name: string | null } | null =>
      userId ? { id: userId, name: nameById.get(userId) ?? null } : null;

    return {
      subject: {
        sourceType,
        id: subject.id,
        pipelineStage: subject.pipelineStage,
        assignedTo: nameOf(subject.assignedToId),
        assignedBy: nameOf(subject.assignedById),
        assignedAt: subject.assignedAt,
        lostReason: subject.lostReason,
        lostReasonDetail: subject.lostReasonDetail,
        holdReason: subject.holdReason,
        createdAt: subject.createdAt,
        wedding: wedding ? { id: wedding.id, weddingNumber: wedding.weddingNumber } : null,
      },
      customer: toCustomer(sourceType, subject),
      weddingDetails: toWeddingDetails(sourceType, subject),
      vendorInterest: toVendorInterest(sourceType, subject),
      timeline: timeline.map((a) => ({ ...a, performedByName: a.performedById ? (nameById.get(a.performedById) ?? null) : null })),
      tasks: tasks.map((t) => ({ ...t, assignedToName: t.assignedToId ? (nameById.get(t.assignedToId) ?? null) : null })),
      insights,
    };
  },

  async addNote(
    sourceType: SourceType,
    id: string,
    { detail, performedById }: { detail: string; performedById: string | null }
  ): Promise<ActivityLog> {
    await findSubject(sourceType, id); // 404s if the subject doesn't exist
    return activityLogRepository.create({
      type: ActivityType.NOTE,
      summary: detail.length > 80 ? `${detail.slice(0, 77)}...` : detail,
      detail,
      performedBy: performedById ? { connect: { id: performedById } } : undefined,
      ...subjectCreateData(sourceType, id),
    });
  },

  async addTask(
    sourceType: SourceType,
    id: string,
    input: {
      title: string;
      description?: string;
      dueAt?: Date;
      priority?: TaskPriority;
      assignedToId?: string;
      createdById: string | null;
    }
  ): Promise<Task> {
    await findSubject(sourceType, id);
    await assertNotConverted(sourceType, id);
    return taskRepository.create({
      context: TaskContext.SALES_FOLLOWUP,
      title: input.title,
      description: input.description,
      dueAt: input.dueAt,
      priority: input.priority,
      assignedTo: input.assignedToId ? { connect: { id: input.assignedToId } } : undefined,
      createdBy: input.createdById ? { connect: { id: input.createdById } } : undefined,
      ...subjectCreateData(sourceType, id),
    });
  },

  async completeTask(sourceType: SourceType, id: string, taskId: string, status: TaskStatus): Promise<Task> {
    const task = await taskRepository.findById(taskId);
    const where = subjectWhere(sourceType, id);
    const belongsToSubject = task && Object.entries(where).every(([key, value]) => (task as Record<string, unknown>)[key] === value);
    if (!belongsToSubject) throw new NotFoundError('Task', taskId);

    return taskRepository.update(taskId, {
      status,
      completedAt: status === 'DONE' ? new Date() : null,
    });
  },

  // Sprint 5.3 — the pipeline as a controlled state machine (lib/crm/pipeline.ts).
  // One transaction: subject update + one ActivityLog(STATUS_CHANGED) entry,
  // plus (only for ON_HOLD with a reviewDate) one reminder Task — "every
  // reminder becomes a Task," not a separate scheduling field.
  async transitionStage(
    sourceType: SourceType,
    id: string,
    input: {
      toStage: PipelineStage;
      reason?: string;
      reasonDetail?: string;
      reviewDate?: Date;
      actorId: string | null;
    }
  ): Promise<Subject> {
    const subject = await findSubject(sourceType, id);
    await assertNotConverted(sourceType, id);
    const fromStage = subject.pipelineStage;

    if (!canTransition(fromStage, input.toStage)) {
      throw new InvalidTransitionError(
        `Cannot move from ${STAGE_LABELS[fromStage]} to ${STAGE_LABELS[input.toStage]}`
      );
    }
    if (input.toStage === 'LOST' && !input.reason) {
      throw new InvalidTransitionError('A reason is required to mark a lead as Lost');
    }
    if (input.toStage === 'ON_HOLD' && !input.reason) {
      throw new InvalidTransitionError('A reason is required to place a lead On Hold');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await updateSubject(
        sourceType,
        id,
        {
          pipelineStage: input.toStage,
          lostReason: input.toStage === 'LOST' ? (input.reason as LostReason) : undefined,
          lostReasonDetail: input.toStage === 'LOST' ? (input.reasonDetail ?? null) : undefined,
          holdReason: input.toStage === 'ON_HOLD' ? input.reason : fromStage === 'ON_HOLD' ? null : undefined,
        },
        tx
      );

      await activityLogRepository.create(
        {
          type: ActivityType.STATUS_CHANGED,
          summary: `Stage changed: ${STAGE_LABELS[fromStage]} → ${STAGE_LABELS[input.toStage]}`,
          detail: input.reason ?? null,
          fromStage,
          toStage: input.toStage,
          performedBy: input.actorId ? { connect: { id: input.actorId } } : undefined,
          ...subjectCreateData(sourceType, id),
        },
        tx
      );

      if (input.toStage === 'ON_HOLD' && input.reviewDate) {
        await taskRepository.create(
          {
            context: TaskContext.SALES_FOLLOWUP,
            title: 'Review lead (on hold)',
            dueAt: input.reviewDate,
            priority: TaskPriority.MEDIUM,
            createdBy: input.actorId ? { connect: { id: input.actorId } } : undefined,
            ...subjectCreateData(sourceType, id),
          },
          tx
        );
      }

      return updated;
    });
  },

  async assignLead(
    sourceType: SourceType,
    id: string,
    { assignedToId, actorId }: { assignedToId: string | null; actorId: string | null }
  ): Promise<Subject> {
    await findSubject(sourceType, id);
    await assertNotConverted(sourceType, id);

    return prisma.$transaction(async (tx) => {
      const updated = await updateSubject(
        sourceType,
        id,
        {
          assignedTo: assignedToId ? { connect: { id: assignedToId } } : { disconnect: true },
          assignedBy: actorId ? { connect: { id: actorId } } : undefined,
          assignedAt: new Date(),
        },
        tx
      );

      const nameById = await resolveUserNames([assignedToId]);
      await activityLogRepository.create(
        {
          type: ActivityType.ASSIGNED,
          summary: assignedToId ? `Assigned to ${nameById.get(assignedToId) ?? 'a sales rep'}` : 'Unassigned',
          performedBy: actorId ? { connect: { id: actorId } } : undefined,
          ...subjectCreateData(sourceType, id),
        },
        tx
      );

      return updated;
    });
  },
};
