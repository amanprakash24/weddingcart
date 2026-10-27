/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { contactPhone, dateRangeWords, daysToGo, daysToGoWords, rupeesShort, serviceStatus, weddingStatusWords, whatsappTo } from './myWedding';

describe('My Wedding display rules', () => {
  test('days to go are counted in India, whatever the time of day', () => {
    const now = new Date('2026-10-28T20:00:00Z'); // 29 Oct 01:30 IST
    expect(daysToGo('2027-02-16T00:00:00+05:30', now)).toBe(110);
    expect(daysToGo('2026-10-29T10:00:00+05:30', now)).toBe(0);
    expect(daysToGoWords(110)).toBe('110 days to go');
    expect(daysToGoWords(1)).toBe('Tomorrow');
    expect(daysToGoWords(0)).toBe('Today');
    expect(daysToGoWords(-3)).toBe('Celebrated');
  });

  test('date ranges from the functions', () => {
    expect(dateRangeWords(['2027-02-17T00:00:00+05:30', '2027-02-14T00:00:00+05:30', '2027-02-16T00:00:00+05:30'], '2027-02-16T00:00:00+05:30')).toBe('14 – 17 Feb 2027');
    expect(dateRangeWords([], '2027-02-16T00:00:00+05:30')).toBe('16 Feb 2027');
    expect(dateRangeWords(['2027-02-28T00:00:00+05:30', '2027-03-02T00:00:00+05:30'], '')).toBe('28 Feb – 2 Mar 2027');
  });

  test('statuses in plain words', () => {
    expect(weddingStatusWords('PLANNING')).toBe('Planning');
    expect(weddingStatusWords('anything')).toBe('Planning');
    expect(serviceStatus('CONFIRMED')).toEqual({ words: 'Booked', tone: 'good' });
    expect(serviceStatus('PENDING_VENDOR_CONFIRMATION').tone).toBe('wait');
  });

  test('money words', () => {
    expect(rupeesShort(450000)).toBe('₹4.5 lakh');
    expect(rupeesShort(1600000)).toBe('₹16 lakh');
    expect(rupeesShort(12000000)).toBe('₹1.2 crore');
    expect(rupeesShort(45000)).toBe('₹45,000');
  });

  test('the couple calls the business running their wedding — Shaadi Shopping for its own weddings', () => {
    expect(contactPhone({ isShaadiShopping: true, phone: '9123456789' })).toBe('+917646028228');
    expect(contactPhone({ isShaadiShopping: false, phone: '091234 56789' })).toBe('+919123456789');
    expect(contactPhone({ isShaadiShopping: false, phone: null })).toBe('+917646028228');
    expect(whatsappTo('+919123456789', 'Hi')).toBe('https://wa.me/919123456789?text=Hi');
  });
});
