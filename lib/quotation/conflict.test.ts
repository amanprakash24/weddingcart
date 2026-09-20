/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { describeSourceConflict } from './conflict';

const q = (quotationNumber: string, status: string, revision = 1) => ({ quotationNumber, status, revision });

describe('describeSourceConflict', () => {
  test('names the open quotation involved and tells the operator what to do', () => {
    const text = describeSourceConflict('consultation', [q('QTN-202609-0002', 'SENT')]);
    expect(text).toContain('already has an open quotation: QTN-202609-0002 (sent)');
    expect(text).toContain('refresh the page');
  });
  test('a draft revision is named with its revision number', () => {
    expect(describeSourceConflict('enquiry', [q('QTN-1', 'SUPERSEDED'), q('QTN-2', 'DRAFT', 2)])).toContain('QTN-2 (draft, revision 2)');
  });
  test('an accepted quotation with nothing open reads as accepted', () => {
    expect(describeSourceConflict('enquiry', [q('QTN-1', 'ACCEPTED')])).toBe('This enquiry already has an accepted quotation: QTN-1 (accepted).');
  });
  test('when the database complains but nothing open is visible, it lists exactly what is there', () => {
    const text = describeSourceConflict('lead', [q('QTN-1', 'EXPIRED'), q('QTN-2', 'SUPERSEDED')]);
    expect(text).toContain('none is visible now');
    expect(text).toContain('QTN-1 (expired), QTN-2 (replaced)');
  });
  test('a lead with no quotations at all says so', () => {
    expect(describeSourceConflict('lead', [])).toContain('quotations on this lead: none');
  });
  test('never leaks a rule name', () => {
    expect(describeSourceConflict('lead', [q('QTN-1', 'SENT')])).not.toMatch(/COALESCE|_key|constraint/i);
  });
});
