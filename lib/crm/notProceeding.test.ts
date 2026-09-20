/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { LOST_REASONS } from '@/lib/crm/pipeline';
import { CANCELLED_DETAIL, describeLostReason, NOT_PROCEEDING_REASONS, toStageReason } from './notProceeding';

describe('the reasons an operator can pick', () => {
  test('are exactly the six in the approved design, in order', () => {
    expect(NOT_PROCEEDING_REASONS.map((r) => r.label)).toEqual([
      'Customer chose another option',
      'Date changed',
      'Budget changed',
      'Customer cancelled',
      'No response',
      'Other',
    ]);
  });

  test('every one is stored with a reason the existing stage route accepts (no schema change)', () => {
    for (const r of NOT_PROCEEDING_REASONS) expect(LOST_REASONS).toContain(r.lostReason);
  });
});

describe('toStageReason', () => {
  test('the direct mappings', () => {
    expect(toStageReason('CHOSE_ANOTHER', '')).toEqual({ reason: 'CHOSE_COMPETITOR', reasonDetail: undefined });
    expect(toStageReason('DATE_CHANGED', '')).toEqual({ reason: 'DATE_UNAVAILABLE', reasonDetail: undefined });
    expect(toStageReason('BUDGET_CHANGED', 'wants ₹4L')).toEqual({ reason: 'BUDGET_ISSUE', reasonDetail: 'wants ₹4L' });
    expect(toStageReason('NO_RESPONSE', '')).toEqual({ reason: 'NO_RESPONSE', reasonDetail: undefined });
  });

  test('"Customer cancelled" is stored as Other with the detail filled in for you — nothing to type', () => {
    expect(toStageReason('CUSTOMER_CANCELLED', '')).toEqual({ reason: 'OTHER', reasonDetail: CANCELLED_DETAIL });
    expect(toStageReason('CUSTOMER_CANCELLED', '  family emergency ')).toEqual({ reason: 'OTHER', reasonDetail: 'Customer cancelled — family emergency' });
  });

  test('"Other" needs a few words; blank is refused', () => {
    expect(toStageReason('OTHER', '   ')).toEqual({ error: 'Please add a few words for “Other”.' });
    expect(toStageReason('OTHER', 'Postponed a year')).toEqual({ reason: 'OTHER', reasonDetail: 'Postponed a year' });
  });
});

describe('describeLostReason — reads back what was stored', () => {
  test('a "Customer cancelled" close reads as that, not as Other', () => {
    expect(describeLostReason('OTHER', CANCELLED_DETAIL)).toEqual({ label: 'Customer cancelled', detail: null });
    expect(describeLostReason('OTHER', 'Customer cancelled — family emergency')).toEqual({ label: 'Customer cancelled', detail: 'family emergency' });
  });

  test('a genuine Other keeps its own words', () => {
    expect(describeLostReason('OTHER', 'Postponed a year')).toEqual({ label: 'Other', detail: 'Postponed a year' });
  });

  test('the other stored reasons read in the operator’s words', () => {
    expect(describeLostReason('CHOSE_COMPETITOR', null).label).toBe('Customer chose another option');
    expect(describeLostReason('BUDGET_ISSUE', null).label).toBe('Budget changed');
    expect(describeLostReason('NO_RESPONSE', null).label).toBe('No response');
    expect(describeLostReason('DATE_UNAVAILABLE', null).label).toContain('Date');
  });

  test('a missing reason still reads sensibly', () => {
    expect(describeLostReason(null, null).label).toBe('Marked as not proceeding');
  });

  test('round trip: what we store is what we read back, for every option', () => {
    for (const r of NOT_PROCEEDING_REASONS) {
      const stored = toStageReason(r.key, r.needsDetail ? 'some words' : '');
      if ('error' in stored) throw new Error('unexpected');
      const back = describeLostReason(stored.reason, stored.reasonDetail);
      expect(back.label.length).toBeGreaterThan(0);
      if (r.key === 'CUSTOMER_CANCELLED') expect(back.label).toBe('Customer cancelled');
    }
  });
});
