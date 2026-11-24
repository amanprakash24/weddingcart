import { describe, expect, test } from 'bun:test';
import { checkNextEvent, consultationFromNextEvent, nextEventIsBot, RETURNING_OFFER } from './nextEvent';

const TODAY = '2026-11-24';
describe('our next celebration / refer family & friends', () => {
  test('a returning family’s next event', () => {
    const r = checkNextEvent({ kind: 'NEXT', name: ' Pratik  Anand ', phone: '+91 98765 43210', eventType: 'anniversary', month: '2027-11' }, TODAY);
    expect(r).toEqual({ ok: true, value: { kind: 'NEXT', name: 'Pratik Anand', phone: '9876543210', eventType: 'anniversary', month: '2027-11', note: null, referrerName: null, referrerPhone: null } });
    const c = consultationFromNextEvent((r as { value: Parameters<typeof consultationFromNextEvent>[0] }).value);
    expect(c).toMatchObject({ name: 'Pratik Anand', phone: '9876543210', eventType: 'anniversary', weddingDate: '', channel: 'EXISTING_CUSTOMER' });
    expect(c.message).toContain('Returning family');
    expect(c.message).toContain('November 2027');
    expect(c.message).toContain(RETURNING_OFFER.headline);
  });
  test('a referral names who referred them', () => {
    const r = checkNextEvent({ kind: 'REFERRAL', name: 'Neha', phone: '9123456780', eventType: 'griha_pravesh', referrerName: 'Pratik', referrerPhone: '9876543210', note: 'New flat' }, TODAY);
    const c = consultationFromNextEvent((r as { value: Parameters<typeof consultationFromNextEvent>[0] }).value);
    expect(c).toMatchObject({ name: 'Neha', channel: 'REFERENCE', sourceDetail: 'Review page · referral from Pratik' });
    expect(c.message).toContain('Referred by Pratik (+91 9876543210)');
    expect(c.message).not.toContain('offer');
  });
  test('checks', () => {
    const err = (x: object) => (checkNextEvent({ kind: 'NEXT', name: 'Pratik', phone: '9876543210', eventType: 'birthday', ...x }, TODAY) as { error?: string }).error;
    expect(err({ eventType: 'corporate' })).toContain('celebration');
    expect(err({ phone: '123' })).toContain('10-digit');
    expect(err({ month: '2026-10' })).toContain('month');
    expect(err({ kind: 'X' })).toBeTruthy();
    expect(err({ kind: 'REFERRAL', referrerName: '' })).toContain('your name');
    expect(err({ kind: 'REFERRAL', referrerName: 'Pratik', referrerPhone: '9876543210' })).toContain('own number');
    expect(nextEventIsBot({ kind: 'NEXT', name: 'a', phone: 'b', eventType: 'c', website: 'x' })).toBe(true);
  });
});
