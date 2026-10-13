import { prisma } from '@/lib/prisma';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { effectiveScope } from '@/lib/ownership/scope';
import { can, type MemberRole } from '@/lib/auth/permissions';
import { checkNote, GENERAL_NOTE, memberLabel } from '@/lib/venue/myWork';
import { computeWeddingStage, STAGE_LABELS, type WeddingStage } from '@/lib/wedding/stage';
import { FUNCTION_TYPE_LABELS, type FunctionType } from '@/lib/wedding/functions';
import { loadAgreementMoney } from '@/services/agreement.service';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { validateFunctionForm, validateTaskForm, type FunctionErrors, type TaskErrors } from '@/lib/venue/weddingPlan';
import type { Prisma } from '@/generated/prisma/client';

// A business's OWN weddings (Vendor OS): the weddings its own confirmed bookings became (services/venueQuotation.service.ts →
// the existing Booking → Wedding conversion): who, when, which functions, what was agreed, what is still to do and — for someone who
// may see money — what was received. Always called inside the business's scope (lib/ownership/venueEntry.ts): the database guard
// limits every read and write to that business, so another business's wedding is "not found". Shaadi Shopping's weddings that a
// vendor is booked on are a different list (services/venuePortal.service.ts).
//
// The business plans its own wedding here: each function's day, time and place, and a to-do list. A thin adapter — every rule is
// the existing wedding service's, unchanged (services/weddingWorkspace.service.ts): an "Other" function needs a name, the wedding's
// date follows its "Wedding" function, only an empty function can be removed, a finished or cancelled wedding is not changed.
// The quotation and the payments are never touched from here.
//
// Giving out work (13 Oct 2026): a to-do can be given to someone who works in the business. Only the owner or someone with the
// `tasks` permission gives work out, and only to a current member of THIS business — the member is looked up here by the
// business in the scope (BusinessMember is not an owned table), never taken on trust. The person sees it in "Your work"
// (services/venueMyWork.service.ts).

const istDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);

export interface VenueWeddingListItem {
  id: string;
  number: string;
  customerName: string;
  date: string; // YYYY-MM-DD (IST)
  guestCount: number | null;
  stage: WeddingStage;
  stageLabel: string;
  daysToGo: number | null;
  functions: string[]; // "Haldi", "Wedding" … in date order
}

export interface VenueWeddingDetail extends VenueWeddingListItem {
  customerPhone: string | null;
  city: string;
  enquiryId: string | null; // the enquiry it came from — its quotation and payments live there
  quotationNumber: string | null;
  needsClosing: boolean; // the last day has passed and it is not marked completed
  functionList: { id: string; type: FunctionType; name: string; date: string; startTime: string | null; place: string | null }[];
  // This member may change the functions and the to-do list: they may work on weddings, and the wedding is not finished or cancelled.
  canEdit: boolean;
  // What was agreed: the accepted quotation's lines, as they were accepted.
  agreed: { description: string; quantity: number; unitPrice: number; lineTotal: number; function: string | null }[];
  // How the lines add up to the agreed total: the discount taken off and the GST added (each 0 when there is none). null = no quotation.
  agreedTotals: { discount: number; gst: number; total: number } | null;
  // dueOn = YYYY-MM-DD (IST). assignee = who it was given to (their login's id and how the business names them), or null.
  tasks: { id: string; title: string; done: boolean; dueAt: string | null; dueOn: string | null; assignee: { id: string; name: string } | null }[];
  // This member may give the to-dos out (the `tasks` permission) — and to whom: the people working in the business today.
  canAssign: boolean;
  // `mobile` and `firstName` are for the ready WhatsApp message "work for you" (lib/venue/myWork.ts) — sent only to someone who
  // may give out work (approved 13 Oct 2026); null when the person has none on file. `isYou` = the member asking.
  team: { id: string; name: string; mobile: string | null; firstName: string | null; isYou: boolean }[];
  businessName: string; // who that message is from; '' unless canAssign
  // Notes from the team, newest first (lib/venue/myWork.ts): who wrote it, when, what it is about ("Note on “Confirm the
  // generator”", or just "Note") and the words. Kept as history — never edited or removed.
  notes: { id: string; by: string; at: string; about: string; text: string }[];
  // null = this member may not see money (lib/auth/permissions.ts: view_financials), or there is no agreement.
  money: { total: number; received: number; outstanding: number } | null;
  moneyHidden: boolean;
}

export interface VenueWeddingDeps {
  db: {
    wedding: Pick<typeof prisma.wedding, 'findMany' | 'findUnique'>;
    task: Pick<typeof prisma.task, 'findMany' | 'updateMany'>;
    activityLog: Pick<typeof prisma.activityLog, 'findMany' | 'create'>;
    businessMember: Pick<typeof prisma.businessMember, 'findMany'>;
    quotation: Pick<typeof prisma.quotation, 'findUnique'>;
  };
  money: typeof loadAgreementMoney;
  // The existing wedding service, unchanged. Inside the business's scope it only finds that business's weddings.
  workspace: Pick<typeof weddingWorkspaceService, 'addFunction' | 'updateFunction' | 'deleteFunction' | 'addTask' | 'updateTask'>;
  now: () => Date;
}

const defaultDeps = (): VenueWeddingDeps => ({ db: prisma, money: loadAgreementMoney, workspace: weddingWorkspaceService, now: () => new Date() });

export type FunctionResult = VenueWeddingDetail | { errors: FunctionErrors };
export type TaskResult = VenueWeddingDetail | { errors: TaskErrors };

const LIST_SELECT = {
  id: true,
  weddingNumber: true,
  status: true,
  primaryDate: true,
  city: true,
  guestCount: true,
  customerPhone: true,
  sourceBooking: { select: { name: true, phone: true, consultationId: true, quotationId: true } },
  events: { select: { id: true, type: true, label: true, date: true, startTime: true, venueName: true }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] },
} satisfies Prisma.WeddingSelect;
type Row = Prisma.WeddingGetPayload<{ select: typeof LIST_SELECT }>;

const functionName = (e: { type: string; label: string | null }) => e.label?.trim() || FUNCTION_TYPE_LABELS[e.type as FunctionType] || 'Function';

export function createVenueWeddingService(deps: VenueWeddingDeps = defaultDeps()) {
  function listItem(w: Row): VenueWeddingListItem & { needsClosing: boolean } {
    const info = computeWeddingStage({ status: w.status, primaryDate: w.primaryDate, functionDates: w.events.map((e) => e.date), now: deps.now() });
    return {
      id: w.id,
      number: w.weddingNumber,
      customerName: w.sourceBooking?.name ?? 'Customer',
      date: istDay(w.primaryDate),
      guestCount: w.guestCount,
      stage: info.stage,
      stageLabel: STAGE_LABELS[info.stage],
      daysToGo: info.daysToGo,
      functions: w.events.map(functionName),
      needsClosing: info.needsClosing,
    };
  }

  // The people of the business in the scope, by their login's id. `ids` = only these (whoever a to-do was given to, even if they
  // have left since); without it, everyone working there today.
  // Their mobile number is read too, but only `team()` below ever passes it on.
  async function members(ids?: string[]) {
    const scope = effectiveScope();
    if (scope.kind !== 'BUSINESS' || (ids && ids.length === 0)) return [];
    const rows = await deps.db.businessMember.findMany({
      where: { businessId: scope.businessId, ...(ids ? { userId: { in: ids } } : { removedAt: null }) },
      select: { userId: true, role: true, jobTitle: true, user: { select: { name: true, phone: true } }, business: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => ({
      id: m.userId,
      name: memberLabel({ name: m.user.name, role: m.role as MemberRole, jobTitle: m.jobTitle }),
      mobile: m.user.phone?.replace(/\D/g, '').slice(-10) || null,
      firstName: m.user.name?.trim().split(/\s+/)[0] || null,
      isYou: m.userId === scope.userId,
      businessName: m.business.name,
    }));
  }
  // Names only — what anyone who sees the to-do list may know.
  const people = async (ids?: string[]): Promise<{ id: string; name: string }[]> => (await members(ids)).map(({ id, name }) => ({ id, name }));

  // Who a to-do is being given to: null = nobody. Refused unless the asker may give out work and the person works here today.
  async function assignee(raw: unknown): Promise<{ ok: true; userId: string | null } | { ok: false; error: string }> {
    const userId = typeof raw === 'string' ? raw.trim() : '';
    if (!can(effectiveScope(), 'tasks')) return { ok: false, error: 'Only the owner or someone who manages the team’s work can give a to-do to a person' };
    if (!userId) return { ok: true, userId: null };
    return (await people()).some((p) => p.id === userId) ? { ok: true, userId } : { ok: false, error: 'Choose someone who works in your business' };
  }

  return {
    // Upcoming first (nearest date on top), then the ones already over.
    async list(): Promise<VenueWeddingListItem[]> {
      const rows = await deps.db.wedding.findMany({ select: LIST_SELECT, orderBy: { primaryDate: 'asc' }, take: 200 });
      const items = rows.map((w) => {
        const { needsClosing: _needsClosing, ...item } = listItem(w);
        return item;
      });
      const over = (i: VenueWeddingListItem) => i.stage === 'COMPLETED' || i.stage === 'CANCELLED';
      return [...items.filter((i) => !over(i)), ...items.filter(over).reverse()];
    },

    async get(id: string): Promise<VenueWeddingDetail> {
      const w = await deps.db.wedding.findUnique({ where: { id }, select: LIST_SELECT });
      if (!w) throw new NotFoundError('Wedding', id);
      const quotationId = w.sourceBooking?.quotationId ?? null;
      const [tasks, noteRows, quotation] = await Promise.all([
        deps.db.task.findMany({ where: { weddingId: id, status: { not: 'CANCELLED' } }, select: { id: true, title: true, status: true, dueAt: true, assignedToId: true }, orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }], take: 100 }),
        deps.db.activityLog.findMany({ where: { weddingId: id, type: 'NOTE' }, select: { id: true, summary: true, detail: true, performedById: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
        quotationId
          ? deps.db.quotation.findUnique({ where: { id: quotationId }, select: { quotationNumber: true, discount: true, gstAmount: true, total: true, items: { select: { description: true, quantity: true, unitPrice: true, functionLabel: true }, orderBy: { sortOrder: 'asc' } } } })
          : null,
      ]);
      const seesMoney = can(effectiveScope(), 'view_financials');
      const canEdit = w.status !== 'COMPLETED' && w.status !== 'CANCELLED' && can(effectiveScope(), 'weddings');
      const canAssign = canEdit && can(effectiveScope(), 'tasks');
      const given = new Map((await people([...new Set([...tasks.map((t) => t.assignedToId), ...noteRows.map((n) => n.performedById)].flatMap((x) => (x ? [x] : [])))])).map((p) => [p.id, p]));
      const agreement = quotationId && seesMoney ? await deps.money(quotationId, deps.now()) : null;
      const team = canAssign ? await members() : [];
      return {
        ...listItem(w),
        customerPhone: w.sourceBooking?.phone ?? w.customerPhone ?? null,
        city: w.city,
        enquiryId: w.sourceBooking?.consultationId ?? null,
        quotationNumber: quotation?.quotationNumber ?? null,
        functionList: w.events.map((e) => ({ id: e.id, type: e.type as FunctionType, name: functionName(e), date: istDay(e.date), startTime: e.startTime, place: e.venueName?.trim() || null })),
        canEdit,
        canAssign,
        team: team.map(({ businessName: _b, ...p }) => p),
        businessName: team[0]?.businessName ?? '',
        notes: noteRows.map((n) => ({ id: n.id, by: (n.performedById && given.get(n.performedById)?.name) || 'Someone no longer in the team', at: n.createdAt.toISOString(), about: n.summary, text: n.detail ?? '' })),
        agreed: (quotation?.items ?? []).map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.unitPrice * i.quantity, function: i.functionLabel?.trim() || null })),
        agreedTotals: quotation ? { discount: quotation.discount, gst: quotation.gstAmount, total: quotation.total } : null,
        tasks: tasks.map((t) => ({ id: t.id, title: t.title, done: t.status === 'DONE', dueAt: t.dueAt?.toISOString() ?? null, dueOn: t.dueAt ? istDay(t.dueAt) : null, assignee: t.assignedToId ? (given.get(t.assignedToId) ?? { id: t.assignedToId, name: 'Someone no longer in the team' }) : null })),
        money: agreement?.exists ? { total: agreement.agreementTotal, received: agreement.received, outstanding: agreement.outstanding } : null,
        moneyHidden: !!quotationId && !seesMoney,
      };
    },

    // "Add a function" — Mehndi, Sangeet, Reception … on its own day. The city is the wedding's.
    async addFunction(id: string, input: Record<string, unknown>, actorId: string | null): Promise<FunctionResult> {
      const checked = validateFunctionForm(input);
      if (!checked.ok) return { errors: checked.errors };
      await deps.workspace.addFunction(id, checked.value, actorId);
      return this.get(id);
    },

    // The whole form is saved: which function, its day, time and place. Moving the "Wedding" function moves the wedding's date.
    async updateFunction(id: string, functionId: string, input: Record<string, unknown>, actorId: string | null): Promise<FunctionResult> {
      const checked = validateFunctionForm(input);
      if (!checked.ok) return { errors: checked.errors };
      await deps.workspace.updateFunction(id, functionId, checked.value, actorId);
      return this.get(id);
    },

    // Only an empty function can be removed, and never the last one — the existing rule says why not.
    async removeFunction(id: string, functionId: string, actorId: string | null): Promise<VenueWeddingDetail> {
      await deps.workspace.deleteFunction(id, functionId, actorId);
      return this.get(id);
    },

    async addTask(id: string, input: Record<string, unknown>, actorId: string | null): Promise<TaskResult> {
      const checked = validateTaskForm(input);
      if (!checked.ok) return { errors: checked.errors };
      // Given to someone at once (`assignTo`) — optional; left out or empty = nobody yet.
      const who = typeof input.assignTo === 'string' && input.assignTo.trim() ? await assignee(input.assignTo) : null;
      if (who && !who.ok) return { errors: { assignTo: who.error } };
      await deps.workspace.addTask(id, { title: checked.value.title, dueAt: checked.value.dueAt ?? undefined, assignedToId: who?.userId ?? undefined, createdById: actorId });
      return this.get(id);
    },

    // A note about the wedding itself, from someone who may work on its weddings (the route asks for that). Into the wedding's
    // history under their name; a finished wedding still takes notes.
    async addNote(id: string, raw: unknown, actorId: string | null): Promise<VenueWeddingDetail | { errors: { note: string } }> {
      await this.get(id); // another business's wedding is "not found" before anything is written
      const checked = checkNote(raw);
      if (!checked.ok) return { errors: { note: checked.error } };
      await deps.db.activityLog.create({ data: { type: 'NOTE', summary: GENERAL_NOTE, detail: checked.text, ...(actorId ? { performedBy: { connect: { id: actorId } } } : {}), wedding: { connect: { id } } } });
      return this.get(id);
    },

    // Give a to-do to someone who works in the business, to someone else, or to nobody (`assignTo` empty).
    async assignTask(id: string, taskId: string, assignTo: unknown): Promise<VenueWeddingDetail> {
      const w = await this.get(id); // another business's wedding is "not found" before anything is changed
      if (!w.canEdit) throw new ValidationError('This wedding is finished — its to-do list can no longer be changed');
      const who = await assignee(assignTo);
      if (!who.ok) throw new ValidationError(who.error);
      const { count } = await deps.db.task.updateMany({ where: { id: taskId, weddingId: id, status: { not: 'CANCELLED' } }, data: { assignedToId: who.userId } });
      if (count === 0) throw new NotFoundError('Task', taskId);
      return this.get(id);
    },

    // Tick a to-do done, untick it, or take it off the list (kept as cancelled, never deleted).
    async setTask(id: string, taskId: string, change: { done?: unknown; remove?: unknown }): Promise<VenueWeddingDetail> {
      await this.get(id); // another business's wedding is "not found" before anything is changed
      await deps.workspace.updateTask(id, taskId, { status: change.remove === true ? 'CANCELLED' : change.done === true ? 'DONE' : 'PENDING' });
      return this.get(id);
    },
  };
}

export const venueWeddingService = createVenueWeddingService();
