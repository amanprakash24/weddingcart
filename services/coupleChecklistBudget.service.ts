import { ActivityType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { checkChecklistItem, checklistSeed, redatedDue, type ChecklistItemInput } from '@/lib/wedding/checklist';
import { categoryLabel, checkExpense, checkPlanned, checkTotal, type ExpenseInput } from '@/lib/wedding/coupleBudget';

// The couple's checklist and budget (25 Nov 2026, Client OS). Couple calls run inside asCoupleWedding (the wedding is theirs or their
// family's; 'plan' for the checklist, 'money' for the budget). Staff read both, never change them. Nothing here touches our
// quotation, invoices, payments, tasks or vendor bookings.

const indiaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export interface ChecklistItemView {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  weddingEventId: string | null;
  ready: boolean; // from the ready-made list
  done: boolean;
  doneAt: string | null;
}

async function weddingDay(weddingId: string) {
  const w = await prisma.wedding.findUnique({ where: { id: weddingId }, select: { primaryDate: true, status: true, events: { select: { type: true } } } });
  if (!w) throw new NotFoundError('Wedding', weddingId);
  return w;
}

async function openForChanges(weddingId: string) {
  const w = await weddingDay(weddingId);
  if (w.status === 'CANCELLED') throw new ValidationError('This wedding was cancelled');
  return w;
}

async function itemOf(weddingId: string, id: string) {
  const item = await prisma.coupleChecklistItem.findFirst({ where: { id, weddingId } });
  if (!item) throw new NotFoundError('CoupleChecklistItem', id);
  return item;
}

async function checkFunction(weddingId: string, eventId: string | null) {
  if (!eventId) return null;
  const e = await prisma.weddingEvent.findFirst({ where: { id: eventId, weddingId }, select: { id: true } });
  if (!e) throw new ValidationError('Choose one of your functions');
  return e.id;
}

const view = (i: { id: string; title: string; notes: string | null; dueDate: Date | null; weddingEventId: string | null; templateKey: string | null; done: boolean; doneAt: Date | null }): ChecklistItemView => ({
  id: i.id,
  title: i.title,
  notes: i.notes,
  dueDate: ymd(i.dueDate),
  weddingEventId: i.weddingEventId,
  ready: !!i.templateKey,
  done: i.done,
  doneAt: i.doneAt?.toISOString() ?? null,
});

async function log(weddingId: string, summary: string, actorId: string | null) {
  await prisma.activityLog.create({ data: { type: ActivityType.NOTE, summary, weddingId, performedById: actorId } });
}

export const coupleChecklistService = {
  // The list. The ready-made items this wedding needs are added the first time (and when a function is added later, its items);
  // one the couple removed stays removed (hidden, never added again).
  async list(weddingId: string): Promise<ChecklistItemView[]> {
    const w = await weddingDay(weddingId);
    const day = ymd(w.primaryDate)!;
    const today = indiaToday();
    const seed = checklistSeed(day, w.events.map((e) => e.type), today);
    await prisma.coupleChecklistItem.createMany({ data: seed.map((s) => ({ ...s, weddingId })), skipDuplicates: true });
    // The wedding day moved: ready-made items follow it, unless the couple chose the date or already ticked the item.
    const auto = await prisma.coupleChecklistItem.findMany({ where: { weddingId, templateKey: { not: null }, customDate: false, done: false }, select: { id: true, templateKey: true, dueDate: true } });
    const moves = auto.flatMap((i) => {
      const next = redatedDue(i.templateKey!, day, today, ymd(i.dueDate));
      return next === undefined ? [] : [prisma.coupleChecklistItem.update({ where: { id: i.id }, data: { dueDate: next } })];
    });
    if (moves.length) await prisma.$transaction(moves);
    const items = await prisma.coupleChecklistItem.findMany({ where: { weddingId, hidden: false }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    return items.map(view);
  },

  async add(weddingId: string, input: ChecklistItemInput, actorId: string) {
    const c = checkChecklistItem(input);
    if (!c.ok) throw new ValidationError(c.error);
    await openForChanges(weddingId);
    const weddingEventId = await checkFunction(weddingId, c.value.weddingEventId);
    const max = await prisma.coupleChecklistItem.aggregate({ where: { weddingId }, _max: { sortOrder: true } });
    const created = await prisma.coupleChecklistItem.create({ data: { ...c.value, weddingEventId, weddingId, createdById: actorId, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
    return view(created);
  },

  async update(weddingId: string, id: string, input: ChecklistItemInput, actorId: string) {
    const c = checkChecklistItem(input);
    if (!c.ok) throw new ValidationError(c.error);
    await openForChanges(weddingId);
    const item = await itemOf(weddingId, id);
    const weddingEventId = await checkFunction(weddingId, c.value.weddingEventId);
    void actorId;
    // A date the couple changed is theirs from now on (it no longer follows the wedding day).
    const customDate = item.customDate || ymd(c.value.dueDate) !== ymd(item.dueDate);
    return view(await prisma.coupleChecklistItem.update({ where: { id }, data: { ...c.value, weddingEventId, customDate } }));
  },

  async setDone(weddingId: string, id: string, done: boolean, actorId: string) {
    await openForChanges(weddingId);
    const item = await itemOf(weddingId, id);
    if (item.done === done) return view(item);
    const updated = await prisma.coupleChecklistItem.update({ where: { id }, data: done ? { done: true, doneAt: new Date(), doneById: actorId } : { done: false, doneAt: null, doneById: null } });
    return view(updated);
  },

  async remove(weddingId: string, id: string) {
    await openForChanges(weddingId);
    const item = await itemOf(weddingId, id);
    if (item.templateKey) await prisma.coupleChecklistItem.update({ where: { id }, data: { hidden: true } });
    else await prisma.coupleChecklistItem.delete({ where: { id } });
    return { removed: true as const };
  },

  // Staff, read-only: progress and what is left.
  async forStaff(weddingId: string) {
    const items = await prisma.coupleChecklistItem.findMany({ where: { weddingId, hidden: false }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    return items.map(view);
  },
};

export interface BudgetRecords {
  total: number | null;
  planned: { category: string; planned: number }[];
  expenses: { id: string; category: string; categoryLabel: string; title: string; amount: number; paid: number; spentOn: string | null; notes: string | null }[];
}

export const coupleBudgetService = {
  async records(weddingId: string): Promise<BudgetRecords> {
    const [w, planned, expenses] = await Promise.all([
      prisma.wedding.findUnique({ where: { id: weddingId }, select: { coupleBudget: true } }),
      prisma.coupleBudgetCategory.findMany({ where: { weddingId }, select: { category: true, planned: true } }),
      prisma.coupleExpense.findMany({ where: { weddingId }, orderBy: [{ createdAt: 'desc' }] }),
    ]);
    return {
      total: w?.coupleBudget ?? null,
      planned,
      expenses: expenses.map((e) => ({ id: e.id, category: e.category, categoryLabel: categoryLabel(e.category), title: e.title, amount: e.amount, paid: e.paid, spentOn: ymd(e.spentOn), notes: e.notes })),
    };
  },

  async setTotal(weddingId: string, total: unknown, actorId: string) {
    const c = checkTotal(total);
    if (!c.ok) throw new ValidationError(c.error);
    await openForChanges(weddingId);
    await prisma.wedding.update({ where: { id: weddingId }, data: { coupleBudget: c.value } });
    await log(weddingId, c.value === null ? 'The couple cleared their own budget' : `The couple set their own budget: ₹${c.value.toLocaleString('en-IN')}`, actorId);
    return { total: c.value };
  },

  // A blank amount removes that category's plan.
  async setPlanned(weddingId: string, category: unknown, planned: unknown) {
    const c = checkPlanned(category, planned);
    if (!c.ok) throw new ValidationError(c.error);
    await openForChanges(weddingId);
    if (c.value.planned === null) await prisma.coupleBudgetCategory.deleteMany({ where: { weddingId, category: c.value.category } });
    else await prisma.coupleBudgetCategory.upsert({ where: { weddingId_category: { weddingId, category: c.value.category } }, create: { weddingId, category: c.value.category, planned: c.value.planned }, update: { planned: c.value.planned } });
    return { category: c.value.category, planned: c.value.planned };
  },

  async addExpense(weddingId: string, input: ExpenseInput, actorId: string) {
    const c = checkExpense(input);
    if (!c.ok) throw new ValidationError(c.error);
    await openForChanges(weddingId);
    return prisma.coupleExpense.create({ data: { ...c.value, weddingId, createdById: actorId } });
  },

  async updateExpense(weddingId: string, id: string, input: ExpenseInput) {
    const c = checkExpense(input);
    if (!c.ok) throw new ValidationError(c.error);
    await openForChanges(weddingId);
    if (!(await prisma.coupleExpense.findFirst({ where: { id, weddingId }, select: { id: true } }))) throw new NotFoundError('CoupleExpense', id);
    return prisma.coupleExpense.update({ where: { id }, data: c.value });
  },

  async removeExpense(weddingId: string, id: string) {
    await openForChanges(weddingId);
    const { count } = await prisma.coupleExpense.deleteMany({ where: { id, weddingId } });
    if (!count) throw new NotFoundError('CoupleExpense', id);
    return { removed: true as const };
  },
};
