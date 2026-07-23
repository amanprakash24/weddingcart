import { prisma } from '@/lib/prisma';
import { resolveUserNames } from '@/lib/users';
import { weddingRepository } from '@/repositories/wedding.repository';
import { coupleRepository } from '@/repositories/couple.repository';
import { weddingEventRepository } from '@/repositories/weddingEvent.repository';
import { vendorBookingRepository } from '@/repositories/vendorBooking.repository';
import { taskRepository } from '@/repositories/task.repository';
import { activityLogRepository } from '@/repositories/activityLog.repository';
import { timelineMilestoneRepository } from '@/repositories/timelineMilestone.repository';
import { documentRepository } from '@/repositories/document.repository';
import { computeWeddingHealth, type WeddingHealth } from '@/lib/wedding/health';
import { canTransitionWedding, maybeActivateWedding } from '@/lib/wedding/lifecycle';
import { NotFoundError, InvalidTransitionError } from '@/lib/errors';
import { ActivityType, type TaskStatus, type WeddingStatus, type VendorBookingStatus } from '@/generated/prisma/enums';
import type { Wedding, Task, ActivityLog, Document, TimelineMilestone, Prisma } from '@/generated/prisma/client';

// Milestone 6 Phase 6.2 — one aggregate read model, same Workspace Loader
// philosophy as services/leadWorkspace.service.ts's LeadWorkspace: every
// components/wedding/workspace/* component only ever sees this shape.

export interface WeddingWorkspaceEvent {
  id: string;
  type: string;
  label: string | null;
  date: Date;
  startTime: string | null;
  venueName: string | null;
  venueAddress: string | null;
  city: string;
  budget: number | null;
  vendorBookings: {
    id: string;
    vendorId: string;
    vendorName: string;
    vendorCategory: string;
    status: VendorBookingStatus;
    agreedPrice: number;
    declineReason: string | null;
    respondedAt: Date | null;
    onTimeService: boolean | null;
  }[];
}

export interface WeddingWorkspace {
  wedding: Wedding & { coordinatorName: string | null; customerName: string | null };
  health: WeddingHealth;
  couple: {
    brideName: string | null;
    bridePhone: string | null;
    groomName: string | null;
    groomPhone: string | null;
    preferredLanguage: string | null;
    preferences: string | null;
  } | null;
  events: WeddingWorkspaceEvent[];
  timeline: TimelineMilestone[];
  activity: (ActivityLog & { performedByName: string | null })[];
  tasks: (Task & { assignedToName: string | null })[];
  documents: Document[];
  // No backing entity yet — LeadInsight is hard-typed to lead/enquiry/
  // consultation, has no weddingId (checked against the real schema before
  // planning Milestone 6). Empty-safe placeholder, not faked data.
  insights: [];
}

async function findWeddingOrThrow(id: string): Promise<Wedding> {
  const wedding = await weddingRepository.findById(id);
  if (!wedding) throw new NotFoundError('Wedding', id);
  return wedding;
}

export const weddingWorkspaceService = {
  async getWorkspace(id: string): Promise<WeddingWorkspace> {
    const wedding = await findWeddingOrThrow(id);

    const [couple, { data: events }, { data: tasks }, { data: activity }, timeline, { data: documents }] =
      await Promise.all([
        coupleRepository.findByWeddingId(id),
        weddingEventRepository.findMany({ where: { weddingId: id }, orderBy: { date: 'asc' } }),
        taskRepository.findMany({ where: { weddingId: id }, orderBy: { createdAt: 'desc' } }),
        activityLogRepository.findMany({ where: { weddingId: id } }),
        timelineMilestoneRepository.findMany({ where: { weddingId: id }, orderBy: { sortOrder: 'asc' } }),
        documentRepository.findMany({ where: { weddingId: id }, orderBy: { createdAt: 'desc' } }),
      ]);

    const eventIds = events.map((e) => e.id);
    const { data: vendorBookings } = await vendorBookingRepository.findMany({
      where: { weddingEventId: { in: eventIds } },
    });

    const vendorIds = [...new Set(vendorBookings.map((vb) => vb.vendorId))];
    // Deliberately not vendorRepository.findMany — that forces a
    // packages/faqs include this view doesn't need, and doesn't expose
    // category (a relation, not a string field on Vendor). A minimal direct
    // query is the lighter, correct fit here.
    const vendors = vendorIds.length
      ? await prisma.vendor.findMany({
          where: { id: { in: vendorIds } },
          select: { id: true, name: true, category: { select: { name: true } } },
        })
      : [];
    const vendorById = new Map(vendors.map((v) => [v.id, v]));

    const nameById = await resolveUserNames([
      wedding.coordinatorId,
      wedding.customerId,
      ...tasks.map((t) => t.assignedToId),
      ...activity.map((a) => a.performedById),
    ]);

    const eventsWithBookings: WeddingWorkspaceEvent[] = events.map((event) => ({
      id: event.id,
      type: event.type,
      label: event.label,
      date: event.date,
      startTime: event.startTime,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      city: event.city,
      budget: event.budget,
      vendorBookings: vendorBookings
        .filter((vb) => vb.weddingEventId === event.id)
        .map((vb) => {
          const vendor = vendorById.get(vb.vendorId);
          return {
            id: vb.id,
            vendorId: vb.vendorId,
            vendorName: vendor?.name ?? 'Unknown vendor',
            vendorCategory: vendor?.category.name ?? '',
            status: vb.status,
            agreedPrice: vb.agreedPrice,
            declineReason: vb.declineReason,
            respondedAt: vb.respondedAt,
            onTimeService: vb.onTimeService,
          };
        }),
    }));

    const health = computeWeddingHealth({
      status: wedding.status,
      tasks: tasks.map((t) => ({ status: t.status, dueAt: t.dueAt })),
      vendorBookings: vendorBookings.map((vb) => ({
        status: vb.status,
        eventDate: events.find((e) => e.id === vb.weddingEventId)?.date ?? wedding.primaryDate,
      })),
    });

    return {
      wedding: {
        ...wedding,
        coordinatorName: wedding.coordinatorId ? (nameById.get(wedding.coordinatorId) ?? null) : null,
        customerName: wedding.customerId ? (nameById.get(wedding.customerId) ?? null) : null,
      },
      health,
      couple: couple
        ? {
            brideName: couple.brideName,
            bridePhone: couple.bridePhone,
            groomName: couple.groomName,
            groomPhone: couple.groomPhone,
            preferredLanguage: couple.preferredLanguage,
            preferences: couple.preferences,
          }
        : null,
      events: eventsWithBookings,
      timeline,
      activity: activity.map((a) => ({
        ...a,
        performedByName: a.performedById ? (nameById.get(a.performedById) ?? null) : null,
      })),
      tasks: tasks.map((t) => ({
        ...t,
        assignedToName: t.assignedToId ? (nameById.get(t.assignedToId) ?? null) : null,
      })),
      documents,
      insights: [],
    };
  },

  async upsertCouple(
    weddingId: string,
    input: {
      brideName?: string;
      bridePhone?: string;
      groomName?: string;
      groomPhone?: string;
      preferredLanguage?: string;
      preferences?: string;
    }
  ) {
    await findWeddingOrThrow(weddingId);
    const existing = await coupleRepository.findByWeddingId(weddingId);
    if (existing) {
      return coupleRepository.update(weddingId, input);
    }
    return coupleRepository.create({ wedding: { connect: { id: weddingId } }, ...input });
  },

  async addNote(weddingId: string, { detail, performedById }: { detail: string; performedById: string | null }) {
    await findWeddingOrThrow(weddingId);
    return activityLogRepository.create({
      type: ActivityType.NOTE,
      summary: detail.length > 80 ? `${detail.slice(0, 77)}...` : detail,
      detail,
      performedBy: performedById ? { connect: { id: performedById } } : undefined,
      wedding: { connect: { id: weddingId } },
    });
  },

  async addTask(
    weddingId: string,
    input: {
      title: string;
      description?: string;
      dueAt?: Date;
      priority?: Task['priority'];
      assignedToId?: string;
      weddingEventId?: string;
      createdById: string | null;
    }
  ) {
    await findWeddingOrThrow(weddingId);
    return taskRepository.create({
      context: 'WEDDING_TASK',
      title: input.title,
      description: input.description,
      dueAt: input.dueAt,
      priority: input.priority,
      assignedTo: input.assignedToId ? { connect: { id: input.assignedToId } } : undefined,
      createdBy: input.createdById ? { connect: { id: input.createdById } } : undefined,
      wedding: { connect: { id: weddingId } },
      weddingEvent: input.weddingEventId ? { connect: { id: input.weddingEventId } } : undefined,
    });
  },

  async completeTask(weddingId: string, taskId: string, status: TaskStatus) {
    const task = await taskRepository.findById(taskId);
    if (!task || task.weddingId !== weddingId) throw new NotFoundError('Task', taskId);
    return taskRepository.update(taskId, { status, completedAt: status === 'DONE' ? new Date() : null });
  },

  async updateMilestone(weddingId: string, milestoneId: string, status: TimelineMilestone['status']) {
    const milestone = await timelineMilestoneRepository.findById(milestoneId);
    if (!milestone || milestone.weddingId !== weddingId) throw new NotFoundError('TimelineMilestone', milestoneId);
    return timelineMilestoneRepository.update(milestoneId, { status });
  },

  // domain-model.md §5.2 — the only route that can move a VendorBooking to
  // CONFIRMED, which is also the automatic PLANNING->ACTIVE trigger. No
  // vendor-facing self-service confirm flow exists yet (Vendor OS, a later
  // milestone), so this is Operations recording a real confirmation (phone
  // call, WhatsApp, etc.), not a placeholder.
  async updateVendorBookingStatus(weddingId: string, vendorBookingId: string, status: VendorBookingStatus, declineReason?: string) {
    const vendorBooking = await vendorBookingRepository.findById(vendorBookingId);
    if (!vendorBooking) throw new NotFoundError('VendorBooking', vendorBookingId);
    const event = await weddingEventRepository.findById(vendorBooking.weddingEventId);
    if (!event || event.weddingId !== weddingId) throw new NotFoundError('VendorBooking', vendorBookingId);

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await vendorBookingRepository.update(
        vendorBookingId,
        {
          status,
          declineReason: status === 'DECLINED' ? (declineReason ?? null) : null,
          respondedAt: new Date(),
        },
        tx
      );

      await activityLogRepository.create(
        {
          type: status === 'CONFIRMED' ? ActivityType.VENDOR_CONFIRMED : status === 'DECLINED' ? ActivityType.VENDOR_DECLINED : ActivityType.STATUS_CHANGED,
          summary: `Vendor booking ${status === 'CONFIRMED' ? 'confirmed' : status === 'DECLINED' ? 'declined' : `set to ${status}`}`,
          wedding: { connect: { id: weddingId } },
          vendorBooking: { connect: { id: vendorBookingId } },
        },
        tx
      );

      if (status === 'CONFIRMED') {
        await maybeActivateWedding(weddingId, tx);
      }

      return updated;
    });
  },

  async transitionStatus(weddingId: string, toStatus: WeddingStatus) {
    const wedding = await findWeddingOrThrow(weddingId);
    if (!canTransitionWedding(wedding.status, toStatus)) {
      throw new InvalidTransitionError(`Cannot move Wedding from ${wedding.status} to ${toStatus}`);
    }

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await weddingRepository.update(
        weddingId,
        { status: toStatus, completedAt: toStatus === 'COMPLETED' ? new Date() : undefined },
        tx
      );
      await activityLogRepository.create(
        {
          type: ActivityType.STATUS_CHANGED,
          summary: `Wedding status changed: ${wedding.status} → ${toStatus}`,
          wedding: { connect: { id: weddingId } },
        },
        tx
      );
      return updated;
    });
  },
};
