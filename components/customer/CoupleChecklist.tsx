'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import type { ClientPortalEvent } from '@/services/clientPortal.service';
import type { ChecklistItemView } from '@/services/coupleChecklistBudget.service';
import { checklistGroup, checkChecklistItem, type ChecklistGroup } from '@/lib/wedding/checklist';
import { functionDisplayName } from '@/lib/wedding/coupleFunctions';

// My Wedding → Checklist (25 Nov 2026). A ready-made list dated back from the wedding day; the couple (and family who help plan) tick,
// edit, remove and add their own. The team's own work stays under "Your expert is doing" (tasks) — never mixed in here.

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const dayWords = (ymd: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${ymd}T00:00:00Z`));
const field = 'min-h-11 w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 text-base';
const GROUPS: { id: ChecklistGroup; label: string }[] = [
  { id: 'OVERDUE', label: 'Overdue' },
  { id: 'THIS_WEEK', label: 'This week' },
  { id: 'LATER', label: 'Coming up' },
  { id: 'EARLIER', label: 'Earlier steps — tick what is done' },
  { id: 'DONE', label: 'Done' },
];
type Form = { id: string | null; title: string; dueDate: string; weddingEventId: string; notes: string };
const blank: Form = { id: null, title: '', dueDate: '', weddingEventId: '', notes: '' };

export default function CoupleChecklist({ event }: { event: ClientPortalEvent }) {
  const base = `/api/customer/weddings/${event.id}/checklist`;
  const canEdit = event.access.canPlan && event.status !== 'CANCELLED';
  const [items, setItems] = useState<ChecklistItemView[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(base, { cache: 'no-store' });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success) setItems(json.data);
    else setError(json?.error || 'Could not load your checklist');
  }, [base]);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const call = async (key: string, url: string, method: string, body?: unknown) => {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not save. Please try again.');
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!form) return;
    const c = checkChecklistItem(form);
    if (!c.ok) return setError(c.error);
    const body = { title: form.title, dueDate: form.dueDate, weddingEventId: form.weddingEventId || null, notes: form.notes };
    if (await call('form', form.id ? `${base}/${form.id}` : base, form.id ? 'PATCH' : 'POST', body)) setForm(null);
  };

  const t = today();
  const fnName = (id: string | null) => { const f = event.functions.find((x) => x.id === id); return f ? functionDisplayName(f) : null; };
  const done = items?.filter((i) => i.done).length ?? 0;
  const total = items?.length ?? 0;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <section id="checklist" aria-labelledby="c-check" className="os-glass scroll-mt-4 rounded-[22px] border bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="c-check" className="flex items-center gap-2 text-[17px] font-bold"><ListChecks className="h-5 w-5 text-[var(--color-primary-text)]" aria-hidden />Your checklist</h2>
        {canEdit && !form && (
          <button type="button" onClick={() => { setError(null); setForm(blank); }} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--primary)] px-4 text-sm font-bold text-white"><Plus className="h-4 w-4" aria-hidden />Add a to-do</button>
        )}
      </div>
      {items && total > 0 && (
        <div className="mt-3">
          <p className="text-sm text-[var(--color-text-secondary)]"><b>{done}</b> of {total} done</p>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/70" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Checklist progress"><div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${pct}%` }} /></div>
        </div>
      )}

      {form && (
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 rounded-2xl border border-white/70 bg-white/60 p-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)] sm:col-span-2">What needs doing?
            <input aria-label="To-do" value={form.title} maxLength={140} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Buy the sehra" className={field} />
          </label>
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">By when <span className="text-xs text-[var(--color-text-muted)]">(optional)</span>
            <input aria-label="By when" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={field} />
          </label>
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">For which function <span className="text-xs text-[var(--color-text-muted)]">(optional)</span>
            <select aria-label="For which function" value={form.weddingEventId} onChange={(e) => setForm({ ...form, weddingEventId: e.target.value })} className={field}>
              <option value="">Whole wedding</option>
              {event.functions.map((f) => <option key={f.id} value={f.id}>{functionDisplayName(f)}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)] sm:col-span-2">Notes <span className="text-xs text-[var(--color-text-muted)]">(optional)</span>
            <input aria-label="Notes" value={form.notes} maxLength={500} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={field} />
          </label>
          {error && <p role="alert" className="text-sm text-[#B42318] sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy === 'form'} className="min-h-11 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-white disabled:opacity-40">{busy === 'form' ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => { setForm(null); setError(null); }} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-[var(--color-text-secondary)]">Cancel</button>
          </div>
        </form>
      )}

      {items === null ? (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : (
        GROUPS.map((g) => {
          const list = items.filter((i) => checklistGroup(i, t) === g.id);
          if (!list.length) return null;
          if (g.id === 'DONE' && !showDone) {
            return <button key={g.id} type="button" onClick={() => setShowDone(true)} className="mt-4 min-h-11 text-sm font-semibold text-[var(--color-primary-text)]">Show {list.length} done</button>;
          }
          return (
            <div key={g.id} className="mt-4">
              <h3 className={`text-xs font-bold uppercase tracking-[0.12em] ${g.id === 'OVERDUE' ? 'text-[#B42318]' : 'text-[var(--color-text-muted)]'}`}>{g.label} · {list.length}</h3>
              <ul className="mt-1.5 divide-y divide-white/70 rounded-2xl border border-white/70 bg-white/55">
                {list.map((i) => (
                  <li key={i.id} className="flex items-start gap-2 px-2 py-1.5">
                    <button type="button" disabled={!canEdit || busy === i.id} aria-pressed={i.done} aria-label={`${i.done ? 'Not done' : 'Done'}: ${i.title}`} onClick={() => void call(i.id, `${base}/${i.id}`, 'PATCH', { done: !i.done })} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg disabled:opacity-60">
                      {i.done ? <CheckCircle2 className="h-6 w-6 text-[#15803D]" aria-hidden /> : <Circle className="h-6 w-6 text-[var(--color-text-muted)]" aria-hidden />}
                    </button>
                    <div className="min-w-0 flex-1 py-2">
                      <p className={`text-[15px] ${i.done ? 'text-[var(--color-text-muted)] line-through' : 'font-medium'}`}>{i.title}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{[i.dueDate ? `by ${dayWords(i.dueDate)}` : null, fnName(i.weddingEventId), i.notes].filter(Boolean).join(' · ')}</p>
                    </div>
                    {canEdit && !form && (
                      <span className="flex shrink-0">
                        <button type="button" aria-label={`Change: ${i.title}`} onClick={() => { setError(null); setForm({ id: i.id, title: i.title, dueDate: i.dueDate ?? '', weddingEventId: i.weddingEventId ?? '', notes: i.notes ?? '' }); }} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-primary-text)]"><Pencil className="h-4 w-4" aria-hidden /></button>
                        <button type="button" aria-label={`Remove: ${i.title}`} disabled={busy === i.id} onClick={() => void call(i.id, `${base}/${i.id}`, 'DELETE')} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[#B42318]"><Trash2 className="h-4 w-4" aria-hidden /></button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
      {error && !form && <p role="alert" className="mt-2 text-sm text-[#B42318]">{error}</p>}
    </section>
  );
}
