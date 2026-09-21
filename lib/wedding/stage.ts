// What a person is told about a wedding: which stage it is in, and the one thing to do next. Both are worked out on read from
// what is already stored — nothing new is saved, and no enum is renamed (docs/wedding-os/09-wedding-v1-model.md).
//
// Two ideas that must stay apart:
//   • BOOKING CONFIRMED is the commercial milestone. It is the moment a Wedding record comes into existence, so it is not a
//     stage of the wedding and deliberately does not appear in WeddingStage below.
//   • PLANNING is the first operational stage of a wedding that already exists.
// A wedding does not go "Active" because a vendor said yes — vendor confirmation never decides the stage. `ACTIVE` and
// `PLANNING` in the database both read as Planning here; the calendar decides the rest.
//
// Pure: no database, no framework, no clock except the optional `now`. Dates are compared as calendar days in India
// (Asia/Kolkata), because a wedding date is a day, not an instant.
import type { WeddingStatus, TaskStatus } from '@/generated/prisma/enums';

// ---------- Stage ----------

export type OperationalStage = 'PLANNING' | 'FINAL_WEEK' | 'WEDDING_DAY' | 'COMPLETED';
export type ExceptionStage = 'POSTPONED' | 'CANCELLED';
export type WeddingStage = OperationalStage | ExceptionStage;

// The normal path, in order. (Booking Confirmed is what created the wedding; it is not on this path.)
export const OPERATIONAL_STAGES: readonly OperationalStage[] = ['PLANNING', 'FINAL_WEEK', 'WEDDING_DAY', 'COMPLETED'];

export const STAGE_LABELS: Record<WeddingStage, string> = {
  PLANNING: 'Planning',
  FINAL_WEEK: 'Final week',
  WEDDING_DAY: 'Wedding day',
  COMPLETED: 'Completed',
  POSTPONED: 'Postponed',
  CANCELLED: 'Cancelled',
};

// A wedding is in its final week when the first function is this many days away or fewer.
export const FINAL_WEEK_DAYS = 7;

type DateLike = Date | string;

export interface WeddingStageInput {
  status: WeddingStatus;
  primaryDate: DateLike;
  // Dates of every function (Mehendi, Sangeet, …). A multi-day wedding starts at its earliest date and ends at its latest;
  // primaryDate is always counted too.
  functionDates?: DateLike[];
  now?: Date;
}

export interface WeddingStageInfo {
  stage: WeddingStage;
  // Whole days from today to the first day of the wedding: positive = still ahead, 0 = starts today, negative = already
  // started. Null only when the stored date is not a real date.
  daysToGo: number | null;
  // The last day has passed but nobody has marked the wedding Completed. Not a stage of its own: the wedding stays "Wedding
  // day" and the screen should invite the coordinator to close it.
  needsClosing: boolean;
  // Normal Postpone / Cancel are offered only before the wedding day (V1 decision). Once the wedding day arrives the
  // wedding day is the primary state; a same-day cancellation is a controlled exception built later, not a menu item.
  canPostponeOrCancel: boolean;
  // Completed can be recorded once the last day of the wedding has arrived. It does not depend on vendor confirmation.
  canComplete: boolean;
}

const MS_PER_DAY = 86_400_000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Whole calendar days since 1970-01-01 in India. Null for anything that is not a real date.
function istDay(value: DateLike): number | null {
  const ms = (value instanceof Date ? value : new Date(value)).getTime();
  return Number.isNaN(ms) ? null : Math.floor((ms + IST_OFFSET_MS) / MS_PER_DAY);
}

function weddingDays(input: WeddingStageInput): { start: number; end: number } | null {
  const days = [input.primaryDate, ...(input.functionDates ?? [])].map(istDay).filter((d): d is number => d !== null);
  if (days.length === 0) return null;
  return { start: Math.min(...days), end: Math.max(...days) };
}

// Whole calendar days from today (India) to the given date: 0 = today, negative = past. Null for an unreadable date.
export function daysFromToday(value: DateLike, now: Date = new Date()): number | null {
  const day = istDay(value);
  return day === null ? null : day - (istDay(now) as number);
}

export function computeWeddingStage(input: WeddingStageInput): WeddingStageInfo {
  const closed = { daysToGo: null, needsClosing: false, canPostponeOrCancel: false, canComplete: false };
  const today = istDay(input.now ?? new Date()) as number;
  const span = weddingDays(input);
  const daysToGo = span ? span.start - today : null;

  // Recorded outcomes win over the calendar.
  if (input.status === 'COMPLETED') return { stage: 'COMPLETED', ...closed, daysToGo };
  if (input.status === 'CANCELLED') return { stage: 'CANCELLED', ...closed, daysToGo };
  if (input.status === 'POSTPONED') return { stage: 'POSTPONED', ...closed, daysToGo };

  // PLANNING and ACTIVE are the same thing to a reader; only the calendar tells them apart.
  if (!span || daysToGo === null) return { stage: 'PLANNING', ...closed, canPostponeOrCancel: true };
  if (daysToGo > FINAL_WEEK_DAYS) return { stage: 'PLANNING', daysToGo, needsClosing: false, canPostponeOrCancel: true, canComplete: false };
  if (daysToGo > 0) return { stage: 'FINAL_WEEK', daysToGo, needsClosing: false, canPostponeOrCancel: true, canComplete: false };
  return {
    stage: 'WEDDING_DAY',
    daysToGo,
    needsClosing: today > span.end,
    canPostponeOrCancel: false,
    canComplete: today >= span.end,
  };
}

// ---------- Next action ----------

export type NextActionKind =
  | 'CRITICAL_OVERDUE'
  | 'PENDING_VENDOR_CONFIRMATION'
  | 'ASSIGN_VENDOR'
  | 'INVOICE_PAYMENT'
  | 'MISSING_COORDINATOR'
  | 'MISSING_INFORMATION'
  | 'OPEN_TASK'
  | 'CLOSE_WEDDING'
  | 'RESUME_WEDDING'
  | 'ON_TRACK'
  | 'NOTHING_TO_DO';

// Which part of the wedding page the action belongs to (the six tabs of the V1 model).
export type ActionTarget = 'overview' | 'plan' | 'functions' | 'money' | 'people';

export interface NextAction {
  kind: NextActionKind;
  // 1 = most urgent … 7 = on track. Always present, so a screen can order or badge without knowing the kinds.
  priority: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  title: string; // one plain sentence, safe to show a non-technical owner
  detail: string | null;
  target: ActionTarget;
}

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface NextActionTask {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: DateLike | null;
}

export interface NextActionVendorBooking {
  vendorName: string;
  vendorCategory: string;
  status: 'PENDING_VENDOR_CONFIRMATION' | 'CONFIRMED' | 'DECLINED' | 'CUSTOMER_APPROVAL_PENDING' | 'CANCELLED' | 'COMPLETED';
  eventDate?: DateLike | null;
}

export interface NextActionInvoice {
  // DRAFT = not issued yet. Issuing, or a payment link, makes it SENT (lib/invoice/lifecycle.ts), so DRAFT here really means unsent.
  status: 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID';
  outstanding: number;
  hasActivePaymentLink?: boolean;
  // True only when the caller knows this is the quotation's advance invoice (Quotation.advanceInvoiceId). Left unset it means
  // "not known" — the wording then never claims the amount is an advance or a balance.
  isAdvance?: boolean;
}

export interface NextActionInput extends WeddingStageInput {
  coordinatorName: string | null;
  guestCount: number | null;
  couple: { brideName: string | null; groomName: string | null } | null;
  tasks: NextActionTask[];
  vendorBookings: NextActionVendorBooking[];
  // Quoted services nobody is booked for yet (by name). Vendor work like a pending confirmation, so it shares priority 2.
  unassignedServices?: string[];
  invoices: NextActionInvoice[];
}

export const isOpenTask = (t: Pick<NextActionTask, 'status'>) => t.status === 'PENDING' || t.status === 'IN_PROGRESS';
const filled = (s: string | null | undefined) => Boolean(s && s.trim());
const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const PRIORITY_RANK: Record<TaskPriority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

// A sortable day number; a missing or unreadable date sorts last.
const dayOrLast = (value: DateLike | null | undefined): number => (value ? (istDay(value) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER);

function overdueTasks(input: NextActionInput, now: Date): NextActionTask[] {
  return input.tasks.filter((t) => {
    if (!isOpenTask(t) || !t.dueAt) return false;
    const due = istDay(t.dueAt);
    return due !== null && due < (istDay(now) as number);
  });
}

// Earliest due first, then most important, then tasks with no date last.
function byUrgency(a: NextActionTask, b: NextActionTask): number {
  const da = a.dueAt ? istDay(a.dueAt) : null;
  const db = b.dueAt ? istDay(b.dueAt) : null;
  if (da !== db) return da === null ? 1 : db === null ? -1 : da - db;
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

// Every action that applies, most urgent first. The screen shows the first one; the rest are what comes after it.
// Priority order (V1 decision): 1 critical overdue · 2 pending vendor confirmation · 3 invoice/payment · 4 missing
// coordinator · 5 missing essential information · 6 open task · 7 on track.
export function listNextActions(input: NextActionInput): NextAction[] {
  const now = input.now ?? new Date();
  const info = computeWeddingStage(input);
  const actions: NextAction[] = [];

  // A wedding that is over, or off, has no planning to do. Money can still be owed after it, though — payment is collected
  // after the wedding in this business — so a completed wedding still surfaces its invoice/payment action below.
  if (info.stage === 'CANCELLED') {
    return [{ kind: 'NOTHING_TO_DO', priority: 7, title: 'This wedding was cancelled', detail: null, target: 'overview' }];
  }
  if (info.stage === 'POSTPONED') {
    return [{
      kind: 'RESUME_WEDDING', priority: 7, title: 'Resume planning once the new date is fixed',
      detail: 'This wedding is postponed.', target: 'overview',
    }];
  }
  const completed = info.stage === 'COMPLETED';

  // 1. Critical overdue: a HIGH/URGENT task past its date — or any past-due task once the wedding is close.
  if (!completed) {
    const close = info.stage === 'FINAL_WEEK' || info.stage === 'WEDDING_DAY';
    const critical = overdueTasks(input, now)
      .filter((t) => close || t.priority === 'HIGH' || t.priority === 'URGENT')
      .sort(byUrgency);
    if (critical.length > 0) {
      actions.push({
        kind: 'CRITICAL_OVERDUE', priority: 1, target: 'plan',
        title: critical.length === 1 ? `Overdue: ${critical[0].title}` : `${critical.length} overdue tasks, starting with "${critical[0].title}"`,
        detail: close ? 'The wedding is close — these cannot wait.' : 'High-priority work is past its date.',
      });
    }
  }

  // 2. Vendors who have not said yes. (Never blocks the stage — it is only something to chase.)
  if (!completed) {
    const pending = input.vendorBookings
      .filter((v) => v.status === 'PENDING_VENDOR_CONFIRMATION')
      .sort((a, b) => dayOrLast(a.eventDate) - dayOrLast(b.eventDate));
    if (pending.length > 0) {
      const first = pending[0];
      actions.push({
        kind: 'PENDING_VENDOR_CONFIRMATION', priority: 2, target: 'plan',
        title: pending.length === 1 ? `Get ${first.vendorName} to confirm` : `${pending.length} vendors have not confirmed yet`,
        detail: pending.length === 1 ? `${first.vendorCategory} is waiting for a yes.` : `Start with ${first.vendorName} (${first.vendorCategory}).`,
      });
    }
    const unassigned = input.unassignedServices ?? [];
    if (unassigned.length > 0) {
      actions.push({
        kind: 'ASSIGN_VENDOR', priority: 2, target: 'plan',
        title: unassigned.length === 1 ? `Assign a vendor for ${unassigned[0]}` : `${unassigned.length} services have no vendor yet`,
        detail: unassigned.length === 1 ? 'It was quoted, but nobody is booked for it yet.' : `Start with ${unassigned[0]}.`,
      });
    }
  }

  // 3. Invoice / payment. An amount is named only when the data says what it is: an invoice's own outstanding balance, or
  // (when the caller flags it) the advance. Several invoices are never summed into one loose "collect ₹X". A wedding with no
  // invoice is not assumed to need one.
  const draft = input.invoices.filter((i) => i.status === 'DRAFT');
  const owing = input.invoices.filter((i) => i.status !== 'DRAFT' && i.outstanding > 0);
  if (draft.length > 0) {
    const advance = draft.some((i) => i.isAdvance);
    const others = draft.length - 1;
    actions.push({
      kind: 'INVOICE_PAYMENT', priority: 3, target: 'money',
      title: advance ? 'Send advance invoice' : draft.length === 1 ? 'Send the invoice to the couple' : `Send ${draft.length} draft invoices to the couple`,
      detail: advance && others > 0
        ? `${others} other draft ${plural(others, 'invoice is', 'invoices are')} also waiting.`
        : 'It is still a draft — the couple cannot pay it yet.',
    });
  } else if (owing.length > 0) {
    const hasLink = owing.some((i) => i.hasActivePaymentLink);
    const advance = owing.some((i) => i.isAdvance);
    let title: string;
    if (owing.length === 1) title = `${owing[0].isAdvance ? 'Advance payment' : 'Payment'} of ${rupees(owing[0].outstanding)} pending`;
    else title = advance ? 'Advance payment pending' : `Payments pending on ${owing.length} invoices`;
    actions.push({
      kind: 'INVOICE_PAYMENT', priority: 3, target: 'money', title,
      detail: hasLink ? 'A payment link has been sent — follow up if it is unpaid.' : 'Share a payment link so the couple can pay.',
    });
  }

  if (!completed) {
    // 4. Coordinator.
    if (!filled(input.coordinatorName)) {
      actions.push({
        kind: 'MISSING_COORDINATOR', priority: 4, target: 'overview',
        title: 'Assign a coordinator', detail: 'Nobody on the team is looking after this wedding yet.',
      });
    }

    // 5. Essential information: who is getting married, how many guests, which functions.
    const missing: string[] = [];
    if (!filled(input.couple?.brideName) || !filled(input.couple?.groomName)) missing.push("the bride's and groom's names");
    if (input.guestCount === null || input.guestCount <= 0) missing.push('the guest count');
    if ((input.functionDates?.length ?? 0) === 0) missing.push('the functions');
    if (missing.length > 0) {
      actions.push({
        kind: 'MISSING_INFORMATION', priority: 5, target: missing[0] === 'the functions' ? 'functions' : 'people',
        title: `Add ${missing.join(', ')}`, detail: 'The rest of the plan depends on this.',
      });
    }

    // 6. Open task — the earliest-due one.
    const open = input.tasks.filter(isOpenTask).sort(byUrgency);
    if (open.length > 0) {
      actions.push({
        kind: 'OPEN_TASK', priority: 6, target: 'plan',
        title: open[0].title,
        detail: open.length > 1 ? `${open.length - 1} more ${plural(open.length - 1, 'task', 'tasks')} after this.` : null,
      });
    }
  }

  // 7. Nothing else applies. After the last day that means "close the wedding"; otherwise the wedding is on track.
  if (actions.length === 0) {
    actions.push(
      info.needsClosing
        ? { kind: 'CLOSE_WEDDING', priority: 7, target: 'overview', title: 'Mark wedding as completed', detail: 'The last day has passed and nothing else is open.' }
        : completed
          ? { kind: 'NOTHING_TO_DO', priority: 7, target: 'overview', title: 'This wedding is complete', detail: null }
          : { kind: 'ON_TRACK', priority: 7, target: 'overview', title: info.stage === 'WEDDING_DAY' ? 'It is the wedding day — everything is on track' : 'Everything is on track', detail: null }
    );
  }

  return actions.sort((a, b) => a.priority - b.priority);
}

export function computeNextAction(input: NextActionInput): NextAction {
  return listNextActions(input)[0];
}

// ---------- Closing the wedding ----------

export interface CompletionCheck {
  allowed: boolean;
  // Why it is not allowed yet (only ever the calendar — never vendors, tasks or money).
  reason: string | null;
  // Worth knowing before closing, but they do not stop it: money is collected after the wedding, so an unpaid balance is normal.
  warnings: string[];
}

export function checkCompletion(input: NextActionInput): CompletionCheck {
  const info = computeWeddingStage(input);
  if (info.stage === 'COMPLETED') return { allowed: false, reason: 'This wedding is already completed.', warnings: [] };
  if (info.stage === 'CANCELLED') return { allowed: false, reason: 'A cancelled wedding cannot be completed.', warnings: [] };
  if (info.stage === 'POSTPONED') return { allowed: false, reason: 'Resume the wedding before completing it.', warnings: [] };
  if (!info.canComplete) return { allowed: false, reason: 'The wedding has not reached its last day yet.', warnings: [] };

  const warnings: string[] = [];
  const openTasks = input.tasks.filter(isOpenTask).length;
  if (openTasks > 0) warnings.push(`${openTasks} open ${plural(openTasks, 'task', 'tasks')}`);
  const unconfirmed = input.vendorBookings.filter((v) => v.status === 'PENDING_VENDOR_CONFIRMATION').length;
  if (unconfirmed > 0) warnings.push(`${unconfirmed} ${plural(unconfirmed, 'vendor', 'vendors')} never confirmed`);
  const owed = input.invoices.filter((i) => i.status !== 'DRAFT').reduce((sum, i) => sum + Math.max(0, i.outstanding), 0);
  if (owed > 0) warnings.push(`${rupees(owed)} unpaid on sent invoices`);
  if (input.invoices.some((i) => i.status === 'DRAFT')) warnings.push('an invoice was never sent');
  return { allowed: true, reason: null, warnings };
}
