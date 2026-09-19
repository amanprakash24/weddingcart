// Pure decisions behind quotationService, extracted so the exact rules are unit-testable
// without mocking prisma/repositories (mock.module() intercepts by resolved file path and
// can hijack other test files' own real imports — see services/enquiry.service.ts).
import type { QuotationStatus } from '@/generated/prisma/enums';
import { ConflictError, ConversionLockedError, NotFoundError } from '@/lib/errors';

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
