/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { functionOfLabel, groupOfferings, offeringPriceWords, validateOffering } from './offering';

describe('validateOffering', () => {
  test('a function, what is offered and a starting price', () => {
    expect(validateOffering({ function: 'HALDI', name: '  Haldi   decoration ', price: '₹25,000' })).toEqual({ ok: true, value: { function: 'HALDI', name: 'Haldi decoration', price: 25000, perPlate: false } });
    expect(validateOffering({ function: 'RECEPTION', name: 'Veg plate', price: 900, perPlate: true })).toMatchObject({ ok: true, value: { price: 900, perPlate: true } });
  });

  test('each wrong box gets its own message', () => {
    const r = validateOffering({ function: 'BACHELOR_PARTY', name: 'x', price: 'call us' });
    expect(r.ok === false && Object.keys(r.errors).sort()).toEqual(['function', 'name', 'price']);
    expect(validateOffering({ function: 'HALDI', name: 'x'.repeat(121), price: '1' })).toMatchObject({ ok: false, errors: { name: expect.any(String) } });
    for (const bad of ['', '-5', '12.50', '99999999999']) expect(validateOffering({ function: 'HALDI', name: 'Lawn', price: bad })).toMatchObject({ ok: false, errors: { price: expect.any(String) } });
  });

  test('a price of ₹0 is allowed (included at no charge); nothing else is taken from the request', () => {
    const r = validateOffering({ function: 'HALDI', name: 'Parking', price: '0', businessId: 'someone-else', id: 'x' });
    expect(r).toEqual({ ok: true, value: { function: 'HALDI', name: 'Parking', price: 0, perPlate: false } });
  });
});

describe('showing offerings', () => {
  const o = (fn: 'HALDI' | 'RECEPTION' | 'ENGAGEMENT', name: string) => ({ function: fn, name });

  test('grouped in the order a wedding runs, only functions that have something', () => {
    const groups = groupOfferings([o('RECEPTION', 'Hall'), o('HALDI', 'Lawn'), o('RECEPTION', 'Veg plate'), o('ENGAGEMENT', 'Stage')]);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.name)])).toEqual([['Engagement', ['Stage']], ['Haldi', ['Lawn']], ['Reception', ['Hall', 'Veg plate']]]);
    expect(groupOfferings([])).toEqual([]);
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
