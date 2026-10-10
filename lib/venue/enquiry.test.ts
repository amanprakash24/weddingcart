/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { ACTION_ORDER, CHANNELS, nextAction, validateNewEnquiry, whatsappTo, type FollowUp, historyFor } from './enquiry';

// A venue's own enquiries (Phase C). Pure.
const TODAY = '2026-10-04';
const NOW = new Date('2026-10-04T06:00:00Z'); // 11:30 in India

describe('+ New Enquiry', () => {
  test('only name, mobile and where they came from are needed', () => {
    expect(validateNewEnquiry({ name: '  Rahul   Kumar ', phone: '+91 98765 43210', channel: 'PHONE' }, TODAY)).toEqual({
      ok: true, value: { name: 'Rahul Kumar', phone: '9876543210', weddingDate: '', guestCount: 0, need: null, channel: 'PHONE' },
    });
    expect(validateNewEnquiry({ name: 'Rahul', phone: '09876543210', weddingDate: '2026-11-18', guestCount: '350', need: ' Lawn + veg catering ', channel: 'WALK_IN' }, TODAY)).toEqual({
      ok: true, value: { name: 'Rahul', phone: '9876543210', weddingDate: '2026-11-18', guestCount: 350, need: 'Lawn + veg catering', channel: 'WALK_IN' },
    });
  });

  test('each problem is reported on its own field, in plain words', () => {
    const r = validateNewEnquiry({ name: 'R', phone: '12345', weddingDate: '2026-01-01', guestCount: '-3', channel: 'PIGEON' }, TODAY);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(['channel', 'guestCount', 'name', 'phone', 'weddingDate']);
    expect(r.errors.phone).toContain('10-digit mobile');
    expect(r.errors.weddingDate).toContain('already passed');
  });

  test('every channel is accepted', () => {
    for (const channel of CHANNELS) expect(validateNewEnquiry({ name: 'Rahul', phone: '9876543210', channel }, TODAY).ok).toBe(true);
  });
});

describe('what to do next — one action', () => {
  const fu = (id: string, dueAt: string | null, done = false): FollowUp => ({ id, title: 'Follow up', dueAt, done });
  const base = { name: 'Rahul Kumar', contacted: false, closed: false, followUps: [] as FollowUp[] };

  test('nobody has spoken to them: call', () => {
    expect(nextAction(base, NOW)).toEqual({ kind: 'CALL', label: 'Call Rahul' });
  });

  test('spoken to, nothing planned: plan the next step', () => {
    expect(nextAction({ ...base, contacted: true }, NOW)).toEqual({ kind: 'SCHEDULE', label: 'Plan the next step with Rahul' });
  });

  test('the earliest open follow-up decides: late, today, later (India time)', () => {
    expect(nextAction({ ...base, followUps: [fu('a', '2026-10-02T06:30:00Z')] }, NOW)).toMatchObject({ kind: 'FOLLOW_UP_OVERDUE', followUpId: 'a' });
    expect(nextAction({ ...base, followUps: [fu('b', '2026-10-04T18:00:00Z')] }, NOW).kind).toBe('FOLLOW_UP_TODAY'); // 23:30 IST — still today in India
    expect(nextAction({ ...base, followUps: [fu('b2', '2026-10-04T19:00:00Z')] }, NOW).kind).toBe('FOLLOW_UP_LATER'); // 00:30 IST on 5 Oct
    expect(nextAction({ ...base, followUps: [fu('c', '2026-10-04T12:00:00Z')] }, NOW)).toMatchObject({ kind: 'FOLLOW_UP_TODAY', label: 'Follow up with Rahul today' });
    expect(nextAction({ ...base, followUps: [fu('d', '2026-10-09T06:30:00Z'), fu('e', '2026-10-06T06:30:00Z')] }, NOW)).toMatchObject({ kind: 'FOLLOW_UP_LATER', followUpId: 'e' });
  });

  test('done follow-ups do not count; a closed enquiry needs nothing', () => {
    expect(nextAction({ ...base, contacted: true, followUps: [fu('a', '2026-10-02T06:30:00Z', true)] }, NOW).kind).toBe('SCHEDULE');
    expect(nextAction({ ...base, closed: true, followUps: [fu('a', '2026-10-02T06:30:00Z')] }, NOW).kind).toBe('CLOSED');
  });

  test('the couple’s answer first, then late, then people nobody has called, then today', () => {
    expect(ACTION_ORDER.slice(0, 6)).toEqual(['PAYMENT_TO_CHECK', 'QUOTE_ACCEPTED', 'QUOTE_CHANGES', 'FOLLOW_UP_OVERDUE', 'CALL', 'FOLLOW_UP_TODAY']);
    expect(ACTION_ORDER.indexOf('QUOTE_DRAFT')).toBeLessThan(ACTION_ORDER.indexOf('QUOTE_WAITING'));
    expect(ACTION_ORDER.slice(-2)).toEqual(['BOOKED', 'CLOSED']);
  });

  test('a quotation decides the next step: the couple’s answer before anything else', () => {
    const late = [fu('a', '2026-10-02T06:30:00Z')];
    expect(nextAction({ ...base, quote: 'ACCEPTED', followUps: late }, NOW)).toEqual({ kind: 'QUOTE_ACCEPTED', label: 'Rahul accepted your quotation' });
    expect(nextAction({ ...base, quote: 'CHANGES', followUps: late }, NOW)).toEqual({ kind: 'QUOTE_CHANGES', label: 'Rahul asked for changes to the quotation' });
  });

  test('accepted and the amount to confirm received: the booking is confirmed', () => {
    expect(nextAction({ ...base, quote: 'ACCEPTED', booked: true }, NOW)).toEqual({ kind: 'BOOKED', label: 'Booking confirmed for Rahul' });
    expect(nextAction({ ...base, quote: 'ACCEPTED', booked: false }, NOW).kind).toBe('QUOTE_ACCEPTED');
    // The couple said "I have paid" on their link: that comes first, booked or not — and never on a closed enquiry.
    expect(nextAction({ ...base, quote: 'ACCEPTED', booked: false, paymentToCheck: true }, NOW)).toEqual({ kind: 'PAYMENT_TO_CHECK', label: 'Rahul says they have paid — check and confirm it' });
    expect(nextAction({ ...base, quote: 'ACCEPTED', booked: true, paymentToCheck: true }, NOW).kind).toBe('PAYMENT_TO_CHECK');
    expect(nextAction({ ...base, closed: true, quote: 'ACCEPTED', paymentToCheck: true }, NOW).kind).toBe('CLOSED');
    expect(nextAction({ ...base, quote: 'SENT', booked: true }, NOW).kind).toBe('QUOTE_WAITING'); // never without an accepted quotation
  });

  test('a draft waits to be sent and a sent one waits for the couple — but a due follow-up is shown first', () => {
    expect(nextAction({ ...base, quote: 'DRAFT' }, NOW)).toEqual({ kind: 'QUOTE_DRAFT', label: 'Finish and send the quotation to Rahul' });
    expect(nextAction({ ...base, contacted: true, quote: 'SENT' }, NOW)).toEqual({ kind: 'QUOTE_WAITING', label: 'Waiting for Rahul to answer the quotation' });
    expect(nextAction({ ...base, quote: 'SENT', followUps: [fu('a', '2026-10-02T06:30:00Z')] }, NOW).kind).toBe('FOLLOW_UP_OVERDUE');
  });

  test('an expired quotation, or none, changes nothing; a closed enquiry stays closed', () => {
    expect(nextAction({ ...base, quote: 'ENDED' }, NOW).kind).toBe('CALL');
    expect(nextAction({ ...base, contacted: true, quote: null }, NOW).kind).toBe('SCHEDULE');
    expect(nextAction({ ...base, closed: true, quote: 'ACCEPTED' }, NOW).kind).toBe('CLOSED');
  });

  test('WhatsApp opens a chat with the customer’s own number', () => {
    expect(whatsappTo('98765 43210', 'Namaste Rahul')).toBe('https://wa.me/919876543210?text=Namaste%20Rahul');
  });
});

describe('historyFor — what has been paid is not for everyone', () => {
  const history = [
    { type: 'PAYMENT_RECEIVED', summary: 'Payment recorded: ₹20,000 by UPI' },
    { type: 'INVOICE_CREATED', summary: 'Booking confirmation invoice created' },
    { type: 'PAYMENT_SUBMITTED', summary: 'The couple says they paid ₹30,000 by UPI' },
    { type: 'QUOTATION_SENT', summary: 'Quotation sent' },
    { type: 'CALL', summary: 'Called' },
  ];

  test('with view_financials: everything', () => {
    expect(historyFor(history, true)).toEqual(history);
  });

  test('without it: payments and invoices are left out; the rest of the story stays', () => {
    expect(historyFor(history, false).map((h) => h.type)).toEqual(['QUOTATION_SENT', 'CALL']);
  });
});
