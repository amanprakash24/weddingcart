'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Clock, MapPin, Pencil, Trash2 } from 'lucide-react';
import type { ClientPortalEvent } from '@/services/clientPortal.service';
import { changeNeedsApproval, COUPLE_FUNCTION_TYPES, coupleFunctionProblem, coupleMayChange, needsConfirmation, type CoupleFunctionInput } from '@/lib/wedding/coupleFunctions';
import { FUNCTION_TYPE_LABELS } from '@/lib/wedding/functions';
import { serviceStatus } from '@/lib/customer/myWedding';

// My Wedding → Functions (22 Nov 2026): the schedule, and the couple adding / editing their own functions. One at the booked venue shows
// "Waiting for confirmation" at once and stays so until the planner or the venue confirms it; nothing about the booking changes.

type Fn = ClientPortalEvent['functions'][number];
const field = 'min-h-11 w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 text-base';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const tone = { good: 'bg-[#DCF3E5] text-[#14532D]', wait: 'bg-[#FEF3C7] text-[#78350F]', off: 'bg-white/70 text-[#374151]' } as const;
const dayNum = (ymd: string) => Number(ymd.slice(8, 10));
const monthShort = (ymd: string) => new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' }).format(new Date(`${ymd}T00:00:00Z`));
const weekday = (ymd: string) => new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${ymd}T00:00:00Z`));
const time12 = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
};
const name = (f: { type: string; label: string | null }) => f.label?.trim() || FUNCTION_TYPE_LABELS[f.type as keyof typeof FUNCTION_TYPE_LABELS] || 'Function';

const empty = (): CoupleFunctionInput => ({ type: 'MEHNDI', name: '', date: '', startTime: '', endTime: '', place: 'ELSEWHERE', venueSpaceId: '', venueName: '', venueAddress: '', description: '' });

function Status({ f }: { f: Fn }) {
  if (f.confirmation === 'WAITING') return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone.wait}`}>{f.pendingChange ? 'Change waiting for confirmation' : 'Waiting for confirmation'}</span>;
  if (f.confirmation === 'NOT_POSSIBLE') return <span className="rounded-full bg-[#FDE8E7] px-2.5 py-0.5 text-xs font-semibold text-[#B42318]">Not possible</span>;
  return f.addedByCouple ? <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone.good}`}>Confirmed</span> : null;
}

export default function CoupleFunctions({ event, plannerName }: { event: ClientPortalEvent; plannerName: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; form: CoupleFunctionInput } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const venue = event.booking.venueName;
  // editable: the wedding is still being planned, and this person may change the plan (family access, 23 Nov 2026)
  const open = event.access.canPlan && event.status !== 'COMPLETED' && event.status !== 'CANCELLED';

  const startAdd = () => { setNotice(null); setError(null); setEditing({ id: null, form: empty() }); };
  const startEdit = (f: Fn) => {
    setNotice(null);
    setError(null);
    const p = f.pendingChange;
    if (p) {
      setEditing({ id: f.id, form: { type: p.type, name: p.label ?? '', date: p.date, startTime: p.startTime ?? '', endTime: p.endTime ?? '', place: p.atBookedVenue ? 'BOOKED_VENUE' : 'ELSEWHERE', venueSpaceId: p.venueSpaceId ?? '', venueName: p.venueName ?? '', venueAddress: p.venueAddress ?? '', description: p.description ?? '' } });
      return;
    }
    setEditing({ id: f.id, form: { type: f.type, name: f.label ?? '', date: f.day, startTime: f.startTime ?? '', endTime: f.endTime ?? '', place: f.place, venueSpaceId: f.venueSpaceId ?? '', venueName: f.venueName ?? '', venueAddress: f.venueAddress ?? '', description: f.description ?? '' } });
  };
  const set = (patch: Partial<CoupleFunctionInput>) => setEditing((cur) => (cur ? { ...cur, form: { ...cur.form, ...patch } } : cur));

  const send = async (method: 'POST' | 'PATCH' | 'DELETE', id: string | null, body?: CoupleFunctionInput) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const editedFn = method === 'PATCH' ? event.functions.find((x) => x.id === id) : undefined;
      const url = `/api/customer/weddings/${event.id}/functions${id ? `/${id}` : ''}`;
      const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not save. Please try again.');
      setEditing(null);
      setNotice(
        method === 'DELETE'
          ? 'Function removed.'
          : editedFn && changeNeedsApproval(editedFn)
            ? `Request sent. Nothing changes until ${plannerName} confirms it.`
            : body && needsConfirmation(body)
            ? `Saved. It shows as “waiting for confirmation” until ${plannerName} confirms it with the venue.`
            : 'Saved — it is on your schedule.'
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const f = editing?.form;
  const editingFn = editing?.id ? event.functions.find((x) => x.id === editing.id) : undefined;
  const hasWedding = event.functions.some((x) => x.type === 'WEDDING');
  const problem = f ? coupleFunctionProblem({ ...f, startTime: f.startTime || null, endTime: f.endTime || null }, today()) : null;

  return (
    <section id="functions" aria-labelledby="c-fn" className="os-glass min-w-0 flex-[999_1_460px] scroll-mt-4 rounded-[22px] border bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="c-fn" className="text-[17px] font-bold">Your functions</h2>
        {open && !editing && (
          <button type="button" onClick={startAdd} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--primary)] px-4 text-sm font-bold text-white">
            <CalendarPlus className="h-4 w-4" aria-hidden />Add a function
          </button>
        )}
      </div>
      {notice && <p role="status" className="mt-3 rounded-xl bg-[#DCF3E5] px-3 py-2 text-sm text-[#14532D]">{notice}</p>}

      {editing && f && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (!problem) void send(editing.id ? 'PATCH' : 'POST', editing.id, f); }}
          className="mt-4 grid gap-3 rounded-2xl border border-white/70 bg-white/60 p-4"
        >
          <p className="font-semibold">{editing.id ? 'Change this function' : 'Add a function'}</p>
          {editingFn && changeNeedsApproval(editingFn) && <p className="rounded-xl bg-[#FEF3C7] px-3 py-2 text-sm text-[#78350F]">This is part of your booking. Your change goes to {plannerName} and nothing moves until they confirm it.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">What is it?
              <select aria-label="Function" value={f.type} onChange={(e) => set({ type: e.target.value })} className={field}>
                {COUPLE_FUNCTION_TYPES.filter((t) => (t === 'WEDDING' ? f.type === 'WEDDING' || (!editing.id && !hasWedding) : f.type !== 'WEDDING' || !editing.id)).map((t) => <option key={t} value={t}>{FUNCTION_TYPE_LABELS[t]}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">Name {f.type !== 'OTHER' && <span className="text-xs text-[var(--color-text-muted)]">(optional)</span>}
              <input aria-label="Function name" value={f.name ?? ''} maxLength={80} onChange={(e) => set({ name: e.target.value })} placeholder={f.type === 'OTHER' ? 'e.g. Cocktail night' : `e.g. ${FUNCTION_TYPE_LABELS[f.type as keyof typeof FUNCTION_TYPE_LABELS] ?? ''} at Nani’s`} className={field} />
            </label>
            <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">Date
              <input aria-label="Date" type="date" min={today()} value={f.date} onChange={(e) => set({ date: e.target.value })} className={field} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">Starts
                <input aria-label="Start time" type="time" value={f.startTime ?? ''} onChange={(e) => set({ startTime: e.target.value })} className={field} />
              </label>
              <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">Ends
                <input aria-label="End time" type="time" value={f.endTime ?? ''} onChange={(e) => set({ endTime: e.target.value })} className={field} />
              </label>
            </div>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm text-[var(--color-text-secondary)]">Where?</legend>
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-white/70 bg-white/70 px-3 text-sm">
              <input type="radio" name="place" checked={f.place === 'BOOKED_VENUE'} onChange={() => set({ place: 'BOOKED_VENUE' })} />
              At {venue ? <b>{venue}</b> : 'our booked venue'}
            </label>
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-white/70 bg-white/70 px-3 text-sm">
              <input type="radio" name="place" checked={f.place === 'ELSEWHERE'} onChange={() => set({ place: 'ELSEWHERE' })} />
              Somewhere else (home, another place)
            </label>
          </fieldset>
          {f.place === 'BOOKED_VENUE' ? (
            <>
              {event.booking.spaces.length > 0 && (
                <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">Hall or space <span className="text-xs text-[var(--color-text-muted)]">(optional)</span>
                  <select aria-label="Hall or space" value={f.venueSpaceId ?? ''} onChange={(e) => set({ venueSpaceId: e.target.value })} className={field}>
                    <option value="">Not sure yet</option>
                    {event.booking.spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
              )}
              <p className="rounded-xl bg-[#FEF3C7] px-3 py-2 text-sm text-[#78350F]">This uses your booked venue, so it shows as <b>waiting for confirmation</b> until {plannerName} checks it with the venue. Your booking and price do not change.</p>
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">Place
                <input aria-label="Place" value={f.venueName ?? ''} maxLength={160} onChange={(e) => set({ venueName: e.target.value })} placeholder="e.g. Home" className={field} />
              </label>
              <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">Address <span className="text-xs text-[var(--color-text-muted)]">(optional)</span>
                <input aria-label="Address" value={f.venueAddress ?? ''} maxLength={300} onChange={(e) => set({ venueAddress: e.target.value })} className={field} />
              </label>
            </div>
          )}
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">Notes <span className="text-xs text-[var(--color-text-muted)]">(optional)</span>
            <textarea aria-label="Notes" value={f.description ?? ''} maxLength={500} rows={2} onChange={(e) => set({ description: e.target.value })} placeholder="Dress code, who is coming, anything to plan for" className="w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2 text-base" />
          </label>
          {problem && f.date && <p className="text-sm text-[#78350F]">{problem}</p>}
          {error && <p role="alert" className="text-sm text-[#B42318]">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || !!problem} className="min-h-11 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" disabled={busy} onClick={() => { setEditing(null); setError(null); }} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-[var(--color-text-secondary)]">Cancel</button>
          </div>
        </form>
      )}

      {event.functions.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Your functions appear here as the plan is made.</p>
      ) : (
        <ol className="mt-3 divide-y divide-white/70">
          {event.functions.map((fn) => (
            <li key={fn.id} className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-3.5 py-3 sm:grid-cols-[76px_minmax(0,1fr)]">
              <span className="rounded-xl bg-[var(--color-primary-subtle-bg)] py-1.5 text-center"><b className="block text-lg">{dayNum(fn.day)}</b><span className="text-xs text-[var(--color-text-muted)]">{monthShort(fn.day)} · {weekday(fn.day)}</span></span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <b className="text-base">{name(fn)}</b>
                  <Status f={fn} />
                  {fn.addedByCouple && <span className="text-xs text-[var(--color-text-muted)]">Added by you</span>}
                </span>
                <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-[var(--color-text-muted)]">
                  {fn.startTime && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden />{time12(fn.startTime)}{fn.endTime && <> – {time12(fn.endTime)}{fn.endTime < fn.startTime && ' (next day)'}</>}</span>}
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{fn.place === 'BOOKED_VENUE' ? `${venue ?? 'Booked venue'}${fn.spaceName ? ` · ${fn.spaceName}` : ''}` : [fn.venueName, fn.venueAddress].filter(Boolean).join(', ') || fn.location}</span>
                </span>
                {fn.description && <span className="mt-1 block text-sm text-[var(--color-text-secondary)]">{fn.description}</span>}
                {fn.pendingChange && <span className="mt-1 block rounded-lg bg-[#FEF3C7] px-2 py-1 text-sm text-[#78350F]">You asked to change this to {fn.pendingChange.label || FUNCTION_TYPE_LABELS[fn.pendingChange.type as keyof typeof FUNCTION_TYPE_LABELS]} on {dayNum(fn.pendingChange.date)} {monthShort(fn.pendingChange.date)}{fn.pendingChange.startTime ? `, ${time12(fn.pendingChange.startTime)}` : ''}. The details above stay until it is confirmed.</span>}
                {fn.confirmation === 'CONFIRMED' && fn.confirmationNote && <span className="mt-1 block text-sm text-[#B42318]">Your last change was not possible: {fn.confirmationNote}</span>}
                {fn.confirmation === 'NOT_POSSIBLE' && fn.confirmationNote && <span className="mt-1 block text-sm text-[#B42318]">{fn.confirmationNote} — change the date or place, or remove it.</span>}
                {fn.services.length > 0 && (
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    {fn.services.map((s, i) => {
                      const st = serviceStatus(s.status);
                      return <span key={i} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone[st.tone]}`}>{s.name}: {st.words}</span>;
                    })}
                  </span>
                )}
                {open && !editing && (
                  <span className="mt-1.5 flex gap-1">
                    <button type="button" onClick={() => startEdit(fn)} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[var(--color-primary-text)]"><Pencil className="h-4 w-4" aria-hidden />Change</button>
                    {coupleMayChange(fn) && <button
                      type="button"
                      disabled={busy}
                      onClick={() => { if (window.confirm(`Remove ${name(fn)}?`)) void send('DELETE', fn.id); }}
                      className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[#B42318]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />Remove
                    </button>}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
      {error && !editing && <p role="alert" className="mt-2 text-sm text-[#B42318]">{error}</p>}
    </section>
  );
}
