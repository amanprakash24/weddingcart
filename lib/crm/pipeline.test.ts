/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { PIPELINE_TRANSITIONS, allowedNextStages, canTransition, canTransitionWithContext } from './pipeline';

const yes = { hasAcceptedQuotation: true };
const no = { hasAcceptedQuotation: false };

describe('canTransitionWithContext — QUOTATION_SENT → WON needs an accepted quotation (decision Q2)', () => {
  test('QUOTATION_SENT → WON is allowed only when an accepted quotation exists', () => {
    expect(canTransitionWithContext('QUOTATION_SENT', 'WON', yes)).toBe(true);
    expect(canTransitionWithContext('QUOTATION_SENT', 'WON', no)).toBe(false);
  });

  test('the base map is unchanged: the shortcut does not exist without the context', () => {
    expect(canTransition('QUOTATION_SENT', 'WON')).toBe(false);
    expect(PIPELINE_TRANSITIONS.QUOTATION_SENT).toEqual(['NEGOTIATION', 'ON_HOLD', 'LOST']);
  });

  test('the old route via Negotiation still works with or without an accepted quotation', () => {
    expect(canTransitionWithContext('QUOTATION_SENT', 'NEGOTIATION', no)).toBe(true);
    expect(canTransitionWithContext('NEGOTIATION', 'WON', no)).toBe(true);
  });

  test('an accepted quotation opens no other shortcut', () => {
    for (const from of ['NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT_SCHEDULED', 'ON_HOLD'] as const) {
      expect(canTransitionWithContext(from, 'WON', yes)).toBe(false);
    }
    expect(canTransitionWithContext('QUOTATION_SENT', 'CONTACTED', yes)).toBe(false);
    expect(canTransitionWithContext('WON', 'QUOTATION_SENT', yes)).toBe(false);
    expect(canTransitionWithContext('LOST', 'WON', yes)).toBe(false);
  });

  test('every ordinary transition behaves exactly as canTransition regardless of context', () => {
    for (const from of Object.keys(PIPELINE_TRANSITIONS) as (keyof typeof PIPELINE_TRANSITIONS)[]) {
      for (const to of Object.keys(PIPELINE_TRANSITIONS) as (keyof typeof PIPELINE_TRANSITIONS)[]) {
        if (from === 'QUOTATION_SENT' && to === 'WON') continue;
        expect(canTransitionWithContext(from, to, yes)).toBe(canTransition(from, to));
        expect(canTransitionWithContext(from, to, no)).toBe(canTransition(from, to));
      }
    }
  });
});

describe('allowedNextStages — what the stage control offers (display only)', () => {
  test('offers Won from Quotation Sent only with an accepted quotation, without duplicating it', () => {
    expect(allowedNextStages('QUOTATION_SENT', yes)).toEqual(['NEGOTIATION', 'ON_HOLD', 'LOST', 'WON']);
    expect(allowedNextStages('QUOTATION_SENT', no)).toEqual(['NEGOTIATION', 'ON_HOLD', 'LOST']);
    expect(allowedNextStages('NEGOTIATION', yes).filter((s) => s === 'WON')).toHaveLength(1);
  });

  test('other stages are exactly the base map', () => {
    expect(allowedNextStages('NEW', yes)).toEqual(PIPELINE_TRANSITIONS.NEW);
    expect(allowedNextStages('WON', yes)).toEqual([]);
  });
});
