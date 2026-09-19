// Pure decisions behind quotationService, extracted so the exact rules are unit-testable
// without mocking prisma/repositories (mock.module() intercepts by resolved file path and
// can hijack other test files' own real imports — see services/enquiry.service.ts).
import type { QuotationStatus } from '@/generated/prisma/enums';
import { ConflictError, ConversionLockedError, NotFoundError, ValidationError } from '@/lib/errors';

export interface QuotableState {
  sourceLabel: string; // "enquiry" | "consultation" | "lead" — used in messages
  sourceType: string;
  sourceId: string;
  sourceExists: boolean;
  wedding: { weddingNumber: string } | null;
  accepted: { quotationNumber: string } | null;
  open: { quotationNumber: string } | null;
}

// Can a NEW quotation be started for this source right now? Order matters: a missing
// source first, then the surest already-happened case (converted to a Wedding), then an
// accepted quote, then an open one. The database's partial unique indexes are the
// backstop if two requests race past this check.
export function evaluateQuotable(state: QuotableState): Error | null {
  if (!state.sourceExists) return new NotFoundError(state.sourceType, state.sourceId);
  if (state.wedding) {
    return new ConversionLockedError(
      `Cannot quote: this ${state.sourceLabel} already converted to Wedding ${state.wedding.weddingNumber}`
    );
  }
  if (state.accepted) {
    return new ConflictError(
      `This ${state.sourceLabel} already has an accepted quotation (${state.accepted.quotationNumber})`
    );
  }
  if (state.open) {
    return new ConflictError(
      `This ${state.sourceLabel} already has an open quotation (${state.open.quotationNumber}) — edit or finish it first`
    );
  }
  return null;
}

// Only a DRAFT is editable. A sent quote is immutable; changing it means a revision.
export function evaluateEditable(status: QuotationStatus): Error | null {
  if (status === 'DRAFT') return null;
  return new ConflictError(
    status === 'SENT'
      ? 'This quotation has been sent and cannot be edited — create a revision instead'
      : `This quotation is ${status.toLowerCase()} and can no longer be edited`
  );
}

// Only a DRAFT can be deleted; anything that was sent is kept as history.
export function evaluateDeletable(status: QuotationStatus): Error | null {
  if (status === 'DRAFT') return null;
  return new ConflictError('Only a draft quotation can be deleted — a sent quotation is kept as history');
}

// Used by the Lead/Enquiry/Consultation delete guards.
export function quotationDeleteBlock(sourceLabel: string, quotationCount: number): Error | null {
  if (quotationCount > 0) {
    return new ConflictError(
      `Cannot delete: this ${sourceLabel} has ${quotationCount} quotation(s) — quotations are kept as a commercial record`
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// S2 — lifecycle (docs/wedding-os/08-quotation.md §3): send, accept, reject, revise, expire.
// ---------------------------------------------------------------------------

// Staff record how the customer said yes (no customer login or link in V1 — decision Q1).
export const ACCEPTANCE_CHANNELS = ['WHATSAPP', 'PHONE', 'IN_PERSON', 'OTHER'] as const;
export type AcceptanceChannel = (typeof ACCEPTANCE_CHANNELS)[number];

export function isPastValidity(validUntil: Date | null, now: Date): boolean {
  return validUntil !== null && validUntil.getTime() < now.getTime();
}

// A DRAFT can be sent once it has at least one line and a valid-until date in the future.
export function evaluateSendable(
  q: { status: QuotationStatus; itemCount: number; validUntil: Date | null },
  now: Date
): Error | null {
  if (q.status !== 'DRAFT') return new ConflictError('Only a draft quotation can be sent');
  if (q.itemCount < 1) return new ValidationError('Add at least one line item before sending');
  if (!q.validUntil) return new ValidationError('Set a "valid until" date before sending');
  if (q.validUntil.getTime() <= now.getTime()) return new ValidationError('The "valid until" date must be in the future');
  return null;
}

function notSentReason(status: QuotationStatus, verb: string): Error {
  if (status === 'EXPIRED') return new ConflictError('This quotation has expired — revise it to offer it again');
  if (status === 'DRAFT') return new ConflictError('This quotation has not been sent yet');
  return new ConflictError(`Only a sent quotation can be ${verb} (this one is ${status.toLowerCase()})`);
}

// Accept: only a SENT quotation still inside its validity window. (The database's partial unique index
// guarantees at most one ACCEPTED quotation per source even if two requests race.)
export function evaluateAcceptable(q: { status: QuotationStatus; validUntil: Date | null }, now: Date): Error | null {
  if (q.status !== 'SENT') return notSentReason(q.status, 'accepted');
  if (isPastValidity(q.validUntil, now)) return new ConflictError('This quotation has expired — revise it to offer it again');
  return null;
}

export function evaluateRejectable(status: QuotationStatus): Error | null {
  return status === 'SENT' ? null : notSentReason(status, 'rejected');
}

// A sent, rejected or expired quotation can be revised into a new draft. An accepted one is a deal —
// changing it is a booking question, out of V1. A draft is simply edited; a replaced one is history.
export function evaluateRevisable(status: QuotationStatus): Error | null {
  if (status === 'SENT' || status === 'REJECTED' || status === 'EXPIRED') return null;
  if (status === 'ACCEPTED') return new ConflictError('An accepted quotation cannot be revised');
  if (status === 'DRAFT') return new ConflictError('This quotation is still a draft — edit it instead');
  return new ConflictError('This quotation was already replaced by a newer revision');
}

// Discarding a revision draft brings its predecessor back: sent again if still valid, else expired.
export function statusAfterRevisionDiscarded(predecessorValidUntil: Date | null, now: Date): 'SENT' | 'EXPIRED' {
  return isPastValidity(predecessorValidUntil, now) || predecessorValidUntil === null ? 'EXPIRED' : 'SENT';
}
