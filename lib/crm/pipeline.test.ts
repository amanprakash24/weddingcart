/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { PIPELINE_TRANSITIONS, SYSTEM_ONLY_STAGES, allowedNextStages, canTransition, isSystemOnlyStage } from './pipeline';
import { stageAfterEvent, type CommercialEvent } from './stageEvents';
import type { PipelineStage } from '@/generated/prisma/enums';

const ALL = Object.keys(PIPELINE_TRANSITIONS) as PipelineStage[];

describe('the manual pipeline (commercial V1)', () => {
  test('the full map, written out so any accidental change shows up', () => {
    expect(PIPELINE_TRANSITIONS).toEqual({
      NEW: ['CONTACTED', 'QUOTATION_SENT', 'LOST'],
      CONTACTED: ['QUALIFIED', 'QUOTATION_SENT', 'ON_HOLD', 'LOST'],
      QUALIFIED: ['SITE_VISIT_SCHEDULED', 'QUOTATION_SENT', 'ON_HOLD', 'LOST'],
      SITE_VISIT_SCHEDULED: ['QUOTATION_SENT', 'ON_HOLD', 'LOST'],
      QUOTATION_SENT: ['NEGOTIATION', 'ACCEPTED', 'ON_HOLD', 'LOST'],
      NEGOTIATION: ['ACCEPTED', 'ON_HOLD', 'LOST'],
      ACCEPTED: ['WON', 'LOST'],
      ON_HOLD: ['CONTACTED', 'QUALIFIED', 'SITE_VISIT_SCHEDULED', 'QUOTATION_SENT', 'NEGOTIATION', 'ACCEPTED', 'LOST'],
      WON: [],
      LOST: [],
    });
  });

  test('Booked (WON) and Lost are final', () => {
    expect(PIPELINE_TRANSITIONS.WON).toEqual([]);
    expect(PIPELINE_TRANSITIONS.LOST).toEqual([]);
  });

  test('a booked deal cannot go back, and nothing leaves Lost', () => {
    for (const to of ALL) {
      expect(canTransition('WON', to)).toBe(false);
      expect(canTransition('LOST', to)).toBe(false);
    }
  });

  test('a lead cannot jump straight to Booked from anywhere but Accepted', () => {
    for (const from of ALL.filter((s) => s !== 'ACCEPTED')) expect(canTransition(from, 'WON')).toBe(false);
    expect(canTransition('ACCEPTED', 'WON')).toBe(true);
  });

  test('an accepted deal can still fall through to Lost before the booking is confirmed', () => {
    expect(canTransition('ACCEPTED', 'LOST')).toBe(true);
  });
});

describe('allowedNextStages — what the stage control offers (display only)', () => {
  test('Accepted and Booked are never offered by hand', () => {
    expect(SYSTEM_ONLY_STAGES).toEqual(['ACCEPTED', 'WON']);
    for (const from of ALL) {
      const offered = allowedNextStages(from);
      expect(offered.some(isSystemOnlyStage)).toBe(false);
    }
  });

  test('everything else is the base map', () => {
    expect(allowedNextStages('NEW')).toEqual(['CONTACTED', 'QUOTATION_SENT', 'LOST']);
    expect(allowedNextStages('QUOTATION_SENT')).toEqual(['NEGOTIATION', 'ON_HOLD', 'LOST']);
    expect(allowedNextStages('ACCEPTED')).toEqual(['LOST']);
    expect(allowedNextStages('WON')).toEqual([]);
  });
});

// The automatic moves. Written out as a full table so every (stage, event) pair is decided on purpose.
describe('stageAfterEvent — the stage follows the commercial facts', () => {
  const table: Record<CommercialEvent, Partial<Record<PipelineStage, PipelineStage>>> = {
    QUOTE_SENT: { NEW: 'QUOTATION_SENT', CONTACTED: 'QUOTATION_SENT', QUALIFIED: 'QUOTATION_SENT', SITE_VISIT_SCHEDULED: 'QUOTATION_SENT', ON_HOLD: 'QUOTATION_SENT' },
    QUOTE_REVISED: {
      NEW: 'NEGOTIATION', CONTACTED: 'NEGOTIATION', QUALIFIED: 'NEGOTIATION', SITE_VISIT_SCHEDULED: 'NEGOTIATION', ON_HOLD: 'NEGOTIATION', QUOTATION_SENT: 'NEGOTIATION',
    },
    QUOTE_ACCEPTED: {
      NEW: 'ACCEPTED', CONTACTED: 'ACCEPTED', QUALIFIED: 'ACCEPTED', SITE_VISIT_SCHEDULED: 'ACCEPTED', ON_HOLD: 'ACCEPTED', QUOTATION_SENT: 'ACCEPTED', NEGOTIATION: 'ACCEPTED',
    },
    BOOKING_CONFIRMED: {
      NEW: 'WON', CONTACTED: 'WON', QUALIFIED: 'WON', SITE_VISIT_SCHEDULED: 'WON', QUOTATION_SENT: 'WON', NEGOTIATION: 'WON', ACCEPTED: 'WON', ON_HOLD: 'WON',
    },
  };

  for (const event of Object.keys(table) as CommercialEvent[]) {
    test(`${event}: every stage`, () => {
      for (const stage of ALL) {
        expect(stageAfterEvent(stage, event)).toBe(table[event][stage] ?? null);
      }
    });
  }

  test('Lost and Booked are never touched by any event', () => {
    for (const event of Object.keys(table) as CommercialEvent[]) {
      expect(stageAfterEvent('LOST', event)).toBeNull();
      expect(stageAfterEvent('WON', event)).toBeNull();
    }
  });

  test('the journey, in order: sent → revised → accepted → booked', () => {
    let stage: PipelineStage = 'NEW';
    const step = (event: CommercialEvent) => {
      const next = stageAfterEvent(stage, event);
      if (next) stage = next;
      return stage;
    };
    expect(step('QUOTE_SENT')).toBe('QUOTATION_SENT');
    expect(step('QUOTE_REVISED')).toBe('NEGOTIATION');
    expect(step('QUOTE_SENT')).toBe('NEGOTIATION'); // sending the revision does not move it back
    expect(step('QUOTE_REVISED')).toBe('NEGOTIATION'); // a second revision stays
    expect(step('QUOTE_ACCEPTED')).toBe('ACCEPTED');
    expect(step('QUOTE_SENT')).toBe('ACCEPTED');
    expect(step('BOOKING_CONFIRMED')).toBe('WON');
  });

  test('an event never moves a lead backwards', () => {
    const rank: Record<PipelineStage, number> = { NEW: 0, CONTACTED: 1, QUALIFIED: 2, SITE_VISIT_SCHEDULED: 3, ON_HOLD: 3, QUOTATION_SENT: 4, NEGOTIATION: 5, ACCEPTED: 6, WON: 7, LOST: 7 };
    for (const event of Object.keys(table) as CommercialEvent[]) {
      for (const stage of ALL) {
        const next = stageAfterEvent(stage, event);
        if (next) expect(rank[next]).toBeGreaterThan(rank[stage]);
      }
    }
  });
});
