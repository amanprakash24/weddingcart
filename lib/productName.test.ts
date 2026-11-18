/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { PRODUCT_NAME, productOfBusiness } from './productName';

describe('which product a business works in', () => {
  test("Shaadi Shopping's own business is Vivah OS", () => {
    expect(PRODUCT_NAME[productOfBusiness('PLATFORM', null)]).toBe('Vivah OS');
  });
  test('a venue is Venue OS', () => {
    expect(PRODUCT_NAME[productOfBusiness('VENDOR', 'Venues')]).toBe('Venue OS');
  });
  test('a photographer, DJ or decorator is Vendor OS', () => {
    for (const c of ['Photographers', 'DJ', 'Decorators', 'Bouncers']) expect(PRODUCT_NAME[productOfBusiness('VENDOR', c)]).toBe('Vendor OS');
  });
  test('no category known yet: Vendor OS', () => {
    expect(PRODUCT_NAME[productOfBusiness('VENDOR', null)]).toBe('Vendor OS');
  });
});
