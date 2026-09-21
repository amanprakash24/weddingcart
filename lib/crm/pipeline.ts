import type { PipelineStage } from '@/generated/prisma/enums';

// Sprint 5.3 — the pipeline as a controlled state machine, extended for the commercial V1 flow. This map is the MANUAL
// moves a rep can make: one step forward, a branch to ON_HOLD/LOST, and now "send a quotation" from any early stage.
// ACCEPTED and WON are deliberately NOT offered by hand — they follow the commercial facts and are set automatically
// (lib/crm/stageEvents.ts): ACCEPTED when the customer's acceptance of a quotation is recorded, WON ("Booked") when the
// booking is confirmed and the wedding exists. Enforced server-side (services/leadWorkspace.service.ts's transitionStage)
// and used client-side to only render valid target stages — one source of truth for both.
export const PIPELINE_TRANSITIONS: Record<PipelineStage, PipelineStage[]> = {
  NEW: ['CONTACTED', 'QUOTATION_SENT', 'LOST'],
  CONTACTED: ['QUALIFIED', 'QUOTATION_SENT', 'ON_HOLD', 'LOST'],
  QUALIFIED: ['SITE_VISIT_SCHEDULED', 'QUOTATION_SENT', 'ON_HOLD', 'LOST'],
  SITE_VISIT_SCHEDULED: ['QUOTATION_SENT', 'ON_HOLD', 'LOST'],
  QUOTATION_SENT: ['NEGOTIATION', 'ACCEPTED', 'ON_HOLD', 'LOST'],
  NEGOTIATION: ['ACCEPTED', 'ON_HOLD', 'LOST'],
  // Accepted, booking not confirmed yet: it can still fall through (LOST) or become Booked (WON, automatic).
  ACCEPTED: ['WON', 'LOST'],
  // Resume to any active stage the rep picks (no separate "paused from"
  // tracking — the rep knows where they left off), or give up.
  ON_HOLD: ['CONTACTED', 'QUALIFIED', 'SITE_VISIT_SCHEDULED', 'QUOTATION_SENT', 'NEGOTIATION', 'ACCEPTED', 'LOST'],
  WON: [],
  LOST: [],
};

export function canTransition(from: PipelineStage, to: PipelineStage): boolean {
  return PIPELINE_TRANSITIONS[from].includes(to);
}

// Stages that only the commercial facts may set — never picked by hand.
export const SYSTEM_ONLY_STAGES: readonly PipelineStage[] = ['ACCEPTED', 'WON'];

export function isSystemOnlyStage(stage: PipelineStage): boolean {
  return SYSTEM_ONLY_STAGES.includes(stage);
}

// Targets offered by the UI for a manual move. Display only — the server re-checks.
export function allowedNextStages(from: PipelineStage): PipelineStage[] {
  return PIPELINE_TRANSITIONS[from].filter((stage) => !isSystemOnlyStage(stage));
}

export type LostReason = 'BUDGET_ISSUE' | 'DATE_UNAVAILABLE' | 'CHOSE_COMPETITOR' | 'NO_RESPONSE' | 'OTHER';

export const LOST_REASON_LABELS: Record<LostReason, string> = {
  BUDGET_ISSUE: 'Budget issue',
  DATE_UNAVAILABLE: 'Date unavailable',
  CHOSE_COMPETITOR: 'Chose competitor',
  NO_RESPONSE: 'No response',
  OTHER: 'Other',
};

export const LOST_REASONS = Object.keys(LOST_REASON_LABELS) as LostReason[];
