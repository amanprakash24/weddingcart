import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';
import { effectiveScope } from '@/lib/ownership/scope';
import { can } from '@/lib/auth/permissions';
import { FUNCTION_TYPE_LABELS, type FunctionType } from '@/lib/wedding/functions';
import { isOverdue, sortMyWork, type MyWork } from '@/lib/venue/myWork';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';

// "Your work" on Today (lib/venue/myWork.ts): the to-dos on this business's own weddings that were given to the signed-in person,
// and that person ticking their own. Always called inside the business's scope (lib/ownership/venueEntry.ts): tasks belong to
// weddings, weddings are owned records, so the database guard shows this business's only — work given to the same person in
// another business they work in is not here. Open to every member: it is theirs, and it carries no phone number and no money.

const istDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
// Finished long ago is not "your work" any more.
const DONE_KEPT_DAYS = 7;

export interface VenueMyWorkDeps {
  db: { task: Pick<typeof prisma.task, 'findMany' | 'findFirst'> };
  // The existing wedding service, unchanged: marks a task done or not (and when).
  workspace: Pick<typeof weddingWorkspaceService, 'updateTask'>;
  now: () => Date;
}

const defaultDeps = (): VenueMyWorkDeps => ({ db: prisma, workspace: weddingWorkspaceService, now: () => new Date() });

export function createVenueMyWorkService(deps: VenueMyWorkDeps = defaultDeps()) {
  function me() {
    const s = effectiveScope();
    if (s.kind !== 'BUSINESS' || !s.userId) throw new NotFoundError('Work', 'current');
    return { userId: s.userId, canOpenWeddings: can(s, 'weddings') };
  }

  return {
    async list(): Promise<MyWork> {
      const { userId, canOpenWeddings } = me();
      const now = deps.now();
      const rows = await deps.db.task.findMany({
        where: {
          assignedToId: userId,
          context: 'WEDDING_TASK',
          weddingId: { not: null },
          OR: [{ status: { in: ['PENDING', 'IN_PROGRESS'] } }, { status: 'DONE', completedAt: { gte: new Date(now.getTime() - DONE_KEPT_DAYS * 86_400_000) } }],
        },
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          wedding: {
            select: {
              id: true,
              weddingNumber: true,
              primaryDate: true,
              sourceBooking: { select: { name: true } },
              events: { select: { type: true, label: true, date: true, startTime: true, venueName: true }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] },
            },
          },
        },
        take: 100,
      });
      const today = istDay(now);
      const items = sortMyWork(
        rows.flatMap((t) => {
          if (!t.wedding) return [];
          const done = t.status === 'DONE';
          const dueOn = t.dueAt ? istDay(t.dueAt) : null;
          return [
            {
              id: t.id,
              title: t.title,
              done,
              dueOn,
              overdue: isOverdue(dueOn, done, today),
              wedding: {
                id: t.wedding.id,
                name: t.wedding.sourceBooking?.name ?? t.wedding.weddingNumber,
                date: istDay(t.wedding.primaryDate),
                functions: t.wedding.events.map((e) => ({ name: e.label?.trim() || FUNCTION_TYPE_LABELS[e.type as FunctionType] || 'Function', date: istDay(e.date), startTime: e.startTime, place: e.venueName?.trim() || null })),
              },
            },
          ];
        })
      );
      return { items, open: items.filter((i) => !i.done).length, canOpenWeddings };
    },

    // The person it was given to ticks it done, or unticks it. Anyone else's, another business's, or one taken off the list is
    // "not found". Nothing else about the to-do can be changed from here.
    async setDone(taskId: string, done: unknown): Promise<MyWork> {
      const { userId } = me();
      const task = await deps.db.task.findFirst({ where: { id: taskId, assignedToId: userId, context: 'WEDDING_TASK', status: { not: 'CANCELLED' } }, select: { id: true, weddingId: true } });
      if (!task?.weddingId) throw new NotFoundError('Task', taskId);
      await deps.workspace.updateTask(task.weddingId, task.id, { status: done === true ? 'DONE' : 'PENDING' });
      return this.list();
    },
  };
}

export const venueMyWorkService = createVenueMyWorkService();
