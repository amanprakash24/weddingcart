import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';
import { effectiveScope } from '@/lib/ownership/scope';
import { can } from '@/lib/auth/permissions';
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
  tasks: { id: string; title: string; done: boolean; dueAt: string | null; dueOn: string | null }[]; // dueOn = YYYY-MM-DD (IST)
  // null = this member may not see money (lib/auth/permissions.ts: view_financials), or there is no agreement.
  money: { total: number; received: number; outstanding: number } | null;
  moneyHidden: boolean;
}

export interface VenueWeddingDeps {
  db: {
    wedding: Pick<typeof prisma.wedding, 'findMany' | 'findUnique'>;
    task: Pick<typeof prisma.task, 'findMany'>;
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
      const [tasks, quotation] = await Promise.all([
        deps.db.task.findMany({ where: { weddingId: id, status: { not: 'CANCELLED' } }, select: { id: true, title: true, status: true, dueAt: true }, orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }], take: 100 }),
        quotationId
          ? deps.db.quotation.findUnique({ where: { id: quotationId }, select: { quotationNumber: true, discount: true, gstAmount: true, total: true, items: { select: { description: true, quantity: true, unitPrice: true, functionLabel: true }, orderBy: { sortOrder: 'asc' } } } })
          : null,
      ]);
      const seesMoney = can(effectiveScope(), 'view_financials');
      const agreement = quotationId && seesMoney ? await deps.money(quotationId, deps.now()) : null;
      return {
        ...listItem(w),
        customerPhone: w.sourceBooking?.phone ?? w.customerPhone ?? null,
        city: w.city,
        enquiryId: w.sourceBooking?.consultationId ?? null,
        quotationNumber: quotation?.quotationNumber ?? null,
        functionList: w.events.map((e) => ({ id: e.id, type: e.type as FunctionType, name: functionName(e), date: istDay(e.date), startTime: e.startTime, place: e.venueName?.trim() || null })),
        canEdit: w.status !== 'COMPLETED' && w.status !== 'CANCELLED' && can(effectiveScope(), 'weddings'),
        agreed: (quotation?.items ?? []).map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.unitPrice * i.quantity, function: i.functionLabel?.trim() || null })),
        agreedTotals: quotation ? { discount: quotation.discount, gst: quotation.gstAmount, total: quotation.total } : null,
        tasks: tasks.map((t) => ({ id: t.id, title: t.title, done: t.status === 'DONE', dueAt: t.dueAt?.toISOString() ?? null, dueOn: t.dueAt ? istDay(t.dueAt) : null })),
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
      await deps.workspace.addTask(id, { title: checked.value.title, dueAt: checked.value.dueAt ?? undefined, createdById: actorId });
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
