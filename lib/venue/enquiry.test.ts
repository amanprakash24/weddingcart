/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { ACTION_ORDER, CHANNELS, nextAction, validateNewEnquiry, whatsappTo, type FollowUp } from './enquiry';

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

  test('late first, then people nobody has called, then today', () => {
    expect(ACTION_ORDER.slice(0, 3)).toEqual(['FOLLOW_UP_OVERDUE', 'CALL', 'FOLLOW_UP_TODAY']);
  });

  test('WhatsApp opens a chat with the customer’s own number', () => {
    expect(whatsappTo('98765 43210', 'Namaste Rahul')).toBe('https://wa.me/919876543210?text=Namaste%20Rahul');
  });
});
