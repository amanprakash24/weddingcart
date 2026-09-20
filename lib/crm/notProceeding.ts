// "Not proceeding": what the operator picks in plain words, and how it is stored with the EXISTING lost-reason system.
//
// Closing a lead already means moving it to Lost with one of a closed set of reasons (lib/crm/pipeline.ts,
// stored as a database enum). "Customer cancelled" is not in that set, and adding it would need a schema change, so for
// V1 it is offered as its own option and stored as OTHER with the detail auto-filled to "Customer cancelled" — the
// operator never has to choose Other and type it. (Reports group it under Other until it becomes a real reason.)
import { LOST_REASON_LABELS, type LostReason } from '@/lib/crm/pipeline';

export type NotProceedingKey = 'CHOSE_ANOTHER' | 'DATE_CHANGED' | 'BUDGET_CHANGED' | 'CUSTOMER_CANCELLED' | 'NO_RESPONSE' | 'OTHER';

export const CANCELLED_DETAIL = 'Customer cancelled';

export interface NotProceedingReason {
  key: NotProceedingKey;
  label: string;
  lostReason: LostReason;
  needsDetail: boolean; // free text is required (only "Other")
}

export const NOT_PROCEEDING_REASONS: NotProceedingReason[] = [
  { key: 'CHOSE_ANOTHER', label: 'Customer chose another option', lostReason: 'CHOSE_COMPETITOR', needsDetail: false },
  { key: 'DATE_CHANGED', label: 'Date changed', lostReason: 'DATE_UNAVAILABLE', needsDetail: false },
  { key: 'BUDGET_CHANGED', label: 'Budget changed', lostReason: 'BUDGET_ISSUE', needsDetail: false },
  { key: 'CUSTOMER_CANCELLED', label: 'Customer cancelled', lostReason: 'OTHER', needsDetail: false },
  { key: 'NO_RESPONSE', label: 'No response', lostReason: 'NO_RESPONSE', needsDetail: false },
  { key: 'OTHER', label: 'Other', lostReason: 'OTHER', needsDetail: true },
];

export function findReason(key: NotProceedingKey): NotProceedingReason {
  return NOT_PROCEEDING_REASONS.find((r) => r.key === key) ?? NOT_PROCEEDING_REASONS[NOT_PROCEEDING_REASONS.length - 1];
}

// What is sent to the stage-change route ({ toStage: 'LOST', reason, reasonDetail }). Returns an error message instead when
// the choice is incomplete ("Other" needs a few words).
export function toStageReason(key: NotProceedingKey, extra: string): { reason: LostReason; reasonDetail?: string } | { error: string } {
  const choice = findReason(key);
  const text = extra.trim();
  if (choice.needsDetail && !text) return { error: 'Please add a few words for “Other”.' };
  if (key === 'CUSTOMER_CANCELLED') return { reason: 'OTHER', reasonDetail: text ? `${CANCELLED_DETAIL} — ${text}` : CANCELLED_DETAIL };
  return { reason: choice.lostReason, reasonDetail: text || undefined };
}

// The words shown for a stored reason. Reverses the mapping above, so a lead closed as "Customer cancelled" reads that way.
export function describeLostReason(reason: LostReason | null | undefined, detail: string | null | undefined): { label: string; detail: string | null } {
  const text = detail?.trim() || null;
  if (!reason) return { label: 'Marked as not proceeding', detail: text };
  if (reason === 'OTHER' && text?.startsWith(CANCELLED_DETAIL)) {
    const rest = text.slice(CANCELLED_DETAIL.length).replace(/^\s*[—-]\s*/, '').trim();
    return { label: CANCELLED_DETAIL, detail: rest || null };
  }
  const labels: Record<LostReason, string> = {
    BUDGET_ISSUE: 'Budget changed',
    DATE_UNAVAILABLE: 'Date changed or unavailable',
    CHOSE_COMPETITOR: 'Customer chose another option',
    NO_RESPONSE: 'No response',
    OTHER: LOST_REASON_LABELS.OTHER,
  };
  return { label: labels[reason], detail: text };
}
