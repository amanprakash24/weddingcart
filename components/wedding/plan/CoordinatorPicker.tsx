'use client';

import { useState } from 'react';

export interface StaffMember {
  id: string;
  name: string | null;
}

// Pick who looks after the wedding from the team (the same people the lead pages let you assign). Shown where it is needed: under the
// header, and inside the Next action when "Assign a coordinator" is what is next.
export default function CoordinatorPicker({
  current, staff, onAssign, label = 'Assign', onDone,
}: {
  current: string | null;
  staff: StaffMember[];
  onAssign: (coordinatorId: string | null) => Promise<void>;
  label?: string;
  onDone?: () => void;
}) {
  const [value, setValue] = useState(current ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onAssign(value || null);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not assign the coordinator');
    } finally {
      setBusy(false);
    }
  };

  if (staff.length === 0) return <p className="text-xs text-gray-500">Loading the team…</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Coordinator"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">Choose someone…</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name ?? 'Team member'}</option>)}
        </select>
        <button type="button" disabled={busy || !value || value === current} onClick={save} className="min-h-10 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          {busy ? 'Saving…' : label}
        </button>
        {onDone && <button type="button" disabled={busy} onClick={onDone} className="min-h-10 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100">Cancel</button>}
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
