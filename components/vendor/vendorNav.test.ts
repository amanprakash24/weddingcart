/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { DESKTOP_BAR, DESKTOP_MORE, PHONE_BAR, PHONE_MORE, PRIMARY } from './vendorNav';

// The top bar overflowed at laptop width once it held ten screens (13 Oct 2026): the last items and the business's name were
// pushed off the right edge. The bar is now kept short, and every screen must still be reachable from somewhere.
describe('the Vendor OS menu — every screen is somewhere, and the bars stay short', () => {
  const keys = (items: typeof PRIMARY) => items.map((i) => i.key);

  test('desktop: six screens on the bar, the rest in the business menu — together, every screen exactly once', () => {
    expect(keys(DESKTOP_BAR)).toEqual(['today', 'enquiries', 'weddings', 'services', 'availability', 'payments']);
    expect([...keys(DESKTOP_BAR), ...keys(DESKTOP_MORE)].sort()).toEqual(keys(PRIMARY).sort());
  });

  test('phone: four on the bottom bar, the rest in More — together, every screen exactly once', () => {
    expect(PHONE_BAR).toHaveLength(4);
    expect([...keys(PHONE_BAR), ...keys(PHONE_MORE)].sort()).toEqual(keys(PRIMARY).sort());
  });
});
