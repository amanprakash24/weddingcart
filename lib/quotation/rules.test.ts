/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { ConflictError, ConversionLockedError, NotFoundError, ValidationError } from '@/lib/errors';
import {
  ACCEPTANCE_CHANNELS,
  evaluateAcceptable,
  evaluateDeletable,
  evaluateEditable,
  evaluateQuotable,
  evaluateRejectable,
  evaluateRevisable,
  evaluateSendable,
  isPastValidity,
  quotationDeleteBlock,
  statusAfterRevisionDiscarded,
} from './rules';

const base = {
  sourceLabel: 'enquiry',
  sourceType: 'ENQUIRY',
  sourceId: 'e1',
  sourceExists: true,
  wedding: null,
  accepted: null,
  open: null,
};

describe('evaluateQuotable — can a new quotation be started for this source?', () => {
  test('allows a source that exists and has no wedding, accepted or open quotation', () => {
    expect(evaluateQuotable(base)).toBeNull();
  });

  test('a missing source is NotFound', () => {
    expect(evaluateQuotable({ ...base, sourceExists: false })).toBeInstanceOf(NotFoundError);
  });

  test('a source that already became a Wedding is locked (409) and the message names the wedding', () => {
    const err = evaluateQuotable({ ...base, wedding: { weddingNumber: 'WED-2026-0001' } });
    expect(err).toBeInstanceOf(ConversionLockedError);
    expect(err?.message).toContain('WED-2026-0001');
  });

  test('an accepted quotation blocks another one', () => {
    const err = evaluateQuotable({ ...base, accepted: { quotationNumber: 'QTN-202609-0001' } });
    expect(err).toBeInstanceOf(ConflictError);
    expect(err?.message).toContain('accepted quotation (QTN-202609-0001)');
  });

  test('an open quotation blocks another one and says to finish it first', () => {
    const err = evaluateQuotable({ ...base, open: { quotationNumber: 'QTN-202609-0002' } });
    expect(err).toBeInstanceOf(ConflictError);
    expect(err?.message).toContain('open quotation (QTN-202609-0002)');
  });

  test('priority: missing source > converted > accepted > open', () => {
    const all = { ...base, wedding: { weddingNumber: 'W' }, accepted: { quotationNumber: 'A' }, open: { quotationNumber: 'O' } };
    expect(evaluateQuotable({ ...all, sourceExists: false })).toBeInstanceOf(NotFoundError);
    expect(evaluateQuotable(all)).toBeInstanceOf(ConversionLockedError);
    expect(evaluateQuotable({ ...all, wedding: null })?.message).toContain('accepted');
  });
});

describe('evaluateEditable / evaluateDeletable — only a DRAFT changes', () => {
  test('DRAFT is editable and deletable', () => {
    expect(evaluateEditable('DRAFT')).toBeNull();
    expect(evaluateDeletable('DRAFT')).toBeNull();
  });

  test('a SENT quote must be revised, not edited', () => {
    const err = evaluateEditable('SENT');
    expect(err).toBeInstanceOf(ConflictError);
    expect(err?.message).toContain('create a revision');
  });

  test.each(['ACCEPTED', 'REJECTED', 'EXPIRED', 'SUPERSEDED'] as const)('%s is neither editable nor deletable', (status) => {
    expect(evaluateEditable(status)).toBeInstanceOf(ConflictError);
    expect(evaluateDeletable(status)).toBeInstanceOf(ConflictError);
  });

  test('SENT is not deletable either — it is kept as history', () => {
    expect(evaluateDeletable('SENT')?.message).toContain('kept as history');
  });
});

describe('quotationDeleteBlock — used by the Lead/Enquiry/Consultation delete guards', () => {
  test('allows deleting a source with no quotations', () => {
    expect(quotationDeleteBlock('enquiry', 0)).toBeNull();
  });

  test('refuses with a clear 409 message when quotations exist', () => {
    const err = quotationDeleteBlock('consultation', 2);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err?.message).toBe('Cannot delete: this consultation has 2 quotation(s) — quotations are kept as a commercial record');
  });
});

// ---------------------------------------------------------------------------
// S2 — lifecycle
// ---------------------------------------------------------------------------
const NOW = new Date('2026-09-20T10:00:00Z');
const FUTURE = new Date('2026-10-01T18:29:59Z');
const PAST = new Date('2026-09-19T18:29:59Z');

describe('isPastValidity', () => {
  test('no valid-until date never expires; a past date has passed; the future has not', () => {
    expect(isPastValidity(null, NOW)).toBe(false);
    expect(isPastValidity(PAST, NOW)).toBe(true);
    expect(isPastValidity(FUTURE, NOW)).toBe(false);
  });
});

describe('evaluateSendable', () => {
  const ok = { status: 'DRAFT' as const, itemCount: 2, validUntil: FUTURE };

  test('a DRAFT with lines and a future valid-until date can be sent', () => {
    expect(evaluateSendable(ok, NOW)).toBeNull();
  });

  test.each(['SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'SUPERSEDED'] as const)('%s cannot be sent again (409)', (status) => {
    expect(evaluateSendable({ ...ok, status }, NOW)).toBeInstanceOf(ConflictError);
  });

  test('no lines is a 400', () => {
    const err = evaluateSendable({ ...ok, itemCount: 0 }, NOW);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err?.message).toContain('at least one line');
  });

  test('a missing or past valid-until date is a 400 with a clear message', () => {
    expect(evaluateSendable({ ...ok, validUntil: null }, NOW)?.message).toContain('"valid until" date before sending');
    expect(evaluateSendable({ ...ok, validUntil: PAST }, NOW)?.message).toContain('must be in the future');
    // exactly now is not "in the future"
    expect(evaluateSendable({ ...ok, validUntil: NOW }, NOW)).toBeInstanceOf(ValidationError);
  });
});

describe('evaluateAcceptable / evaluateRejectable — only a SENT, still-valid quotation', () => {
  test('SENT and inside its window can be accepted and rejected', () => {
    expect(evaluateAcceptable({ status: 'SENT', validUntil: FUTURE }, NOW)).toBeNull();
    expect(evaluateRejectable('SENT')).toBeNull();
  });

  test('a SENT quotation past its valid-until date cannot be accepted, even if not yet marked EXPIRED', () => {
    const err = evaluateAcceptable({ status: 'SENT', validUntil: PAST }, NOW);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err?.message).toContain('expired');
  });

  test('a DRAFT has not been sent, an EXPIRED one says so, others name their status', () => {
    expect(evaluateAcceptable({ status: 'DRAFT', validUntil: FUTURE }, NOW)?.message).toContain('not been sent');
    expect(evaluateAcceptable({ status: 'EXPIRED', validUntil: PAST }, NOW)?.message).toContain('expired');
    expect(evaluateAcceptable({ status: 'ACCEPTED', validUntil: FUTURE }, NOW)?.message).toContain('accepted');
    expect(evaluateRejectable('REJECTED')?.message).toContain('rejected');
    expect(evaluateRejectable('SUPERSEDED')).toBeInstanceOf(ConflictError);
  });

  test('the recorded channels are exactly the four V1 options', () => {
    expect([...ACCEPTANCE_CHANNELS]).toEqual(['WHATSAPP', 'PHONE', 'IN_PERSON', 'OTHER']);
  });
});

describe('evaluateRevisable', () => {
  test.each(['SENT', 'REJECTED', 'EXPIRED'] as const)('%s can be revised', (status) => {
    expect(evaluateRevisable(status)).toBeNull();
  });

  test('an accepted quotation is a deal and cannot be revised', () => {
    expect(evaluateRevisable('ACCEPTED')?.message).toContain('cannot be revised');
  });

  test('a draft is edited instead, and a replaced quotation is history', () => {
    expect(evaluateRevisable('DRAFT')?.message).toContain('edit it instead');
    expect(evaluateRevisable('SUPERSEDED')?.message).toContain('already replaced');
  });
});

describe('statusAfterRevisionDiscarded — abandoning a revision restores the previous quote', () => {
  test('sent again if its valid-until date is still ahead', () => {
    expect(statusAfterRevisionDiscarded(FUTURE, NOW)).toBe('SENT');
  });

  test('expired if the date has passed or there was none', () => {
    expect(statusAfterRevisionDiscarded(PAST, NOW)).toBe('EXPIRED');
    expect(statusAfterRevisionDiscarded(null, NOW)).toBe('EXPIRED');
  });
});
