/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { ValidationError } from '@/lib/errors';
import { applyReferralUpdate, nextPartnerCode, normalizeMobile, normalizePartnerCode, validateRegistration, validateReferral, validateReferralUpdate } from './rules';

const reg = { name: ' Asha  Kumari ', phone: '+91 98765 43210', city: 'Patna', category: 'Photographer', referralTypes: ['Venues', 'Clients'], consent: true };

describe('registration', () => {
  test('valid input is normalised', () => {
    expect(validateRegistration(reg)).toEqual({ name: 'Asha Kumari', phone: '9876543210', whatsapp: null, email: null, city: 'Patna', category: 'Photographer', referralTypes: ['Venues', 'Clients'], networkNote: null });
  });
  test('consent, name, mobile, city, category and at least one referral type are required', () => {
    for (const bad of [{ consent: false }, { consent: undefined }, { name: '' }, { phone: '12345' }, { phone: '5876543210' }, { city: ' ' }, { category: 'Astronaut' }, { referralTypes: [] }, { referralTypes: ['Rockets'] }]) {
      expect(() => validateRegistration({ ...reg, ...bad })).toThrow(ValidationError);
    }
  });
  test('optional fields are checked when given', () => {
    expect(() => validateRegistration({ ...reg, email: 'not-an-email' })).toThrow(ValidationError);
    expect(() => validateRegistration({ ...reg, whatsapp: '123' })).toThrow(ValidationError);
    expect(() => validateRegistration({ ...reg, networkNote: 'x'.repeat(1001) })).toThrow(ValidationError);
    expect(validateRegistration({ ...reg, email: ' A@B.in ', whatsapp: '09876543210' })).toMatchObject({ email: 'a@b.in', whatsapp: '9876543210' });
  });
});

describe('mobile numbers and partner codes', () => {
  test('mobile formats', () => {
    for (const ok of ['9876543210', '+919876543210', '91 98765-43210', '09876543210']) expect(normalizeMobile(ok)).toBe('9876543210');
    for (const bad of ['1234567890', '98765', 'abc', '+44 7700 900123']) expect(() => normalizeMobile(bad)).toThrow(ValidationError);
  });
  test('codes are sequential from GP-1001', () => {
    expect(nextPartnerCode(null)).toBe('GP-1001');
    expect(nextPartnerCode('GP-1041')).toBe('GP-1042');
    expect(nextPartnerCode('garbage')).toBe('GP-1001');
  });
  test('partners may type the code loosely', () => {
    for (const v of ['GP-1042', 'gp-1042', 'GP1042', ' gp 1042 ', '1042']) expect(normalizePartnerCode(v)).toBe('GP-1042');
    for (const v of ['', 'GX-1042', 'GP-12', null, 42]) expect(normalizePartnerCode(v)).toBeNull();
  });
});

describe('referral', () => {
  const ref = { partnerPhone: '9876543210', partnerCode: 'gp-1042', type: 'VENUE', name: 'ABC Banquet', phone: '9123456789', city: 'Patna', consent: true };
  test('valid referral', () => {
    expect(validateReferral(ref)).toMatchObject({ partnerPhone: '9876543210', partnerCode: 'GP-1042', type: 'VENUE', name: 'ABC Banquet', phone: '9123456789', city: 'Patna', requirement: null });
  });
  test('the referred person must have agreed to be contacted; type, name, phone and city are required', () => {
    for (const bad of [{ consent: false }, { type: 'SPACESHIP' }, { name: '' }, { phone: '12' }, { city: '' }, { partnerCode: 'nope' }]) {
      expect(() => validateReferral({ ...ref, ...bad })).toThrow(ValidationError);
    }
  });
});

describe('staff updates — a payout only after completion, "paid" needs an amount', () => {
  const base = { status: 'CONVERTED' as const, payoutStatus: 'NOT_DUE' as const, payoutAmount: null, completedAt: null, paidAt: null };
  const now = new Date('2026-10-01T10:00:00Z');

  test('unknown values are refused', () => {
    expect(() => validateReferralUpdate({ status: 'WON' })).toThrow(ValidationError);
    expect(() => validateReferralUpdate({ payoutStatus: 'SOON' })).toThrow(ValidationError);
    expect(() => validateReferralUpdate({ payoutAmount: -5 })).toThrow(ValidationError);
    expect(() => validateReferralUpdate({ payoutAmount: 1.5 })).toThrow(ValidationError);
  });
  test('completing stamps the completion date', () => {
    expect(applyReferralUpdate(base, { status: 'COMPLETED' }, now)).toMatchObject({ status: 'COMPLETED', completedAt: now });
  });
  test('a payout cannot be due before completion', () => {
    expect(() => applyReferralUpdate(base, { payoutStatus: 'DUE', payoutAmount: 2000 }, now)).toThrow(ValidationError);
  });
  test('"paid" before completion is refused — whichever field says paid', () => {
    expect(() => applyReferralUpdate(base, { status: 'PAID', payoutAmount: 2000 }, now)).toThrow(ValidationError);
    expect(() => applyReferralUpdate(base, { payoutStatus: 'PAID', payoutAmount: 2000 }, now)).toThrow(ValidationError);
  });
  test('after completion: due, then paid (with an amount); both fields move together', () => {
    const completed = { ...base, status: 'COMPLETED' as const, completedAt: now };
    expect(applyReferralUpdate(completed, { payoutStatus: 'DUE', payoutAmount: 2500 }, now)).toMatchObject({ status: 'COMPLETED', payoutStatus: 'DUE', payoutAmount: 2500 });
    expect(() => applyReferralUpdate(completed, { payoutStatus: 'PAID' }, now)).toThrow(ValidationError); // no amount
    expect(applyReferralUpdate({ ...completed, payoutAmount: 2500 }, { payoutStatus: 'PAID' }, now)).toMatchObject({ status: 'PAID', payoutStatus: 'PAID', paidAt: now });
    expect(applyReferralUpdate({ ...completed, payoutAmount: 2500 }, { status: 'PAID' }, now)).toMatchObject({ status: 'PAID', payoutStatus: 'PAID' });
  });
  test('moving a paid referral back requires changing its payout too', () => {
    const paid = { status: 'PAID' as const, payoutStatus: 'PAID' as const, payoutAmount: 2500, completedAt: now, paidAt: now };
    expect(() => applyReferralUpdate(paid, { status: 'IN_DISCUSSION' }, now)).toThrow(ValidationError);
    expect(applyReferralUpdate(paid, { status: 'COMPLETED', payoutStatus: 'DUE' }, now)).toMatchObject({ status: 'COMPLETED', payoutStatus: 'DUE', paidAt: null });
  });
});
