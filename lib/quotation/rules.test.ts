/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { ConflictError, ConversionLockedError, NotFoundError } from '@/lib/errors';
import { evaluateDeletable, evaluateEditable, evaluateQuotable, quotationDeleteBlock } from './rules';

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
