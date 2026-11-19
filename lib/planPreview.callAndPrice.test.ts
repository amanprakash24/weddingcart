/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { callLine, formatTime, venuePriceLabel } from './planPreview';

// 19 Nov 2026 test round: the plan result read "will call on at" and showed "₹0.0–0.0 L".
describe('callLine', () => {
  test('names the day and time the couple chose', () => {
    expect(callLine('2026-11-26', '18:30')).toBe('Your Wedding Expert will call you on 26 November 2026 at 6:30 pm.');
  });
  test('only the day, only the time, or neither', () => {
    expect(callLine('2026-11-26', '')).toBe('Your Wedding Expert will call you on 26 November 2026.');
    expect(callLine('', '09:05')).toBe('Your Wedding Expert will call you at 9:05 am.');
    expect(callLine('', '')).toBe('Your Wedding Expert will call you soon.');
  });
  test('noon and midnight', () => {
    expect(formatTime('12:00')).toBe('12:00 pm');
    expect(formatTime('00:15')).toBe('12:15 am');
  });
});

describe('venuePriceLabel', () => {
  test('a range in lakh', () => expect(venuePriceLabel(100000, 600000)).toBe('₹1.0–6.0 L'));
  test('no price saved', () => expect(venuePriceLabel(0, 0)).toBe('Price on request'));
  test('only one end', () => {
    expect(venuePriceLabel(250000, 0)).toBe('From ₹2.5 L');
    expect(venuePriceLabel(0, 450000)).toBe('Up to ₹4.5 L');
  });
  test('the same lower and upper price', () => expect(venuePriceLabel(300000, 300000)).toBe('₹3.0 L'));
  test('per-plate venues show the plate price, not lakh', () => {
    expect(venuePriceLabel(1000, 1500, 'PER_PLATE')).toBe('₹1,000/plate');
    expect(venuePriceLabel(0, 0, 'PER_PLATE')).toBe('Price on request');
    expect(venuePriceLabel(100000, 600000, 'PACKAGE')).toBe('₹1.0–6.0 L');
  });
});
