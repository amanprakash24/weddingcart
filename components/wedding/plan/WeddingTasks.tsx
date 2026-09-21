'use client';

import { useState } from 'react';
import { dateInputValue, dueWords, isoFromDateInput, nextOverdueTaskId, planTaskGroups, type PlanTask, type TaskGroupKey } from '@/lib/wedding/planTasks';
import type { StaffMember } from './CoordinatorPicker';

type Priority = PlanTask['priority'];

export interface NewTask {
  title: string;
  dueAt?: string;
  priority: Priority;
  assignedToId?: string;
  weddingEventId?: string;
}

export interface TaskPatch {
  status?: PlanTask['status'];
  dueAt?: string | null;
  priority?: Priority;
  assignedToId?: string | null;
}

const PRIORITY_TONE: Record<Priority, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-amber-100 text-amber-700',
  URGENT: 'bg-red-100 text-red-700',
};
const PRIORITY_LABEL: Record<Priority, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent' };
const GROUP_TONE: Record<TaskGroupKey, string> = { overdue: 'text-red-700', today: 'text-amber-800', upcoming: 'text-gray-500', noDate: 'text-gray-500', done: 'text-gray-400' };
const field = 'min-h-10 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm';
const small = 'min-h-9 rounded-lg px-3 py-1.5 text-sm font-medium';

// The wedding's own to-do list: what is late, what is due today, what is coming, what has no date — and a real way to add a task with a
// date, a priority, an owner and a function, and to change any of that later.
export default function WeddingTasks({
  tasks, events, staff, coordinatorId, onAdd, onUpdate,
}: {
  tasks: PlanTask[];
  events: { id: string; label: string | null; type: string }[];
  staff: StaffMember[];
  coordinatorId: string | null;
  onAdd: (task: NewTask) => Promise<void>;
  onUpdate: (taskId: string, patch: TaskPatch) => Promise<void>;
}) {
  const now = new Date();
  const groups = planTaskGroups(tasks, now);
  const nextUp = nextOverdueTaskId(tasks, now);
  const eventName = (id: string | null | undefined) => {
    const e = events.find((x) => x.id === id);
    return e ? e.label || e.type.charAt(0) + e.type.slice(1).toLowerCase().replace(/_/g, ' ') : null;
  };

  return (
    <section aria-label="Tasks" className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Tasks</h2>
      <AddTask events={events} staff={staff} defaultAssignee={coordinatorId} onAdd={onAdd} />
      {groups.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No tasks yet. Add the first thing that needs doing.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-5">
          {groups.map((g) => (
            <div key={g.key}>
              <h3 className={`text-xs font-bold uppercase tracking-wide ${GROUP_TONE[g.key]}`}>{g.label} · {g.tasks.length}</h3>
              <ul className="mt-2 grid grid-cols-1 gap-2">
                {g.tasks.map((t) => (
                  <TaskRow key={t.id} task={t} group={g.key} highlight={t.id === nextUp} now={now} where={eventName(t.weddingEventId)} staff={staff} onUpdate={onUpdate} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AddTask({ events, staff, defaultAssignee, onAdd }: { events: { id: string; label: string | null; type: string }[]; staff: StaffMember[]; defaultAssignee: string | null; onAdd: (task: NewTask) => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [assignee, setAssignee] = useState<string | null>(null);
  const [fn, setFn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const owner = assignee ?? defaultAssignee ?? '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd({ title: title.trim(), dueAt: isoFromDateInput(due) ?? undefined, priority, assignedToId: owner || undefined, weddingEventId: fn || undefined });
      setTitle('');
      setDue('');
      setPriority('MEDIUM');
      setAssignee(null);
      setFn('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the task');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-dashed border-gray-200 p-3">
      <input aria-label="New task" placeholder="What needs doing?" value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="grid gap-1 text-xs text-gray-500">Due<input type="date" aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} className={field} /></label>
        <label className="grid gap-1 text-xs text-gray-500">Priority
          <select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className={field}>
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-gray-500">Who
          <select aria-label="Assigned to" value={owner} onChange={(e) => setAssignee(e.target.value)} className={field}>
            <option value="">Nobody yet</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name ?? 'Team member'}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-gray-500">Function
          <select aria-label="Function" value={fn} onChange={(e) => setFn(e.target.value)} className={field}>
            <option value="">Whole wedding</option>
            {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.label || ev.type.charAt(0) + ev.type.slice(1).toLowerCase().replace(/_/g, ' ')}</option>)}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy || !title.trim()} className={`${small} bg-gray-900 text-white disabled:opacity-40`}>{busy ? 'Adding…' : 'Add task'}</button>
        {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
      </div>
    </form>
  );
}

function TaskRow({
  task, group, highlight, now, where, staff, onUpdate,
}: {
  task: PlanTask; group: TaskGroupKey; highlight: boolean; now: Date; where: string | null; staff: StaffMember[];
  onUpdate: (taskId: string, patch: TaskPatch) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [due, setDue] = useState(dateInputValue(task.dueAt));
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [assignee, setAssignee] = useState(staff.find((s) => s.name === task.assignedToName)?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (patch: TaskPatch, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await onUpdate(task.id, patch);
      after?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that');
    } finally {
      setBusy(false);
    }
  };

  const closed = group === 'done';
  const words = dueWords(task, now);
  return (
    <li className={`rounded-xl border p-3 ${highlight ? 'border-red-300 bg-red-50/50 ring-1 ring-red-200' : 'border-gray-100'} ${closed ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-sm font-medium ${closed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{task.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
            {highlight && <span className="font-semibold text-red-700">Next up</span>}
            {closed ? <span>{task.status === 'DONE' ? 'Done' : 'Cancelled'}</span> : words && <span className={group === 'overdue' ? 'font-semibold text-red-700' : group === 'today' ? 'font-semibold text-amber-800' : ''}>{words}</span>}
            {where && <span>· {where}</span>}
            <span>· {task.assignedToName ?? 'nobody yet'}</span>
          </p>
        </div>
        {!closed && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_TONE[task.priority]}`}>{PRIORITY_LABEL[task.priority]}</span>}
      </div>

      {editing ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs text-gray-500">Due<input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={field} /></label>
          <label className="grid gap-1 text-xs text-gray-500">Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className={field}>{(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select>
          </label>
          <label className="grid gap-1 text-xs text-gray-500">Who
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={field}><option value="">Nobody yet</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name ?? 'Team member'}</option>)}</select>
          </label>
          <button type="button" disabled={busy} onClick={() => run({ dueAt: isoFromDateInput(due), priority, assignedToId: assignee || null }, () => setEditing(false))} className={`${small} bg-gray-900 text-white disabled:opacity-40`}>{busy ? 'Saving…' : 'Save'}</button>
          <button type="button" disabled={busy} onClick={() => setEditing(false)} className={`${small} text-gray-500 hover:bg-gray-100`}>Cancel</button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {closed ? (
            <button type="button" disabled={busy} onClick={() => run({ status: 'PENDING' })} className={`${small} border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40`}>Reopen</button>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={() => run({ status: 'DONE' })} className={`${small} bg-emerald-600 text-white disabled:opacity-40`}>Done</button>
              <button type="button" disabled={busy} onClick={() => setEditing(true)} className={`${small} border border-gray-200 text-gray-700 hover:bg-gray-50`}>Edit</button>
              <button type="button" disabled={busy} onClick={() => run({ status: 'CANCELLED' })} className={`${small} text-gray-500 hover:bg-gray-100 disabled:opacity-40`}>Cancel task</button>
            </>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </li>
  );
}
