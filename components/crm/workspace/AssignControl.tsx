'use client';

import { useEffect, useState } from 'react';
import type { SalesRep } from '@/components/crm/types';

export default function AssignControl({
  assignedTo,
  onAssign,
}: {
  assignedTo: { id: string; name: string | null } | null;
  onAssign: (assignedToId: string | null) => Promise<void>;
}) {
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/crm/sales-reps')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setSalesReps(d.data);
      });
  }, []);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null;
    setSubmitting(true);
    setError(null);
    try {
      await onAssign(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <select
        value={assignedTo?.id ?? ''}
        onChange={handleChange}
        disabled={submitting}
        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all bg-gray-50 focus:bg-white disabled:opacity-50"
      >
        <option value="">Unassigned</option>
        {salesReps.map((rep) => (
          <option key={rep.id} value={rep.id}>{rep.name ?? rep.id}</option>
        ))}
      </select>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </span>
  );
}
