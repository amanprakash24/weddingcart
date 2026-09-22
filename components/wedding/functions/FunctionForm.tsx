'use client';

import { useState } from 'react';
import { FUNCTION_TYPES, FUNCTION_TYPE_LABELS, functionProblem, type FunctionType } from '@/lib/wedding/functions';
import { dateInputValue, isoFromDateInput } from '@/lib/wedding/planTasks';

export interface FunctionDraft {
  type: FunctionType;
  label: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  venueName: string;
  venueAddress: string;
  city: string;
  budget: string;
}

// What the API takes: blank text is sent as null (clears it), so an edit can empty a field.
export interface FunctionPayload {
  type: FunctionType;
  label: string | null;
  date: string;
  startTime: string | null;
  venueName: string | null;
  venueAddress: string | null;
  city?: string;
  budget: number | null;
}

const field = 'min-h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm';
const small = 'min-h-9 rounded-lg px-3 py-1.5 text-sm font-medium';

export const emptyDraft = (city: string): FunctionDraft => ({ type: 'MEHNDI', label: '', date: '', startTime: '', venueName: '', venueAddress: '', city, budget: '' });

export function draftFromEvent(e: { type: string; label: string | null; date: string; startTime: string | null; venueName: string | null; venueAddress: string | null; city: string; budget: number | null }): FunctionDraft {
  return { type: e.type as FunctionType, label: e.label ?? '', date: dateInputValue(e.date), startTime: e.startTime ?? '', venueName: e.venueName ?? '', venueAddress: e.venueAddress ?? '', city: e.city, budget: e.budget === null ? '' : String(e.budget) };
}

// One form for adding a function and for editing one. It says what is wrong before anything is sent; the server checks again.
export default function FunctionForm({
  initial, submitLabel, onSubmit, onCancel,
}: {
  initial: FunctionDraft;
  submitLabel: string;
  onSubmit: (payload: FunctionPayload) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof FunctionDraft>(key: K, value: FunctionDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const date = isoFromDateInput(draft.date);
    if (!date) return setError('Pick the date of this function');
    const budgetText = draft.budget.replace(/,/g, '').trim();
    const budget = budgetText === '' ? null : Number(budgetText);
    const problem = functionProblem({ type: draft.type, label: draft.label, startTime: draft.startTime || null, budget, city: draft.city });
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        type: draft.type,
        label: draft.type === 'OTHER' ? draft.label.trim() : null,
        date,
        startTime: draft.startTime || null,
        venueName: draft.venueName.trim() || null,
        venueAddress: draft.venueAddress.trim() || null,
        city: draft.city.trim() || undefined,
        budget,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this function');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs text-gray-500">Function
          <select aria-label="Function type" value={draft.type} onChange={(e) => set('type', e.target.value as FunctionType)} className={field}>
            {FUNCTION_TYPES.map((t) => <option key={t} value={t}>{FUNCTION_TYPE_LABELS[t]}</option>)}
          </select>
        </label>
        {draft.type === 'OTHER' && (
          <label className="grid gap-1 text-xs text-gray-500">Name
            <input aria-label="Function name" placeholder="e.g. Cocktail night" value={draft.label} onChange={(e) => set('label', e.target.value)} className={field} />
          </label>
        )}
        <label className="grid gap-1 text-xs text-gray-500">Date
          <input type="date" aria-label="Function date" value={draft.date} onChange={(e) => set('date', e.target.value)} className={field} />
        </label>
        <label className="grid gap-1 text-xs text-gray-500">Start time <span className="text-gray-400">(optional)</span>
          <input type="time" aria-label="Start time" value={draft.startTime} onChange={(e) => set('startTime', e.target.value)} className={field} />
        </label>
        <label className="grid gap-1 text-xs text-gray-500">Place <span className="text-gray-400">(venue or home, optional)</span>
          <input aria-label="Place" value={draft.venueName} onChange={(e) => set('venueName', e.target.value)} className={field} />
        </label>
        <label className="grid gap-1 text-xs text-gray-500">City
          <input aria-label="City" value={draft.city} onChange={(e) => set('city', e.target.value)} className={field} />
        </label>
        <label className="grid gap-1 text-xs text-gray-500 sm:col-span-2">Address <span className="text-gray-400">(optional)</span>
          <input aria-label="Address" value={draft.venueAddress} onChange={(e) => set('venueAddress', e.target.value)} className={field} />
        </label>
        <label className="grid gap-1 text-xs text-gray-500">Budget for this function ₹ <span className="text-gray-400">(optional)</span>
          <input inputMode="numeric" aria-label="Budget" value={draft.budget} onChange={(e) => set('budget', e.target.value)} className={field} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy} className={`${small} bg-gray-900 text-white disabled:opacity-40`}>{busy ? 'Saving…' : submitLabel}</button>
        <button type="button" disabled={busy} onClick={onCancel} className={`${small} text-gray-500 hover:bg-gray-100`}>Cancel</button>
        {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
      </div>
    </form>
  );
}
