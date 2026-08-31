import { prisma } from '@/lib/prisma';
import { ActivityType, ApprovalStatus, ApprovalSubjectType } from '@/generated/prisma/client';
import { NotFoundError } from '@/lib/errors';

export interface ApprovalInput {
  subjectType: ApprovalSubjectType;
  weddingEventId?: string;
  title: string;
  description?: string;
  amount?: number;
  deadline?: Date;
  subjectId?: string;
}

function activityType(status: ApprovalStatus): ActivityType {
  if (status === ApprovalStatus.APPROVED) return ActivityType.APPROVAL_APPROVED;
  if (status === ApprovalStatus.CHANGES_REQUESTED) return ActivityType.APPROVAL_CHANGES_REQUESTED;
  if (status === ApprovalStatus.CANCELLED) return ActivityType.APPROVAL_CANCELLED;
  return ActivityType.APPROVAL_REQUESTED;
}

export const approvalService = {
  async listForWedding(weddingId: string) {
    return prisma.approvalRequest.findMany({
      where: { weddingId },
      orderBy: { createdAt: 'desc' },
      include: { weddingEvent: { select: { id: true, label: true, type: true } } },
    });
  },

  async listForClient(userId: string) {
    return prisma.approvalRequest.findMany({
      where: { wedding: { customerId: userId }, status: { not: ApprovalStatus.DRAFT } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { weddingEvent: { select: { id: true, label: true, type: true } } },
    });
  },

  async create(weddingId: string, input: ApprovalInput, actorId: string) {
    const wedding = await prisma.wedding.findUnique({
      where: { id: weddingId },
      select: { id: true, customerId: true, coordinatorId: true },
    });
    if (!wedding) throw new NotFoundError('Wedding', weddingId);

    if (input.weddingEventId) {
      const event = await prisma.weddingEvent.findFirst({ where: { id: input.weddingEventId, weddingId }, select: { id: true } });
      if (!event) throw new NotFoundError('WeddingEvent', input.weddingEventId);
    }

    return prisma.$transaction(async (tx) => {
      const approval = await tx.approvalRequest.create({
        data: {
          subjectType: input.subjectType,
          subjectId: input.subjectId ?? input.weddingEventId ?? weddingId,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          amount: input.amount ?? null,
          deadline: input.deadline ?? null,
          weddingId,
          weddingEventId: input.weddingEventId ?? null,
          requestedById: actorId,
          status: ApprovalStatus.PENDING_CLIENT,
        },
        include: { weddingEvent: { select: { id: true, label: true, type: true } } },
      });
      await tx.activityLog.create({
        data: {
          type: ActivityType.APPROVAL_REQUESTED,
          summary: `Approval requested: ${approval.title}`,
          weddingId,
          performedById: actorId,
        },
      });
      if (wedding.customerId) {
        await tx.notification.create({
          data: {
            userId: wedding.customerId,
            channel: 'IN_APP',
            title: 'Approval needed',
            body: approval.title ?? 'Approval request',
            weddingId,
          },
        });
      }
      return approval;
    });
  },

  async decideForClient(
    approvalId: string,
    userId: string,
    decision: 'APPROVED' | 'CHANGES_REQUESTED',
    clientComment?: string
  ) {
    const approval = await prisma.approvalRequest.findFirst({
      where: { id: approvalId, wedding: { customerId: userId } },
      select: { id: true, title: true, weddingId: true, status: true, deadline: true, wedding: { select: { coordinatorId: true } } },
    });
    if (!approval || !approval.weddingId) throw new NotFoundError('ApprovalRequest', approvalId);
    if (approval.status !== ApprovalStatus.PENDING_CLIENT && approval.status !== ApprovalStatus.CHANGES_REQUESTED) {
      throw new Error('This approval is no longer awaiting a client decision');
    }
    if (approval.deadline && approval.deadline < new Date()) {
      throw new Error('This approval deadline has passed');
    }
    if (decision === 'CHANGES_REQUESTED' && !clientComment?.trim()) {
      throw new Error('A comment is required when requesting changes');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.approvalRequest.update({
        where: { id: approval.id },
        data: {
          status: decision,
          clientComment: decision === 'CHANGES_REQUESTED' ? clientComment!.trim() : null,
          approvedAt: decision === 'APPROVED' ? new Date() : null,
          approvedById: decision === 'APPROVED' ? userId : null,
        },
        include: { weddingEvent: { select: { id: true, label: true, type: true } } },
      });
      await tx.activityLog.create({
        data: {
          type: activityType(updated.status),
          summary: decision === 'APPROVED' ? `Approval approved: ${approval.title ?? 'Approval request'}` : `Changes requested: ${approval.title ?? 'Approval request'}`,
          detail: decision === 'CHANGES_REQUESTED' ? updated.clientComment : undefined,
          weddingId: approval.weddingId,
          performedById: userId,
        },
      });
      if (approval.wedding?.coordinatorId) {
        await tx.notification.create({
          data: {
            userId: approval.wedding.coordinatorId,
            channel: 'IN_APP',
            title: decision === 'APPROVED' ? 'Approval approved' : 'Changes requested',
            body: approval.title ?? 'Approval request',
            weddingId: approval.weddingId,
          },
        });
      }
      return updated;
    });
  },

  async cancel(approvalId: string, weddingId: string, actorId: string) {
    const approval = await prisma.approvalRequest.findFirst({ where: { id: approvalId, weddingId } });
    if (!approval) throw new NotFoundError('ApprovalRequest', approvalId);
    if (approval.status === ApprovalStatus.APPROVED) throw new Error('An approved request cannot be cancelled');
    return prisma.$transaction(async (tx) => {
      const updated = await tx.approvalRequest.update({ where: { id: approvalId }, data: { status: ApprovalStatus.CANCELLED } });
      await tx.activityLog.create({
        data: { type: ActivityType.APPROVAL_CANCELLED, summary: `Approval cancelled: ${approval.title}`, weddingId, performedById: actorId },
      });
      return updated;
    });
  },
};
