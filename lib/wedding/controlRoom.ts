// The Wedding Control Room's Overview, worked out from the wedding workspace the page already loads. Pure: no database, no framework.
//
// This file decides NOTHING new. The stage, the next action and the list of things needing attention come from lib/wedding/stage.ts
// (the engine merged in PR #117); the money comes from the accepted quotation and the invoices linked to it (PR #118). All this adds
// is wording and layout data — so the screen can never disagree with the rules.
import type { WeddingWorkspace, WorkspaceInvoice, WorkspaceWeddingEvent } from '@/components/wedding/workspace/types';
import { isVenueCategory } from '@/lib/quotation/terms';
import { unassignedServiceFromTask } from '@/lib/booking/unassigned';
import {
  STAGE_LABELS, computeWeddingStage, daysFromToday, isOpenTask, listNextActions,
  type ActionTarget, type NextAction, type NextActionInput, type WeddingStage, type WeddingStageInfo,
} from '@/lib/wedding/stage';

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function dateWords(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(d);
}

const shortDate = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(d);
};

export function whenWords(days: number | null): string | null {
  if (days === null) return null;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

// ---------- journey ----------

export interface JourneyStep {
  key: 'BOOKING' | 'PLANNING' | 'FINAL_WEEK' | 'WEDDING_DAY' | 'COMPLETED';
  label: string;
  state: 'done' | 'current' | 'todo';
}

// Booking confirmed is the commercial milestone that created the wedding, so it is always behind us; the rest follows the stage.
// A postponed or cancelled wedding is shown by its banner, not by a step.
export function buildJourney(stage: WeddingStage): JourneyStep[] {
  const order: JourneyStep['key'][] = ['BOOKING', 'PLANNING', 'FINAL_WEEK', 'WEDDING_DAY', 'COMPLETED'];
  const labels: Record<JourneyStep['key'], string> = {
    BOOKING: 'Booking confirmed', PLANNING: STAGE_LABELS.PLANNING, FINAL_WEEK: STAGE_LABELS.FINAL_WEEK, WEDDING_DAY: STAGE_LABELS.WEDDING_DAY, COMPLETED: STAGE_LABELS.COMPLETED,
  };
  const at = stage === 'POSTPONED' || stage === 'CANCELLED' ? 1 : order.indexOf(stage as JourneyStep['key']);
  return order.map((key, i) => ({
    key,
    label: labels[key],
    state: stage === 'COMPLETED' ? 'done' : i < at ? 'done' : i === at && stage !== 'POSTPONED' && stage !== 'CANCELLED' ? 'current' : i === 0 ? 'done' : 'todo',
  }));
}

// ---------- money ----------

export interface MoneyView {
  mode: 'agreement' | 'invoices' | 'none';
  total: number | null;
  advance: number | null;
  received: number;
  // What is still to come after the advance (the balance invoice's outstanding once it exists, else what the agreement leaves).
  balance: number | null;
  advanceStatus: 'none' | 'notInvoiced' | 'notSent' | 'unpaid' | 'partial' | 'paid';
  advancePending: number;
  advanceReceived: number;
  stillToCome: number; // everything not yet received
  quotationNumber: string | null;
  headline: string; // one honest sentence about where the money stands
  progress: number; // 0–1, received / total
}

export function buildMoney(ws: WeddingWorkspace): MoneyView {
  const { finance } = ws;
  const agreement = finance.agreement;
  const received = finance.totals.collected;
  const advanceInvoice: WorkspaceInvoice | undefined = finance.invoices.find((i) => i.kind === 'ADVANCE');
  const balanceInvoice: WorkspaceInvoice | undefined = finance.invoices.find((i) => i.kind === 'BALANCE');

  if (!agreement) {
    if (finance.invoices.length === 0) {
      return { mode: 'none', total: null, advance: null, received: 0, balance: null, advanceStatus: 'none', advancePending: 0, advanceReceived: 0, stillToCome: 0, quotationNumber: null, headline: 'No invoices yet — nothing has been billed for this wedding.', progress: 0 };
    }
    const total = finance.totals.invoicedTotal;
    return {
      mode: 'invoices', total, advance: null, received, balance: null, advanceStatus: 'none', advancePending: 0, advanceReceived: 0, quotationNumber: null,
      stillToCome: finance.totals.outstanding,
      headline: finance.totals.outstanding > 0 ? `${inr(received)} received · ${inr(finance.totals.outstanding)} pending on invoices` : `${inr(received)} received — nothing pending`,
      progress: total > 0 ? Math.min(1, received / total) : 0,
    };
  }

  const advanceReceived = advanceInvoice?.amountPaid ?? 0;
  const advancePending = advanceInvoice ? Math.max(0, advanceInvoice.outstanding) : agreement.advance;
  let advanceStatus: MoneyView['advanceStatus'];
  if (agreement.advance <= 0) advanceStatus = 'none';
  else if (!advanceInvoice) advanceStatus = 'notInvoiced';
  else if (advancePending === 0) advanceStatus = 'paid';
  else if (advanceReceived > 0) advanceStatus = 'partial';
  else advanceStatus = advanceInvoice.status === 'DRAFT' ? 'notSent' : 'unpaid';

  const balance = balanceInvoice ? Math.max(0, balanceInvoice.outstanding) : agreement.balance;
  const stillToCome = Math.max(0, agreement.total - received);
  let headline: string;
  switch (advanceStatus) {
    case 'partial': headline = `${inr(advancePending)} of the ${inr(agreement.advance)} advance is still pending`; break;
    case 'unpaid': headline = `Advance of ${inr(agreement.advance)} is pending`; break;
    case 'notSent': headline = `Advance invoice (${inr(agreement.advance)}) has not been sent yet`; break;
    case 'notInvoiced': headline = `Advance of ${inr(agreement.advance)} has not been invoiced yet`; break;
    case 'paid': headline = balance > 0 ? `Advance received · ${inr(balance)} balance to follow` : 'Everything has been received'; break;
    default: headline = stillToCome > 0 ? `${inr(stillToCome)} still to come` : 'Everything has been received';
  }
  return {
    mode: 'agreement', total: agreement.total, advance: agreement.advance, received, balance, advanceStatus, advancePending, advanceReceived, stillToCome,
    quotationNumber: agreement.quotationNumber, headline, progress: agreement.total > 0 ? Math.min(1, received / agreement.total) : 0,
  };
}

// ---------- vendors, functions, tasks ----------

export interface VendorRow {
  key: string;
  name: string;
  category: string;
  functionName: string | null;
  state: 'confirmed' | 'pending' | 'declined' | 'unassigned';
  isVenue: boolean;
}

// Every service the wedding needs: the vendor bookings (confirmed / pending / declined) and the quoted services that still have no
// vendor at all (found from their open "assign a vendor" tasks). A vendor booking's own status is only ever read as the vendor's answer —
// it never says anything about the wedding's stage.
export function buildVendors(ws: WeddingWorkspace): VendorRow[] {
  const rows: VendorRow[] = [];
  for (const event of ws.events) {
    for (const vb of event.vendorBookings) {
      if (vb.status === 'CANCELLED') continue;
      const state: VendorRow['state'] =
        vb.status === 'CONFIRMED' || vb.status === 'COMPLETED' ? 'confirmed' : vb.status === 'DECLINED' ? 'declined' : 'pending';
      rows.push({ key: vb.id, name: vb.vendorName, category: vb.vendorCategory, functionName: event.label || event.type, state, isVenue: isVenueCategory(vb.vendorCategory) });
    }
  }
  for (const task of ws.tasks) {
    if (!isOpenTask(task)) continue;
    const service = unassignedServiceFromTask(task.title);
    if (service) rows.push({ key: `task-${task.id}`, name: service, category: service, functionName: null, state: 'unassigned', isVenue: isVenueCategory(service) });
  }
  return rows;
}

export interface FunctionRow {
  id: string;
  name: string;
  date: string;
  dateShort: string;
  place: string | null;
  services: string; // "2 of 3 services confirmed" / "No services yet"
  isToday: boolean;
  isPast: boolean;
}

export function buildFunctions(events: WorkspaceWeddingEvent[], now: Date): FunctionRow[] {
  return events.map((e) => {
    const bookings = e.vendorBookings.filter((v) => v.status !== 'CANCELLED');
    const confirmed = bookings.filter((v) => v.status === 'CONFIRMED' || v.status === 'COMPLETED').length;
    const days = daysFromToday(e.date, now);
    return {
      id: e.id,
      name: e.label || e.type.charAt(0) + e.type.slice(1).toLowerCase().replace(/_/g, ' '),
      date: e.date,
      dateShort: shortDate(e.date),
      place: [e.venueName, e.city].filter(Boolean).join(', ') || null,
      services: bookings.length === 0 ? 'No services yet' : `${confirmed} of ${bookings.length} ${plural(bookings.length, 'service', 'services')} confirmed`,
      isToday: days === 0,
      isPast: days !== null && days < 0,
    };
  });
}

export interface TaskSummary {
  total: number;
  open: number;
  overdue: number;
  dueToday: { id: string; title: string }[];
  next: { id: string; title: string; dueAt: string } | null;
}

export function buildTasks(ws: WeddingWorkspace, now: Date): TaskSummary {
  const open = ws.tasks.filter(isOpenTask);
  const days = (t: { dueAt: string | null }) => (t.dueAt ? daysFromToday(t.dueAt, now) : null);
  const upcoming = open
    .filter((t) => t.dueAt && (days(t) ?? 0) > 0) // strictly after today: today's tasks are listed under Today
    .sort((a, b) => (a.dueAt as string).localeCompare(b.dueAt as string))[0];
  return {
    total: ws.tasks.length,
    open: open.length,
    overdue: open.filter((t) => (days(t) ?? 0) < 0 && t.dueAt).length,
    dueToday: open.filter((t) => days(t) === 0).map((t) => ({ id: t.id, title: t.title })),
    next: upcoming ? { id: upcoming.id, title: upcoming.title, dueAt: upcoming.dueAt as string } : null,
  };
}

// ---------- the whole view ----------

export interface PulseCard {
  key: 'booking' | 'venue' | 'vendors' | 'money' | 'tasks';
  label: string;
  value: string;
  detail: string | null;
  tone: Tone;
  target: ActionTarget;
}

export interface ControlRoomView {
  title: string;
  facts: string[]; // "12 Dec 2026", "Rahul Banquet, Patna", "400 guests"
  when: string | null; // "in 74 days"
  bookingLabel: string; // "Booking confirmed"
  stage: WeddingStage;
  stageLabel: string;
  stageInfo: WeddingStageInfo;
  banner: string | null; // postponed / cancelled
  journey: JourneyStep[];
  next: NextAction;
  attention: NextAction[]; // real issues, most urgent first — empty when nothing is wrong (a routine open task is not an issue)
  money: MoneyView;
  pulse: PulseCard[];
  vendors: VendorRow[];
  functions: FunctionRow[];
  tasks: TaskSummary;
  todayItems: { kind: 'function' | 'task'; label: string }[];
  upcomingItems: { kind: 'function' | 'task'; label: string; when: string }[];
  secondary: { weddingNumber: string; quotationNumber: string | null; coordinator: string | null; lead: { sourceType: string; id: string } | null };
  canPostponeOrCancel: boolean;
  canComplete: boolean;
  canResume: boolean;
}

export function toNextActionInput(ws: WeddingWorkspace, now: Date): NextActionInput {
  return {
    status: ws.wedding.status,
    primaryDate: ws.wedding.primaryDate,
    functionDates: ws.events.map((e) => e.date),
    now,
    coordinatorName: ws.wedding.coordinatorName,
    guestCount: ws.wedding.guestCount,
    couple: ws.couple ? { brideName: ws.couple.brideName, groomName: ws.couple.groomName } : null,
    tasks: ws.tasks.map((t) => ({ title: t.title, status: t.status, priority: t.priority, dueAt: t.dueAt })),
    vendorBookings: ws.events.flatMap((e) =>
      e.vendorBookings.map((v) => ({ vendorName: v.vendorName, vendorCategory: v.vendorCategory, status: v.status, eventDate: e.date }))
    ),
    invoices: ws.finance.invoices.map((i) => ({
      status: i.status,
      outstanding: i.outstanding,
      hasActivePaymentLink: i.paymentLinks.some((l) => l.status === 'CREATED'),
      isAdvance: i.kind === 'ADVANCE',
    })),
  };
}

export function coupleTitle(ws: WeddingWorkspace): string {
  const names = [ws.couple?.brideName, ws.couple?.groomName].map((n) => n?.trim()).filter(Boolean);
  if (names.length > 0) return names.join(' & ');
  const fallback = ws.wedding.customerName?.trim() || ws.finance.invoices.find((i) => i.clientName?.trim())?.clientName.trim();
  if (fallback) return fallback;
  const when = dateWords(ws.wedding.primaryDate);
  return when ? `Wedding · ${when}` : 'Wedding';
}

export function buildControlRoom(ws: WeddingWorkspace, now: Date = new Date()): ControlRoomView {
  const input = toNextActionInput(ws, now);
  const stageInfo = computeWeddingStage(input);
  const stage = stageInfo.stage;
  const actions = listNextActions(input);
  const next = actions[0];
  // "Needs attention" is for real issues. An ordinary open task is the routine next step (it is the Next action when nothing else is),
  // not an issue — and listing it would repeat an overdue task that is already shown above it.
  const attention = actions.filter((a) => a.kind !== 'ON_TRACK' && a.kind !== 'NOTHING_TO_DO' && a.kind !== 'OPEN_TASK');
  const money = buildMoney(ws);
  const vendors = buildVendors(ws);
  const functions = buildFunctions(ws.events, now);
  const tasks = buildTasks(ws, now);

  const primary = ws.events.find((e) => e.date.slice(0, 10) === ws.wedding.primaryDate.slice(0, 10)) ?? ws.events[0];
  const venueBooking = vendors.find((v) => v.isVenue);
  // The venue vendor booked for this wedding is the authority on where it is; the function's own free-text venue is the fallback.
  const venueName = venueBooking && venueBooking.state !== 'unassigned' ? venueBooking.name : primary?.venueName?.trim() || null;
  const place = venueName ? [venueName, primary?.city || ws.wedding.city].filter(Boolean).join(', ') : ws.wedding.city;
  const facts = [dateWords(ws.wedding.primaryDate), place, ws.wedding.guestCount ? `${ws.wedding.guestCount.toLocaleString('en-IN')} guests` : null].filter((f): f is string => Boolean(f));

  const real = vendors.filter((v) => v.state !== 'unassigned');
  const confirmed = real.filter((v) => v.state === 'confirmed').length;
  const pending = real.filter((v) => v.state === 'pending').length;
  const declined = real.filter((v) => v.state === 'declined').length;
  const unassigned = vendors.filter((v) => v.state === 'unassigned').length;

  const venueValue = !venueBooking ? 'Not booked yet' : venueBooking.state === 'confirmed' ? 'Confirmed' : venueBooking.state === 'declined' ? 'Declined' : venueBooking.state === 'unassigned' ? 'No vendor yet' : 'Awaiting confirmation';
  const venueTone: Tone = !venueBooking ? 'neutral' : venueBooking.state === 'confirmed' ? 'ok' : venueBooking.state === 'declined' ? 'bad' : 'warn';

  const pulse: PulseCard[] = [
    { key: 'booking', label: 'Booking', value: 'Confirmed', detail: money.quotationNumber ? `Quotation ${money.quotationNumber}` : null, tone: 'ok', target: 'overview' },
    { key: 'venue', label: 'Venue', value: venueValue, detail: venueBooking && venueBooking.state !== 'unassigned' ? venueBooking.name : null, tone: venueTone, target: 'functions' },
    {
      key: 'vendors', label: 'Vendors',
      value: vendors.length === 0 ? 'None yet' : [confirmed > 0 ? `${confirmed} confirmed` : null, pending > 0 ? `${pending} pending` : null, declined > 0 ? `${declined} declined` : null, unassigned > 0 ? `${unassigned} to assign` : null].filter(Boolean).join(' · ') || 'None yet',
      detail: null, tone: declined > 0 ? 'bad' : pending + unassigned > 0 ? 'warn' : vendors.length === 0 ? 'neutral' : 'ok', target: 'functions',
    },
    {
      key: 'money', label: 'Money',
      value: money.mode === 'none' ? 'Nothing billed yet' : `${inr(money.received)} received`,
      detail: money.mode === 'none' ? null : money.stillToCome > 0 ? `${inr(money.stillToCome)} still to come` : 'Nothing pending',
      tone: money.mode === 'none' ? 'neutral' : money.advanceStatus === 'unpaid' || money.advanceStatus === 'partial' ? 'warn' : 'ok', target: 'money',
    },
    {
      key: 'tasks', label: 'Tasks',
      value: tasks.total === 0 ? 'No tasks yet' : `${tasks.open} open${tasks.overdue > 0 ? ` · ${tasks.overdue} overdue` : ''}`,
      detail: null, tone: tasks.overdue > 0 ? 'bad' : tasks.total === 0 ? 'neutral' : 'ok', target: 'plan',
    },
  ];

  const todayItems: ControlRoomView['todayItems'] = [
    ...functions.filter((f) => f.isToday).map((f) => ({ kind: 'function' as const, label: `${f.name}${f.place ? ` · ${f.place}` : ''}` })),
    ...tasks.dueToday.map((t) => ({ kind: 'task' as const, label: t.title })),
  ];
  const nextFunction = functions.filter((f) => !f.isPast && !f.isToday).sort((a, b) => a.date.localeCompare(b.date))[0];
  const upcomingItems: ControlRoomView['upcomingItems'] = [
    ...(nextFunction ? [{ kind: 'function' as const, label: `${nextFunction.name} · ${nextFunction.dateShort}`, when: whenWords(daysFromToday(nextFunction.date, now)) ?? '' }] : []),
    ...(tasks.next ? [{ kind: 'task' as const, label: tasks.next.title, when: whenWords(daysFromToday(tasks.next.dueAt, now)) ?? '' }] : []),
  ];

  return {
    title: coupleTitle(ws),
    facts,
    // A countdown only makes sense while the wedding is still coming up (or happening) — not once it is completed, postponed or cancelled.
    when: stage === 'PLANNING' || stage === 'FINAL_WEEK' || stage === 'WEDDING_DAY' ? whenWords(stageInfo.daysToGo) : null,
    bookingLabel: 'Booking confirmed',
    stage,
    stageLabel: STAGE_LABELS[stage],
    stageInfo,
    banner: stage === 'POSTPONED' ? 'This wedding is postponed.' : stage === 'CANCELLED' ? 'This wedding was cancelled.' : null,
    journey: buildJourney(stage),
    next,
    attention,
    money,
    pulse,
    vendors,
    functions,
    tasks,
    todayItems,
    upcomingItems,
    secondary: { weddingNumber: ws.wedding.weddingNumber, quotationNumber: money.quotationNumber, coordinator: ws.wedding.coordinatorName, lead: ws.sourceLead },
    canPostponeOrCancel: stageInfo.canPostponeOrCancel,
    canComplete: stageInfo.canComplete,
    canResume: stage === 'POSTPONED',
  };
}
