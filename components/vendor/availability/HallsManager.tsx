'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import type { Space, SpaceErrors } from '@/lib/venue/slots';

// "Your halls and lawns" on the calendar screen (lib/venue/slots.ts): add one, rename it, or take it out of use. A hall that was
// ever reserved is never deleted — it is taken out of use, so the bookings in it still read right. Changing the list needs the
// "Business profile and settings" permission; the server refuses anyone else, and this card then says so.

type Answer = { usesHalls: boolean; canManage: boolean; spaces: Space[] };

export default function HallsManager({ spaces, canManage, onChange }: { spaces: Space[]; canManage: boolean; onChange: (a: Answer) => void }) {
  const [editing, setEditing] = useState<string | 'new' | null>(spaces.length === 0 && canManage ? 'new' : null);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [errors, setErrors] = useState<SpaceErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function start(s: Space | null) {
    setEditing(s ? s.id : 'new');
    setName(s?.name ?? '');
    setCapacity(s?.capacity ? String(s.capacity) : '');
    setErrors({});
    setError(null);
  }

  async function call(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const res = await fetch(`/api/vendor-os/spaces${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.success) {
        onChange(b.data);
        setEditing(null);
      } else if (b.fieldErrors) setErrors(b.fieldErrors);
      else setError(b.error ?? 'It was not saved — please try again.');
    } catch {
      setError('Could not reach Vivah OS. It was not saved — please check your connection.');
    }
    setBusy(false);
  }

  const form = (s: Space | null) => (
    <div className="space-y-3 rounded-lg border border-[var(--color-border-default)] p-3">
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Royal Hall, Garden Lawn…" error={errors.name} className="min-h-12 text-base" autoFocus />
      <Input label="Guests it holds (optional)" inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="500" error={errors.capacity} className="min-h-12 text-base" />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setEditing(null)} className="min-h-12 rounded-xl border border-[var(--color-border-default)] px-4 text-base font-semibold text-[var(--color-text-primary)]">
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => (s ? call(`/${s.id}`, 'PATCH', { name, capacity, active: s.active }) : call('', 'POST', { name, capacity }))}
          className="min-h-12 rounded-xl bg-[var(--primary)] px-4 text-base font-semibold text-[var(--color-on-primary)] disabled:opacity-50"
        >
          {busy ? 'Saving…' : s ? 'Save' : 'Add'}
        </button>
      </div>
    </div>
  );

  return (
    <div id="halls" className="scroll-mt-4">
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Your halls and lawns</h2>
          <p className="text-xs text-[var(--color-text-muted)]">Each one has a day and a night shift on the calendar.</p>
        </div>
        {editing === null && canManage && (
          <button type="button" onClick={() => start(null)} className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold text-[var(--primary)]">
            + Add
          </button>
        )}
      </div>

      {spaces.length > 0 && (
        <ul className="divide-y divide-[var(--color-border-subtle)]">
          {spaces.map((s) =>
            editing === s.id ? (
              <li key={s.id} className="py-2">
                {form(s)}
              </li>
            ) : (
              <li key={s.id} className="flex min-h-14 items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className={`truncate text-sm font-semibold ${s.active ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] line-through'}`}>{s.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{[s.capacity ? `${s.capacity.toLocaleString('en-IN')} guests` : null, s.active ? null : 'Not in use'].filter(Boolean).join(' · ') || ' '}</p>
                </div>
                {canManage && (
                <div className="flex shrink-0 items-center">
                  <button type="button" disabled={busy} onClick={() => start(s)} className="min-h-11 rounded-lg px-3 text-sm font-medium text-[var(--primary)]">
                    Edit
                  </button>
                  {s.active ? (
                    <button type="button" disabled={busy} onClick={() => call(`/${s.id}`, 'DELETE')} className="min-h-11 rounded-lg px-3 text-sm font-medium text-[var(--color-text-secondary)]">
                      Remove
                    </button>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => call(`/${s.id}`, 'PATCH', { name: s.name, capacity: s.capacity ?? '', active: true })} className="min-h-11 rounded-lg px-3 text-sm font-medium text-[var(--color-text-secondary)]">
                      Use again
                    </button>
                  )}
                </div>
                )}
              </li>
            ),
          )}
        </ul>
      )}

      {spaces.length === 0 && !canManage && <p className="text-sm text-[var(--color-text-secondary)]">No halls added yet. The owner can add them here.</p>}
      {editing === 'new' && form(null)}
      {error && <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>}
    </Card>
    </div>
  );
}
