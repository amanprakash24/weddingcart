'use client';

import { useState } from 'react';
import { Check, Pencil, Plus, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { FUNCTION_TYPES, FUNCTION_TYPE_LABELS } from '@/lib/wedding/functions';
import { WEDDING_PLAN_LIMITS } from '@/lib/venue/weddingPlan';
import type { VenueWeddingDetail } from '@/services/venueWedding.service';
import { weddingDateWords } from './YourWeddings';

// Planning one of the business's own weddings: each function's day, time and place, and the to-do list. Phone-first. Every save
// answers with the whole wedding again, so the page above (date, days to go, stage) follows a moved function straight away.

type Fn = VenueWeddingDetail['functionList'][number];
type FnForm = { type: string; label: string; date: string; startTime: string; place: string };
type Errors = Record<string, string>;

const big = 'flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold';
const primary = `${big} w-full bg-[var(--primary)] text-[var(--color-on-primary)] disabled:opacity-50`;
const secondary = `${big} w-full border border-[var(--color-border-default)] text-[var(--color-text-primary)] disabled:opacity-50`;
const heading = 'text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]';
const icon = 'flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-text-muted)] disabled:opacity-40';
const TYPE_OPTIONS = FUNCTION_TYPES.map((t) => ({ value: t, label: FUNCTION_TYPE_LABELS[t] }));

const formOf = (f: Fn): FnForm => ({ type: f.type, label: f.type === 'OTHER' ? f.name : '', date: f.date, startTime: f.startTime ?? '', place: f.place ?? '' });

// One request at a time; the answer is the whole wedding, or what was wrong.
function useSave(id: string, onSaved: (w: VenueWeddingDetail) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  async function save(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const res = await fetch(`/api/vendor-os/weddings/${id}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'DELETE' ? undefined : JSON.stringify(body ?? {}) });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.success) {
        onSaved(b.data);
        setBusy(false);
        return true;
      }
      setErrors(b.fieldErrors ?? {});
      setError(b.fieldErrors ? 'Please check the highlighted boxes.' : (b.error ?? 'Something went wrong. It was not saved — please try again.'));
    } catch {
      setError('Could not reach Vivah OS. It was not saved — please check your connection.');
    }
    setBusy(false);
    return false;
  }
  return { busy, error, errors, save, clear: () => { setError(null); setErrors({}); } };
}

export function WeddingFunctions({ w, onSaved }: { w: VenueWeddingDetail; onSaved: (w: VenueWeddingDetail) => void }) {
  const [editing, setEditing] = useState<string | null>(null); // a function's id, or 'new'
  const [form, setForm] = useState<FnForm>({ type: 'HALDI', label: '', date: w.date, startTime: '', place: '' });
  const { busy, error, errors, save, clear } = useSave(w.id, onSaved);

  const start = (id: string, next: FnForm) => {
    clear();
    setForm(next);
    setEditing(id);
  };
  const set = (key: keyof FnForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    const ok = editing === 'new' ? await save('/functions', 'POST', form) : await save(`/functions/${editing}`, 'PATCH', form);
    if (ok) setEditing(null);
  }
  async function remove() {
    if (await save(`/functions/${editing}`, 'DELETE')) setEditing(null);
  }

  const editor = (
    <div className="space-y-3 py-3 first:pt-0 last:pb-0">
      <Select label="Which function?" value={form.type} onChange={(ev) => set('type', ev.target.value)} error={errors.type} options={TYPE_OPTIONS} className="min-h-12 text-base" />
      {form.type === 'OTHER' && <Input label="Its name" value={form.label} onChange={(ev) => set('label', ev.target.value)} error={errors.label} placeholder="Tilak, Cocktail night…" maxLength={WEDDING_PLAN_LIMITS.nameMax} className="min-h-12 text-base" />}
      <div className="grid grid-cols-2 gap-3">
        <Input label="Day" type="date" value={form.date} onChange={(ev) => set('date', ev.target.value)} error={errors.date} className="min-h-12 text-base" />
        <Input label="Time (optional)" type="time" value={form.startTime} onChange={(ev) => set('startTime', ev.target.value)} error={errors.startTime} className="min-h-12 text-base" />
      </div>
      <Input label="Where (optional)" value={form.place} onChange={(ev) => set('place', ev.target.value)} error={errors.place} placeholder="Main lawn, banquet hall…" maxLength={WEDDING_PLAN_LIMITS.placeMax} className="min-h-12 text-base" />
      {error && <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>}
      <button type="button" disabled={busy} onClick={submit} className={primary}>{busy ? 'Saving…' : editing === 'new' ? 'Add this function' : 'Save'}</button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={() => setEditing(null)} className={secondary}>Cancel</button>
        {editing !== 'new' && <button type="button" disabled={busy || w.functionList.length <= 1} onClick={remove} className={`${secondary} text-[var(--color-danger-text)]`}>Remove</button>}
      </div>
    </div>
  );

  return (
    <section aria-label="Functions" className="space-y-2">
      <h2 className={heading}>Functions</h2>
      <Card className="divide-y divide-[var(--color-border-subtle)]">
        {w.functionList.map((f) =>
          editing === f.id ? (
            <div key={f.id}>{editor}</div>
          ) : (
            <div key={f.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-base font-medium text-[var(--color-text-primary)]">{f.name}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{[weddingDateWords(f.date), f.startTime, f.place].filter(Boolean).join(' · ')}</p>
              </div>
              {w.canEdit && (
                <button type="button" aria-label={`Change ${f.name}`} disabled={editing !== null} onClick={() => start(f.id, formOf(f))} className={icon}>
                  <Pencil className="h-5 w-5" aria-hidden />
                </button>
              )}
            </div>
          )
        )}
        {editing === 'new' && <div>{editor}</div>}
      </Card>
      {w.canEdit && editing === null && (
        <button type="button" onClick={() => start('new', { type: 'HALDI', label: '', date: w.date, startTime: '', place: '' })} className={secondary}>
          <Plus className="h-5 w-5" aria-hidden /> Add a function
        </button>
      )}
    </section>
  );
}

export function WeddingTasks({ w, onSaved }: { w: VenueWeddingDetail; onSaved: (w: VenueWeddingDetail) => void }) {
  const [title, setTitle] = useState('');
  const [dueOn, setDueOn] = useState('');
  const { busy, error, errors, save } = useSave(w.id, onSaved);
  const open = w.tasks.filter((t) => !t.done).length;

  if (!w.canEdit && w.tasks.length === 0) return null;

  async function add() {
    if (await save('/tasks', 'POST', { title, dueOn })) {
      setTitle('');
      setDueOn('');
    }
  }

  return (
    <section aria-label="To do" className="space-y-2">
      <h2 className={heading}>To do{open ? ` · ${open} open` : ''}</h2>
      <Card className="space-y-3">
        {w.tasks.length === 0 && <p className="text-sm text-[var(--color-text-secondary)]">Nothing on the list yet. Add what must be done before the day — the generator, the flowers, the final guest count.</p>}
        {w.tasks.length > 0 && (
          <ul className="divide-y divide-[var(--color-border-subtle)]">
            {w.tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
                <button type="button" role="checkbox" aria-checked={t.done} aria-label={t.done ? `Not done: ${t.title}` : `Done: ${t.title}`} disabled={busy || !w.canEdit} onClick={() => save(`/tasks/${t.id}`, 'PATCH', { done: !t.done })} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${t.done ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--color-on-primary)]' : 'border-[var(--color-border-default)] text-transparent'} disabled:opacity-60`}>
                  <Check className="h-5 w-5" aria-hidden />
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-base ${t.done ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-primary)]'}`}>{t.title}</p>
                  {t.dueOn && !t.done && <p className="text-xs text-[var(--color-text-muted)]">By {weddingDateWords(t.dueOn)}</p>}
                </div>
                {w.canEdit && (
                  <button type="button" aria-label={`Take off the list: ${t.title}`} disabled={busy} onClick={() => save(`/tasks/${t.id}`, 'PATCH', { remove: true })} className={icon}>
                    <X className="h-5 w-5" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {w.canEdit && (
          <div className="space-y-3 border-t border-[var(--color-border-subtle)] pt-3">
            <Input label="Add a to-do" value={title} onChange={(ev) => setTitle(ev.target.value)} error={errors.title} placeholder="Confirm the generator" maxLength={WEDDING_PLAN_LIMITS.taskMax} className="min-h-12 text-base" />
            <Input label="By when (optional)" type="date" value={dueOn} onChange={(ev) => setDueOn(ev.target.value)} error={errors.dueOn} className="min-h-12 text-base" />
            <button type="button" disabled={busy || !title.trim()} onClick={add} className={primary}>{busy ? 'Saving…' : 'Add to the list'}</button>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>}
      </Card>
    </section>
  );
}
