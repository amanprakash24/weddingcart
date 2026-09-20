import type { PipelineStage } from '@/generated/prisma/enums';

// Sprint 5.3 — the pipeline as a controlled state machine: one step forward
// or a branch to ON_HOLD/LOST, never an arbitrary jump. Enforced server-side
// (services/leadWorkspace.service.ts's transitionStage) and used client-side
// to only render valid target stages — one source of truth for both, same
// pattern components/crm/types.ts's STAGE_LABELS already uses.
export const PIPELINE_TRANSITIONS: Record<PipelineStage, PipelineStage[]> = {
  NEW: ['CONTACTED', 'LOST'],
  CONTACTED: ['QUALIFIED', 'ON_HOLD', 'LOST'],
  QUALIFIED: ['SITE_VISIT_SCHEDULED', 'ON_HOLD', 'LOST'],
  SITE_VISIT_SCHEDULED: ['QUOTATION_SENT', 'ON_HOLD', 'LOST'],
  QUOTATION_SENT: ['NEGOTIATION', 'ON_HOLD', 'LOST'],
  NEGOTIATION: ['WON', 'ON_HOLD', 'LOST'],
  // Resume to any active stage the rep picks (no separate "paused from"
  // tracking — the rep knows where they left off), or give up.
  ON_HOLD: ['CONTACTED', 'QUALIFIED', 'SITE_VISIT_SCHEDULED', 'QUOTATION_SENT', 'NEGOTIATION', 'LOST'],
  WON: [],
  LOST: [],
};

export function canTransition(from: PipelineStage, to: PipelineStage): boolean {
  return PIPELINE_TRANSITIONS[from].includes(to);
}

// The one guarded exception to the transition map (docs/wedding-os/08-quotation.md §6.5): a deal whose
// quotation has been ACCEPTED can go QUOTATION_SENT → WON directly, skipping a meaningless NEGOTIATION
// hop. `hasAcceptedQuotation` MUST come from the database on the server (leadWorkspaceService reads it);
// the map above is unchanged, so without an accepted quotation the old rule still applies.
export interface TransitionContext {
  hasAcceptedQuotation: boolean;
}

export function canTransitionWithContext(from: PipelineStage, to: PipelineStage, ctx: TransitionContext): boolean {
  if (canTransition(from, to)) return true;
  return from === 'QUOTATION_SENT' && to === 'WON' && ctx.hasAcceptedQuotation;
}

// Targets offered by the UI. Display only — the server re-checks with canTransitionWithContext.
export function allowedNextStages(from: PipelineStage, ctx: TransitionContext): PipelineStage[] {
  const base = PIPELINE_TRANSITIONS[from];
  return canTransitionWithContext(from, 'WON', ctx) && !base.includes('WON') ? [...base, 'WON'] : base;
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
