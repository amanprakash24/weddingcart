// Payment schedule rules (22 Nov 2026). Pure — shared by the service (validation on save) and the screens (what is paid / due).
//
// The schedule splits an agreement's BALANCE (agreementTotal − confirmationAmount) into dated instalments. The booking amount is
// not an instalment: the agreement fixes it. A schedule is valid only when its instalments add up to the balance EXACTLY, every
// amount is a positive whole number of rupees, every date is a real calendar date, and the dates never go backwards.

export const MAX_INSTALMENTS = 12;
export const MAX_LABEL = 60;

export interface InstalmentInput {
  label: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD (India date)
}

export type ScheduleProblem =
  | { code: 'TOO_MANY'; message: string }
  | { code: 'LABEL'; index: number; message: string }
  | { code: 'AMOUNT'; index: number; message: string }
  | { code: 'DATE'; index: number; message: string }
  | { code: 'ORDER'; index: number; message: string }
  | { code: 'SUM'; message: string; difference: number };

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// The balance the instalments must add up to.
export function scheduleBalance(agreementTotal: number, confirmationAmount: number): number {
  return Math.max(0, agreementTotal - Math.min(confirmationAmount, agreementTotal));
}

// Every problem with a proposed schedule (empty = valid). An empty schedule is valid: it means "no dates set yet".
export function validateSchedule(items: InstalmentInput[], balance: number): ScheduleProblem[] {
  const problems: ScheduleProblem[] = [];
  if (items.length > MAX_INSTALMENTS) problems.push({ code: 'TOO_MANY', message: `At most ${MAX_INSTALMENTS} instalments` });
  items.forEach((it, index) => {
    const label = it.label.trim();
    if (!label || label.length > MAX_LABEL) problems.push({ code: 'LABEL', index, message: `Instalment ${index + 1}: give it a name (up to ${MAX_LABEL} characters)` });
    if (!Number.isInteger(it.amount) || it.amount <= 0) problems.push({ code: 'AMOUNT', index, message: `Instalment ${index + 1}: the amount must be whole rupees, more than 0` });
    if (!isCalendarDate(it.dueDate)) problems.push({ code: 'DATE', index, message: `Instalment ${index + 1}: choose a due date` });
    else if (index > 0 && isCalendarDate(items[index - 1].dueDate) && it.dueDate < items[index - 1].dueDate) {
      problems.push({ code: 'ORDER', index, message: `Instalment ${index + 1} is due before instalment ${index} — put them in date order` });
    }
  });
  if (items.length > 0) {
    const sum = items.reduce((s, it) => s + (Number.isInteger(it.amount) ? it.amount : 0), 0);
    if (sum !== balance) {
      const difference = balance - sum;
      problems.push({
        code: 'SUM',
        difference,
        message: `The instalments add up to ${rupees(sum)}, but the balance is ${rupees(balance)} — ${difference > 0 ? `${rupees(difference)} is not scheduled` : `${rupees(-difference)} too much`}`,
      });
    }
  }
  return problems;
}

export interface ScheduledStep {
  label: string;
  amount: number;
  dueDate: string | null; // null for the booking amount
  paid: number;
  remaining: number;
  status: 'PAID' | 'PART_PAID' | 'DUE' | 'OVERDUE';
}

// What is paid of each step, in order: money received goes to the booking amount first, then to the instalments by due date.
// `today` is the India date (YYYY-MM-DD) — an unpaid instalment whose date has passed is OVERDUE.
export function allocate(steps: { label: string; amount: number; dueDate: string | null }[], received: number, today: string): ScheduledStep[] {
  let left = Math.max(0, received);
  return steps.map((s) => {
    const paid = Math.min(left, s.amount);
    left -= paid;
    const remaining = s.amount - paid;
    const status: ScheduledStep['status'] = remaining === 0 ? 'PAID' : s.dueDate && s.dueDate < today ? 'OVERDUE' : paid > 0 ? 'PART_PAID' : 'DUE';
    return { ...s, paid, remaining, status };
  });
}

export const indiaToday = (now: Date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
