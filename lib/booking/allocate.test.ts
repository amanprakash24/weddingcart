import { describe, expect, it } from 'bun:test';
import { netShares } from './allocate';

describe('netShares', () => {
  it('QTN-202611-0005: ₹5,17,500 of lines, ₹85,500 agreed — shares add up to ₹85,500 exactly', () => {
    const lines = [320000, 12000, 12000, 10000, 0, 48000, 48000, 4500, 63000];
    const shares = netShares(lines, 85500);
    expect(shares.reduce((s, x) => s + x, 0)).toBe(85500);
    expect(shares[0]).toBe(52870); // Main gate: 320000 × 85500 / 517500 = 52869.57 → 52870
    expect(shares[4]).toBe(0); // the free selfie point stays free
    expect(shares.every((s) => Number.isInteger(s) && s >= 0)).toBe(true);
  });
  it('no discount: the lines as they are', () => {
    expect(netShares([800 * 500, 40000], 440000)).toEqual([400000, 40000]);
  });
  it('rounding never loses or invents a rupee', () => {
    for (const target of [1, 2, 99, 1000, 33333]) {
      const s = netShares([1, 1, 1], target);
      expect(s.reduce((a, b) => a + b, 0)).toBe(Math.min(target, 3));
    }
    const s = netShares([10, 10, 10], 20);
    expect(s.reduce((a, b) => a + b, 0)).toBe(20);
    expect(s).toEqual([7, 7, 6]); // ties: earliest lines first
  });
  it('nothing to share', () => {
    expect(netShares([], 100)).toEqual([]);
    expect(netShares([0, 0], 100)).toEqual([0, 0]);
    expect(netShares([100, 200], 0)).toEqual([0, 0]);
  });
});
