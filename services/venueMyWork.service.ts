import { prisma } from '@/lib/prisma';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { effectiveScope } from '@/lib/ownership/scope';
import { can } from '@/lib/auth/permissions';
import { FUNCTION_TYPE_LABELS, type FunctionType } from '@/lib/wedding/functions';
import { checkNote, isOverdue, noteAbout, sortMyWork, type MyWork, type MyWorkItem } from '@/lib/venue/myWork';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';

// "Your work" on Today (lib/venue/myWork.ts): the work in this business that was given to the signed-in person — to-dos on its
// own weddings and follow-ups on its own enquiries — and that person ticking their own. Always called inside the business's scope
// (lib/ownership/venueEntry.ts): tasks belong to weddings and enquiries, which are owned records, so the database guard shows this
// business's only — work given to the same person in another business they work in is not here. Open to every member: it is
// theirs. A to-do carries no phone number and no money; a follow-up carries the couple's name and is only ever given to someone
// who may open enquiries (services/venueEnquiry.service.ts).

const istDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
// Finished long ago is not "your work" any more.
const DONE_KEPT_DAYS = 7;
const KINDS = ['WEDDING_TASK', 'SALES_FOLLOWUP'] as const;

export interface VenueMyWorkDeps {
  db: { task: Pick<typeof prisma.task, 'findMany' | 'findFirst' | 'updateMany'>; activityLog: Pick<typeof prisma.activityLog, 'findMany' | 'create'> };
  // The existing wedding service, unchanged: marks a wedding's task done or not (and when).
  workspace: Pick<typeof weddingWorkspaceService, 'updateTask'>;
  now: () => Date;
}

const defaultDeps = (): VenueMyWorkDeps => ({ db: prisma, workspace: weddingWorkspaceService, now: () => new Date() });

export function createVenueMyWorkService(deps: VenueMyWorkDeps = defaultDeps()) {
  function me() {
    const s = effectiveScope();
    if (s.kind !== 'BUSINESS' || !s.userId) throw new NotFoundError('Work', 'current');
    return { userId: s.userId, canOpenWeddings: can(s, 'weddings'), canOpenEnquiries: can(s, 'enquiries') };
  }

  return {
    async list(): Promise<MyWork> {
      const { userId, canOpenWeddings, canOpenEnquiries } = me();
      const now = deps.now();
      const rows = await deps.db.task.findMany({
        where: {
          assignedToId: userId,
          context: { in: [...KINDS] },
          OR: [{ status: { in: ['PENDING', 'IN_PROGRESS'] } }, { status: 'DONE', completedAt: { gte: new Date(now.getTime() - DONE_KEPT_DAYS * 86_400_000) } }],
        },
        select: {
          id: true,
          context: true,
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
          consultation: { select: { id: true, name: true, weddingDate: true } },
        },
        take: 100,
      });
      // Their own notes on the wedding to-dos (a note names its to-do in its heading — lib/venue/myWork.ts).
      const weddingIds = [...new Set(rows.flatMap((t) => (t.wedding ? [t.wedding.id] : [])))];
      const mine = weddingIds.length
        ? await deps.db.activityLog.findMany({ where: { type: 'NOTE', performedById: userId, weddingId: { in: weddingIds } }, select: { id: true, summary: true, detail: true, weddingId: true, createdAt: true }, orderBy: { createdAt: 'asc' }, take: 300 })
        : [];
      const today = istDay(now);
      const items = sortMyWork(
        rows.flatMap((t): MyWorkItem[] => {
          const done = t.status === 'DONE';
          const dueOn = t.dueAt ? istDay(t.dueAt) : null;
          const base = { id: t.id, title: t.title, done, dueOn, overdue: isOverdue(dueOn, done, today) };
          if (t.context === 'WEDDING_TASK' && t.wedding) {
            const w = t.wedding;
            return [
              {
                ...base,
                kind: 'TODO',
                wedding: {
                  id: w.id,
                  name: w.sourceBooking?.name ?? w.weddingNumber,
                  date: istDay(w.primaryDate),
                  functions: w.events.map((e) => ({ name: e.label?.trim() || FUNCTION_TYPE_LABELS[e.type as FunctionType] || 'Function', date: istDay(e.date), startTime: e.startTime, place: e.venueName?.trim() || null })),
                },
                enquiry: null,
                notes: mine.filter((n) => n.weddingId === w.id && n.summary === noteAbout(t.title)).map((n) => ({ id: n.id, text: n.detail ?? '', at: n.createdAt.toISOString() })),
              },
            ];
          }
          if (t.context === 'SALES_FOLLOWUP' && t.consultation) {
            return [{ ...base, kind: 'FOLLOW_UP', wedding: null, enquiry: { id: t.consultation.id, name: t.consultation.name, weddingDate: t.consultation.weddingDate || null }, notes: [] }];
          }
          return [];
        })
      );
      return { items, open: items.filter((i) => !i.done).length, canOpenWeddings, canOpenEnquiries };
    },

    // The person it was given to ticks it done, or unticks it. Anyone else's, another business's, or one taken off the list is
    // "not found". Nothing else about the work can be changed from here.
    async setDone(taskId: string, done: unknown): Promise<MyWork> {
      const { userId } = me();
      const task = await deps.db.task.findFirst({ where: { id: taskId, assignedToId: userId, context: { in: [...KINDS] }, status: { not: 'CANCELLED' } }, select: { id: true, context: true, weddingId: true, consultationId: true } });
      if (!task) throw new NotFoundError('Task', taskId);
      if (task.context === 'WEDDING_TASK' && task.weddingId) await deps.workspace.updateTask(task.weddingId, task.id, { status: done === true ? 'DONE' : 'PENDING' });
      else if (task.context === 'SALES_FOLLOWUP' && task.consultationId) {
        // The same change the enquiry's own "Done" makes (venueEnquiryService.completeFollowUp), and its undo.
        await deps.db.task.updateMany({ where: { id: task.id, consultationId: task.consultationId }, data: done === true ? { status: 'DONE', completedAt: deps.now() } : { status: 'PENDING', completedAt: null } });
      } else throw new NotFoundError('Task', taskId);
      return this.list();
    },

    // The person a wedding's to-do was given to writes a note about it. It goes into the wedding's history under their name, and
    // whoever manages that wedding reads it on the wedding's page. Anyone else's to-do is "not found". (A follow-up has no note
    // here: the enquiry has its own log, which the person can open.)
    async addNote(taskId: string, raw: unknown): Promise<MyWork> {
      const { userId } = me();
      const checked = checkNote(raw);
      if (!checked.ok) throw new ValidationError(checked.error);
      const task = await deps.db.task.findFirst({ where: { id: taskId, assignedToId: userId, context: 'WEDDING_TASK', status: { not: 'CANCELLED' } }, select: { title: true, weddingId: true } });
      if (!task?.weddingId) throw new NotFoundError('Task', taskId);
      await deps.db.activityLog.create({ data: { type: 'NOTE', summary: noteAbout(task.title), detail: checked.text, performedBy: { connect: { id: userId } }, wedding: { connect: { id: task.weddingId } } } });
      return this.list();
    },
  };
}

export const venueMyWorkService = createVenueMyWorkService();
