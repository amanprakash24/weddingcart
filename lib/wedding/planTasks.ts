// How the Plan tab lays out a wedding's tasks: what is late, what is due today, what is coming, what has no date, and what is finished.
// Pure. The rules match lib/wedding/stage.ts (India calendar days; open = pending or in progress), so the tab, the Overview and the next
// action always agree about what "overdue" means.
import { daysFromToday, isOpenTask } from '@/lib/wedding/stage';
import { isVendorFollowUpTask } from '@/lib/booking/unassigned';

export interface PlanTask {
  id: string;
  title: string;
  description: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueAt: string | null;
  completedAt: string | null;
  assignedToName: string | null;
  weddingEventId?: string | null;
}

export type TaskGroupKey = 'overdue' | 'today' | 'upcoming' | 'noDate' | 'done';

export interface TaskGroup {
  key: TaskGroupKey;
  label: string;
  tasks: PlanTask[];
}

const RANK = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
const byPriority = (a: PlanTask, b: PlanTask) => RANK[a.priority] - RANK[b.priority];
const byDue = (a: PlanTask, b: PlanTask) => (a.dueAt as string).localeCompare(b.dueAt as string) || byPriority(a, b);

// The tasks that mirror a vendor ("Confirm booking with…", "Assign a vendor for…") are shown as vendors, so they are not in these groups.
export function planTaskGroups(tasks: PlanTask[], now: Date = new Date()): TaskGroup[] {
  const real = tasks.filter((t) => !isVendorFollowUpTask(t.title));
  const open = real.filter(isOpenTask);
  const days = (t: PlanTask) => (t.dueAt ? daysFromToday(t.dueAt, now) : null);
  const groups: TaskGroup[] = [
    { key: 'overdue', label: 'Overdue', tasks: open.filter((t) => (days(t) ?? 0) < 0 && t.dueAt).sort(byDue) },
    { key: 'today', label: 'Today', tasks: open.filter((t) => days(t) === 0).sort(byPriority) },
    { key: 'upcoming', label: 'Upcoming', tasks: open.filter((t) => (days(t) ?? 0) > 0).sort(byDue) },
    { key: 'noDate', label: 'No date', tasks: open.filter((t) => !t.dueAt).sort(byPriority) },
    { key: 'done', label: 'Done', tasks: real.filter((t) => !isOpenTask(t)).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')) },
  ];
  return groups.filter((g) => g.tasks.length > 0);
}

// "3 days overdue", "due today", "due tomorrow", "due in 5 days" — or null when there is no date.
export function dueWords(task: Pick<PlanTask, 'dueAt'>, now: Date = new Date()): string | null {
  if (!task.dueAt) return null;
  const d = daysFromToday(task.dueAt, now);
  if (d === null) return null;
  if (d === 0) return 'due today';
  if (d === 1) return 'due tomorrow';
  if (d === -1) return '1 day overdue';
  return d > 0 ? `due in ${d} days` : `${-d} days overdue`;
}

// The task the Next action is about when it says "Overdue: …": the most overdue open task (same order the engine uses).
export function nextOverdueTaskId(tasks: PlanTask[], now: Date = new Date()): string | null {
  return planTaskGroups(tasks, now).find((g) => g.key === 'overdue')?.tasks[0]?.id ?? null;
}

// <input type="date"> value (YYYY-MM-DD) ⇄ the ISO instant the API stores. A due date is a day, kept as midnight UTC of that day.
export const dateInputValue = (iso: string | null): string => (iso ? iso.slice(0, 10) : '');
export const isoFromDateInput = (value: string): string | null => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : null);
