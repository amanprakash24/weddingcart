import { prisma } from '@/lib/prisma';
import { resolveUserNames } from '@/lib/users';
import { leadRepository } from '@/repositories/lead.repository';
import { enquiryRepository } from '@/repositories/enquiry.repository';
import { consultationRepository } from '@/repositories/consultation.repository';
import { taskRepository } from '@/repositories/task.repository';
import { activityLogRepository } from '@/repositories/activityLog.repository';
import { leadInsightRepository } from '@/repositories/leadInsight.repository';
import { subjectWhere, subjectCreateData } from '@/lib/crm/subject';
import { NotFoundError } from '@/lib/errors';
import type { SourceType } from '@/services/leadInbox.service';
import type { Lead, Enquiry, Consultation, Task, ActivityLog, LeadInsight } from '@/generated/prisma/client';
import { TaskContext, ActivityType, type TaskStatus, type TaskPriority } from '@/generated/prisma/enums';

// Sprint 5.2 Lead Workspace — see docs/wedding-os/03-wedding-workspace.md and
// the plan's "Data model" section: one normalized DTO per subject, so the UI
// components never branch on sourceType. When a Lead/Enquiry/Consultation
// eventually converts to a real Wedding, a parallel adapter can produce this
// same shape from Wedding/WeddingEvent/VendorBooking and reuse every component.

export interface LeadWorkspace {
  subject: {
    sourceType: SourceType;
    id: string;
    pipelineStage: string;
    assignedTo: { id: string; name: string | null } | null;
    lostReason: string | null;
    createdAt: Date;
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

async function resolveAssignee(assignedToId: string | null): Promise<LeadWorkspace['subject']['assignedTo']> {
  if (!assignedToId) return null;
  const user = await prisma.user.findUnique({ where: { id: assignedToId }, select: { id: true, name: true } });
  return user ? { id: user.id, name: user.name } : null;
}

export const leadWorkspaceService = {
  async getWorkspace(sourceType: SourceType, id: string): Promise<LeadWorkspace> {
    const subject = await findSubject(sourceType, id);
    const where = subjectWhere(sourceType, id);

    const [{ data: tasks }, { data: timeline }, { data: insights }, assignedTo] = await Promise.all([
      taskRepository.findMany({ where, orderBy: { createdAt: 'desc' } }),
      activityLogRepository.findMany({ where }),
      leadInsightRepository.findMany({ where }),
      resolveAssignee(subject.assignedToId),
    ]);

    const nameById = await resolveUserNames([
      ...tasks.map((t) => t.assignedToId),
      ...timeline.map((a) => a.performedById),
    ]);

    return {
      subject: {
        sourceType,
        id: subject.id,
        pipelineStage: subject.pipelineStage,
        assignedTo,
        lostReason: subject.lostReason,
        createdAt: subject.createdAt,
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
};
