/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { functionOfLabel, groupByKind, groupOfferings, kindsForCategory, offeringPriceWords, validateOffering } from './offering';

describe('validateOffering', () => {
  test('a kind, what is offered and a starting price — the function is optional', () => {
    expect(validateOffering({ kind: 'DECORATION', function: 'HALDI', name: '  Haldi   decoration ', price: '₹25,000' })).toEqual({
      ok: true,
      value: { kind: 'DECORATION', function: 'HALDI', name: 'Haldi decoration', description: null, price: 25000, perPlate: false, active: true },
    });
    expect(validateOffering({ kind: 'RENTAL', name: 'Banquet hall', price: '200000', description: '  5,000 sq ft,   AC ' })).toMatchObject({ ok: true, value: { function: null, description: '5,000 sq ft, AC' } });
    expect(validateOffering({ kind: 'RENTAL', function: '', name: 'Lawn', price: 1 })).toMatchObject({ ok: true, value: { function: null } });
  });

  test('per plate is for food and packages only', () => {
    expect(validateOffering({ kind: 'CATERING', name: 'Veg plate', price: 900, perPlate: true })).toMatchObject({ ok: true, value: { price: 900, perPlate: true } });
    expect(validateOffering({ kind: 'PACKAGE', name: 'Wedding package', price: 1500, perPlate: 'true' })).toMatchObject({ ok: true, value: { perPlate: true } });
    expect(validateOffering({ kind: 'RENTAL', name: 'Hall', price: 900, perPlate: true })).toMatchObject({ ok: true, value: { perPlate: false } });
  });

  test('hidden only when said so', () => {
    expect(validateOffering({ kind: 'SERVICE', name: 'DJ', price: 1, active: false })).toMatchObject({ ok: true, value: { active: false } });
    expect(validateOffering({ kind: 'SERVICE', name: 'DJ', price: 1, active: 'nonsense' })).toMatchObject({ ok: true, value: { active: true } });
  });

  test('each wrong box gets its own message', () => {
    const r = validateOffering({ kind: 'FURNITURE', function: 'BACHELOR_PARTY', name: 'x', price: 'call us', description: 'y'.repeat(301) });
    expect(r.ok === false && Object.keys(r.errors).sort()).toEqual(['description', 'function', 'kind', 'name', 'price']);
    expect(validateOffering({ name: 'Lawn', price: '1' })).toMatchObject({ ok: false, errors: { kind: expect.any(String) } });
    expect(validateOffering({ kind: 'RENTAL', name: 'x'.repeat(121), price: '1' })).toMatchObject({ ok: false, errors: { name: expect.any(String) } });
    for (const bad of ['', '-5', '12.50', '99999999999']) expect(validateOffering({ kind: 'RENTAL', name: 'Lawn', price: bad })).toMatchObject({ ok: false, errors: { price: expect.any(String) } });
  });

  test('a price of ₹0 is allowed (included at no charge); nothing else is taken from the request', () => {
    const r = validateOffering({ kind: 'SERVICE', function: 'HALDI', name: 'Parking', price: '0', businessId: 'someone-else', id: 'x', sourcePackageId: 'p1' });
    expect(r).toEqual({ ok: true, value: { kind: 'SERVICE', function: 'HALDI', name: 'Parking', description: null, price: 0, perPlate: false, active: true } });
  });
});

describe('showing the price list', () => {
  const o = (fn: 'HALDI' | 'RECEPTION' | 'ENGAGEMENT' | null, name: string) => ({ function: fn, name });

  test('by kind, in the usual order, only kinds that have something', () => {
    const groups = groupByKind([{ kind: 'PACKAGE' as const, name: 'Gold' }, { kind: 'RENTAL' as const, name: 'Hall' }, { kind: 'CATERING' as const, name: 'Veg plate' }, { kind: 'RENTAL' as const, name: 'Lawn' }]);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.name)])).toEqual([['Venue & rentals', ['Hall', 'Lawn']], ['Food & catering', ['Veg plate']], ['Packages', ['Gold']]]);
    expect(groupByKind([])).toEqual([]);
  });

  test('by function, in the order a wedding runs, only functions that have something', () => {
    const groups = groupOfferings([o('RECEPTION', 'Hall'), o('HALDI', 'Lawn'), o('RECEPTION', 'Veg plate'), o('ENGAGEMENT', 'Stage')]);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.name)])).toEqual([['Engagement', ['Stage']], ['Haldi', ['Lawn']], ['Reception', ['Hall', 'Veg plate']]]);
    expect(groupOfferings([])).toEqual([]);
  });

  test('an item for any function is offered under every function', () => {
    const groups = groupOfferings([o('HALDI', 'Haldi decoration'), o(null, 'Banquet hall')]);
    expect(groups).toHaveLength(7); // every function, because the hall can be booked for any of them
    expect(groups.find((g) => g.label === 'Haldi')?.items.map((i) => i.name)).toEqual(['Haldi decoration', 'Banquet hall']);
    expect(groups.find((g) => g.label === 'Reception')?.items.map((i) => i.name)).toEqual(['Banquet hall']);
  });

  test('a business is shown the kinds that fit it first', () => {
    expect(kindsForCategory('venue')).toEqual(['RENTAL', 'CATERING', 'DECORATION', 'SERVICE', 'PACKAGE']);
    expect(kindsForCategory('catering')[0]).toBe('CATERING');
    expect(kindsForCategory('catering')).not.toContain('DECORATION');
    expect(kindsForCategory('transport')).toEqual(['SERVICE', 'PACKAGE', 'RENTAL']);
    expect(kindsForCategory(null)).toEqual(['SERVICE', 'PACKAGE', 'RENTAL']);
  });

  test('price words', () => {
    expect(offeringPriceWords({ price: 125000, perPlate: false })).toBe('₹1,25,000');
    expect(offeringPriceWords({ price: 900, perPlate: true })).toBe('₹900 per plate');
  });

  test('a quotation line’s label is read back as its function', () => {
    expect(functionOfLabel('Haldi')).toBe('HALDI');
    expect(functionOfLabel(' reception ')).toBe('RECEPTION');
    for (const none of [null, undefined, '', 'Cocktail night']) expect(functionOfLabel(none)).toBeNull();
  });
});
