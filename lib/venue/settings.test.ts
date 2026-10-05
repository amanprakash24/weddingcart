/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { validateVenueSettings } from './settings';

describe('validateVenueSettings', () => {
  test('blank fields mean "use the default"', () => {
    expect(validateVenueSettings({})).toEqual({ ok: true, value: { contactPhone: null, confirmationPercent: null, holdWindowDays: null, upiId: null, upiName: null } });
    expect(validateVenueSettings({ contactPhone: '  ', confirmationPercent: '', holdWindowDays: '' })).toMatchObject({ ok: true });
  });

  test('a phone is stored as 10 digits, however it was typed', () => {
    for (const typed of ['98765 43210', '+91 98765-43210', '09876543210', '919876543210']) {
      expect(validateVenueSettings({ contactPhone: typed })).toMatchObject({ ok: true, value: { contactPhone: '9876543210' } });
    }
  });

  test('a wrong phone is explained under its own box', () => {
    for (const typed of ['12345', '1234567890', 'call me', '98765432101234']) {
      expect(validateVenueSettings({ contactPhone: typed })).toMatchObject({ ok: false, errors: { contactPhone: expect.stringContaining('10-digit') } });
    }
  });

  test('the percent is a whole number from 10 to 100', () => {
    for (const ok of ['10', '30', '100', 30]) expect(validateVenueSettings({ confirmationPercent: ok })).toMatchObject({ ok: true, value: { confirmationPercent: Number(ok) } });
    for (const bad of ['9', '0', '101', '25.5', '-30', 'thirty', '1000']) expect(validateVenueSettings({ confirmationPercent: bad })).toMatchObject({ ok: false, errors: { confirmationPercent: expect.any(String) } });
  });

  test('the hold is a whole number of days from 1 to 30', () => {
    for (const ok of ['1', '5', '30']) expect(validateVenueSettings({ holdWindowDays: ok })).toMatchObject({ ok: true, value: { holdWindowDays: Number(ok) } });
    for (const bad of ['0', '31', '2.5', 'week']) expect(validateVenueSettings({ holdWindowDays: bad })).toMatchObject({ ok: false, errors: { holdWindowDays: expect.any(String) } });
  });

  test('UPI details: an ID as the payment app shows it, with an optional name', () => {
    expect(validateVenueSettings({ upiId: ' swayamvar@okhdfcbank ', upiName: '  Swayamvar   Hall ' })).toMatchObject({ ok: true, value: { upiId: 'swayamvar@okhdfcbank', upiName: 'Swayamvar Hall' } });
    expect(validateVenueSettings({ upiId: '9876543210@ybl' })).toMatchObject({ ok: true, value: { upiId: '9876543210@ybl', upiName: null } });
    for (const bad of ['swayamvar', '@okhdfcbank', 'a@b', 'swayam var@ok bank!', 'https://pay.example/x']) expect(validateVenueSettings({ upiId: bad })).toMatchObject({ ok: false, errors: { upiId: expect.any(String) } });
    expect(validateVenueSettings({ upiName: 'Swayamvar Hall' })).toMatchObject({ ok: false, errors: { upiName: expect.stringContaining('UPI ID') } });
    expect(validateVenueSettings({ upiId: 'a1@ok', upiName: 'x'.repeat(81) })).toMatchObject({ ok: false, errors: { upiName: expect.any(String) } });
  });

  test('every wrong field is reported at once', () => {
    const r = validateVenueSettings({ contactPhone: '1', confirmationPercent: '5', holdWindowDays: '99' });
    expect(r.ok === false && Object.keys(r.errors).sort()).toEqual(['confirmationPercent', 'contactPhone', 'holdWindowDays']);
  });
});
