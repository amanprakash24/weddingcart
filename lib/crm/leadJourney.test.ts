/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import {
  bookingChip,
  deriveJourney,
  journeySteps,
  nextAction,
  pickCurrentQuotation,
  quotationChip,
  type JourneyQuotation,
  type NextActionContext,
  type QuoteStatus,
  type BookingStatus,
} from './leadJourney';

const q = (status: QuoteStatus, booking: BookingStatus | null = null, createdAt = '2026-09-18T10:00:00Z'): JourneyQuotation => ({
  status,
  booking: booking ? { status: booking } : null,
  createdAt,
});

const ctx: NextActionContext = {
  sourceType: 'ENQUIRY',
  customerName: 'Rahul & Priya',
  canSend: true,
  sentOn: '18 Sep 2026',
  validUntil: '27 Sep 2026',
  acceptedOn: '21 Sep 2026',
  acceptedVia: 'WhatsApp',
  weddingNumber: 'WED-2026-0003',
  closedReason: 'Customer chose another option',
  followUps: 0,
};
const stepCtx = { enquiryOn: '15 Sep', sentOn: '18 Sep', acceptedOn: '21 Sep', acceptedVia: 'WhatsApp', weddingNumber: 'WED-2026-0003' };

describe('pickCurrentQuotation', () => {
  test('nothing quoted → null', () => {
    expect(pickCurrentQuotation([])).toBeNull();
    expect(pickCurrentQuotation(null)).toBeNull();
  });
  test('the accepted quote wins over everything', () => {
    const accepted = q('ACCEPTED');
    expect(pickCurrentQuotation([q('DRAFT'), accepted, q('SUPERSEDED')])).toBe(accepted);
  });
  test('otherwise the open one (draft or sent); replaced revisions are never current', () => {
    const sent = q('SENT');
    expect(pickCurrentQuotation([q('SUPERSEDED'), sent])).toBe(sent);
    expect(pickCurrentQuotation([q('SUPERSEDED')])).toBeNull();
  });
  test('otherwise the most recent quote that ended', () => {
    const older = q('REJECTED', null, '2026-09-10T00:00:00Z');
    const newer = q('EXPIRED', null, '2026-09-15T00:00:00Z');
    expect(pickCurrentQuotation([older, newer])).toBe(newer);
  });
});

describe('deriveJourney — the six states, from data that already exists', () => {
  const state = (pipelineStage: Parameters<typeof deriveJourney>[0]['pipelineStage'], quotation: JourneyQuotation | null, hasWedding = false) =>
    deriveJourney({ pipelineStage, hasWedding, quotation });

  test('no quote / draft / sent', () => {
    expect(state('QUALIFIED', null)).toBe('NO_QUOTE');
    expect(state('SITE_VISIT_SCHEDULED', q('DRAFT'))).toBe('DRAFT');
    expect(state('QUOTATION_SENT', q('SENT'))).toBe('SENT');
  });

  test('a declined or expired quote is "lapsed", not a dead end', () => {
    expect(state('QUOTATION_SENT', q('REJECTED'))).toBe('LAPSED');
    expect(state('QUOTATION_SENT', q('EXPIRED'))).toBe('LAPSED');
  });

  test('ACCEPTED does not depend on — or change — the lead stage', () => {
    for (const stage of ['SITE_VISIT_SCHEDULED', 'QUOTATION_SENT', 'NEGOTIATION'] as const) {
      expect(state(stage, q('ACCEPTED'))).toBe('ACCEPTED');
    }
  });

  test('accepted + a booking that is not confirmed → booking pending; a NEW or CONTACTED booking both count', () => {
    expect(state('QUOTATION_SENT', q('ACCEPTED', 'NEW'))).toBe('BOOKING_PENDING');
    expect(state('QUOTATION_SENT', q('ACCEPTED', 'CONTACTED'))).toBe('BOOKING_PENDING');
  });

  test('a booking marked confirmed with no wedding yet is still "pending" — confirming again retries the wedding', () => {
    expect(state('QUOTATION_SENT', q('ACCEPTED', 'CONFIRMED'))).toBe('BOOKING_PENDING');
  });

  test('a wedding means confirmed, whatever else is true', () => {
    expect(state('QUOTATION_SENT', q('ACCEPTED', 'CONFIRMED'), true)).toBe('BOOKING_CONFIRMED');
    expect(state('WON', null, true)).toBe('BOOKING_CONFIRMED');
  });

  test('lost → not proceeding, even after an acceptance (the acceptance is kept elsewhere, never erased)', () => {
    expect(state('LOST', q('ACCEPTED'))).toBe('NOT_PROCEEDING');
    expect(state('LOST', null)).toBe('NOT_PROCEEDING');
  });

  test('a closed booking also reads as not proceeding', () => {
    expect(state('QUOTATION_SENT', q('ACCEPTED', 'CLOSED'))).toBe('NOT_PROCEEDING');
  });

  test('CRM path: a Booked lead without its wedding workspace is ready to convert', () => {
    expect(state('WON', q('ACCEPTED'))).toBe('READY_TO_CONVERT');
  });
});

describe('status chips keep quotation, lead and booking separate', () => {
  test('accepted is amber (never green) until the booking is confirmed', () => {
    const accepted = q('ACCEPTED');
    expect(quotationChip(accepted, 'ACCEPTED')).toEqual({ label: 'Accepted', tone: 'amber' });
    expect(quotationChip(accepted, 'BOOKING_PENDING').tone).toBe('amber');
    expect(quotationChip(accepted, 'BOOKING_CONFIRMED').tone).toBe('green');
    expect(quotationChip(accepted, 'NOT_PROCEEDING').tone).toBe('slate');
  });
  test('booking chip: not created → pending → confirmed / closed', () => {
    expect(bookingChip(q('ACCEPTED'), 'ACCEPTED')).toEqual({ label: 'Not created', tone: 'dashed' });
    expect(bookingChip(q('ACCEPTED', 'NEW'), 'BOOKING_PENDING')).toEqual({ label: 'Pending', tone: 'amber' });
    expect(bookingChip(q('ACCEPTED', 'CONFIRMED'), 'BOOKING_CONFIRMED')).toEqual({ label: 'Confirmed', tone: 'green' });
    expect(bookingChip(q('ACCEPTED', 'CLOSED'), 'NOT_PROCEEDING')).toEqual({ label: 'Closed', tone: 'slate' });
    expect(bookingChip(q('ACCEPTED'), 'NOT_PROCEEDING')).toEqual({ label: 'Not proceeding', tone: 'slate' });
  });
  test('only a confirmed booking is ever green', () => {
    const states = ['NO_QUOTE', 'DRAFT', 'SENT', 'LAPSED', 'ACCEPTED', 'BOOKING_PENDING', 'READY_TO_CONVERT', 'NOT_PROCEEDING'] as const;
    for (const s of states) {
      expect(bookingChip(q('ACCEPTED', 'NEW'), s).tone).not.toBe('green');
    }
  });
});

describe('nextAction — exactly one primary action per state', () => {
  test.each([
    ['NO_QUOTE', 'create-quote'],
    ['DRAFT', 'send-quote'],
    ['SENT', 'follow-up'],
    ['LAPSED', 'revise-quote'],
    ['ACCEPTED', 'create-booking'],
    ['BOOKING_PENDING', 'confirm-booking'],
    ['BOOKING_CONFIRMED', 'manage-wedding'],
    ['READY_TO_CONVERT', 'create-wedding'],
    ['NOT_PROCEEDING', 'view-reason'],
  ] as const)('%s → %s', (state, id) => {
    expect(nextAction(state, ctx).id).toBe(id);
  });

  test('a draft that cannot be sent yet asks to finish it instead', () => {
    expect(nextAction('DRAFT', { ...ctx, canSend: false }).id).toBe('finish-quote');
  });

  test('a sent quote offers the customer’s answer as secondary actions, not as a second primary', () => {
    const sent = nextAction('SENT', ctx);
    expect(sent.secondary.map((s) => s.id)).toEqual(['customer-accepted', 'customer-declined', 'revise-quote']);
    expect(sent.label).toContain('Follow up');
  });

  test('only the two "deal is live but not yet a wedding" states offer Not proceeding', () => {
    for (const state of ['ACCEPTED', 'BOOKING_PENDING'] as const) {
      expect(nextAction(state, ctx).secondary.map((s) => s.id)).toContain('not-proceeding');
    }
    for (const state of ['NO_QUOTE', 'DRAFT', 'SENT', 'BOOKING_CONFIRMED', 'READY_TO_CONVERT', 'NOT_PROCEEDING'] as const) {
      expect(nextAction(state, ctx).secondary.map((s) => s.id)).not.toContain('not-proceeding');
    }
  });

  test('accepted says plainly that it is not yet a confirmed booking', () => {
    expect(nextAction('ACCEPTED', ctx).why).toContain('not a confirmed booking');
  });

  test('a lead-sourced quote cannot make a booking, so it is marked Booked through the CRM first', () => {
    expect(nextAction('ACCEPTED', { ...ctx, sourceType: 'LEAD' }).id).toBe('mark-booked');
  });

  test('the wedding number and the closing reason come from the data, not from fixed text', () => {
    expect(nextAction('BOOKING_CONFIRMED', { ...ctx, weddingNumber: 'WED-2027-0042' }).why).toContain('WED-2027-0042');
    expect(nextAction('NOT_PROCEEDING', { ...ctx, closedReason: 'Budget changed' }).why).toBe('Budget changed');
  });

  test('no message hard-codes an amount', () => {
    for (const state of ['NO_QUOTE', 'DRAFT', 'SENT', 'LAPSED', 'ACCEPTED', 'BOOKING_PENDING', 'BOOKING_CONFIRMED', 'READY_TO_CONVERT', 'NOT_PROCEEDING'] as const) {
      expect(nextAction(state, ctx).why).not.toContain('₹');
    }
  });
});

describe('journeySteps', () => {
  const statuses = (state: Parameters<typeof journeySteps>[0], quotation: JourneyQuotation | null) => journeySteps(state, quotation, stepCtx).map((s) => s.status);

  test('draft → the quote step is current', () => {
    expect(statuses('DRAFT', q('DRAFT'))).toEqual(['done', 'current', 'upcoming', 'upcoming', 'upcoming']);
  });
  test('sent → waiting for the customer at Accepted', () => {
    expect(statuses('SENT', q('SENT'))).toEqual(['done', 'done', 'current', 'upcoming', 'upcoming']);
  });
  test('accepted → the booking is the current step and is not yet created', () => {
    const steps = journeySteps('ACCEPTED', q('ACCEPTED'), stepCtx);
    expect(steps.map((s) => s.status)).toEqual(['done', 'done', 'done', 'current', 'upcoming']);
    expect(steps[3].sub).toBe('Not created yet');
  });
  test('booking pending → still amber-stage: the booking step is current, the wedding upcoming', () => {
    expect(statuses('BOOKING_PENDING', q('ACCEPTED', 'NEW'))).toEqual(['done', 'done', 'done', 'current', 'upcoming']);
  });
  test('confirmed → booking and wedding are the only green steps', () => {
    expect(statuses('BOOKING_CONFIRMED', q('ACCEPTED', 'CONFIRMED'))).toEqual(['done', 'done', 'done', 'ok', 'ok']);
  });
  test('not proceeding after acceptance keeps enquiry, quote and acceptance as done and stops at the booking', () => {
    const steps = journeySteps('NOT_PROCEEDING', q('ACCEPTED'), stepCtx);
    expect(steps.map((s) => s.status)).toEqual(['done', 'done', 'done', 'stopped', 'stopped']);
    expect(steps[2].sub).toContain('21 Sep');
    expect(steps[3].sub).toBe('Not proceeding');
  });
  test('not proceeding after a booking was made stops at the wedding', () => {
    expect(statuses('NOT_PROCEEDING', q('ACCEPTED', 'CLOSED'))).toEqual(['done', 'done', 'done', 'done', 'stopped']);
  });
  test('not proceeding before anything was sent stops at the quote', () => {
    expect(statuses('NOT_PROCEEDING', null)).toEqual(['done', 'stopped', 'stopped', 'stopped', 'stopped']);
  });
});
