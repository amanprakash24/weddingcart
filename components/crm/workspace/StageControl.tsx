'use client';

import { useState } from 'react';
import { STAGE_LABELS, type PipelineStage } from '@/components/crm/types';
import { PIPELINE_TRANSITIONS, LOST_REASONS, LOST_REASON_LABELS, type LostReason } from '@/lib/crm/pipeline';

export interface StageTransitionInput {
  toStage: PipelineStage;
  reason?: string;
  reasonDetail?: string;
  reviewDate?: string;
}

// Only ever offers stages the state machine (lib/crm/pipeline.ts) allows from
// the current one — the same matrix the server enforces, so there's nothing
// here the API would reject except a missing required reason.
export default function StageControl({
  currentStage,
  onTransition,
}: {
  currentStage: PipelineStage;
  onTransition: (input: StageTransitionInput) => Promise<void>;
}) {
  const validTargets = PIPELINE_TRANSITIONS[currentStage];
  const [toStage, setToStage] = useState<PipelineStage | ''>('');
  const [lostReason, setLostReason] = useState<LostReason | ''>('');
  const [lostReasonDetail, setLostReasonDetail] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [reviewDate, setReviewDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (validTargets.length === 0) return null; // terminal stage (WON/LOST)

  const reset = () => {
    setToStage('');
    setLostReason('');
    setLostReasonDetail('');
    setHoldReason('');
    setReviewDate('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toStage || submitting) return;

    if (toStage === 'LOST' && !lostReason) {
      setError('Pick a reason');
      return;
    }
    if (toStage === 'ON_HOLD' && !holdReason.trim()) {
      setError('Pick a reason');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onTransition({
        toStage,
        reason: toStage === 'LOST' ? lostReason : toStage === 'ON_HOLD' ? holdReason.trim() : undefined,
        reasonDetail: toStage === 'LOST' && lostReason === 'OTHER' ? lostReasonDetail.trim() || undefined : undefined,
        reviewDate: toStage === 'ON_HOLD' && reviewDate ? new Date(reviewDate).toISOString() : undefined,
      });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change stage');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all bg-gray-50 focus:bg-white';

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-start gap-2">
      <select value={toStage} onChange={(e) => setToStage(e.target.value as PipelineStage | '')} className={inputClass}>
        <option value="">Change stage…</option>
        {validTargets.map((s) => (
          <option key={s} value={s}>{STAGE_LABELS[s]}</option>
        ))}
      </select>

      {toStage === 'LOST' && (
        <>
          <select value={lostReason} onChange={(e) => setLostReason(e.target.value as LostReason | '')} className={inputClass}>
            <option value="">Reason…</option>
            {LOST_REASONS.map((r) => (
              <option key={r} value={r}>{LOST_REASON_LABELS[r]}</option>
            ))}
          </select>
          {lostReason === 'OTHER' && (
            <input
              value={lostReasonDetail}
              onChange={(e) => setLostReasonDetail(e.target.value)}
              placeholder="Details…"
              className={inputClass}
            />
          )}
        </>
      )}

      {toStage === 'ON_HOLD' && (
        <>
          <input value={holdReason} onChange={(e) => setHoldReason(e.target.value)} placeholder="Hold reason…" className={inputClass} />
          <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className={inputClass} />
        </>
      )}

      {toStage && (
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-1.5 rounded-lg text-sm font-medium bg-amber-500 text-white disabled:opacity-40 hover:bg-amber-600 transition-colors"
        >
          Change
        </button>
      )}

      {error && <span className="text-xs text-red-500 self-center">{error}</span>}
    </form>
  );
}
