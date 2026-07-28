'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { STATUS_LABELS, STATUS_COLORS, WEDDING_STATUS_TRANSITIONS, HEALTH_LABELS, HEALTH_COLORS } from './constants';
import type { WeddingWorkspace, WeddingStatus } from './types';
import { useState } from 'react';

export default function WeddingHeader({
  wedding,
  health,
  onTransition,
}: {
  wedding: WeddingWorkspace['wedding'];
  health: WeddingWorkspace['health'];
  onTransition: (toStatus: WeddingStatus) => Promise<void>;
}) {
  const router = useRouter();
  const validTargets = WEDDING_STATUS_TRANSITIONS[wedding.status];
  const [toStatus, setToStatus] = useState<WeddingStatus | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toStatus || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onTransition(toStatus);
      setToStatus('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change status');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif]">{wedding.weddingNumber}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {wedding.city} · {new Date(wedding.primaryDate).toLocaleDateString()} · {wedding.source === 'CRM' ? 'From CRM' : 'From Booking'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${HEALTH_COLORS[health]}`}>{HEALTH_LABELS[health]}</span>
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${STATUS_COLORS[wedding.status]}`}>
            {STATUS_LABELS[wedding.status]}
          </span>
        </div>
      </div>

      {validTargets.length > 0 && (
        <form onSubmit={handleTransition} className="flex flex-wrap items-center gap-2">
          <select
            value={toStatus}
            onChange={(e) => setToStatus(e.target.value as WeddingStatus | '')}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all bg-gray-50 focus:bg-white"
          >
            <option value="">Change status…</option>
            {validTargets.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          {toStatus && (
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-amber-500 text-white disabled:opacity-40 hover:bg-amber-600 transition-colors"
            >
              Change
            </button>
          )}
          {error && <span className="text-xs text-red-500">{error}</span>}
        </form>
      )}

      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
        {wedding.coordinatorName && <span>Coordinator: {wedding.coordinatorName}</span>}
        {wedding.guestCount && <span>{wedding.guestCount} guests</span>}
        {wedding.totalBudget && <span>Budget: ₹{wedding.totalBudget.toLocaleString('en-IN')}</span>}
      </div>
    </div>
  );
}
