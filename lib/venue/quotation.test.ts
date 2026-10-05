/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { quoteShareMessage, quoteStage, validateVenueQuote } from './quotation';

const TODAY = '2026-10-05';
const good = { items: [{ description: 'Hall hire', quantity: '1', unitPrice: '200000' }], validUntil: '2026-10-12' };

describe('validateVenueQuote', () => {
  test('a simple quotation: lines, valid-until; everything else is optional', () => {
    expect(validateVenueQuote(good, TODAY)).toEqual({
      ok: true,
      value: { items: [{ description: 'Hall hire', quantity: 1, unitPrice: 200000 }], discount: 0, validUntil: '2026-10-12', inclusions: null, exclusions: null, terms: null },
    });
  });

  test('prices are read however they were typed; quantity defaults to 1', () => {
    const r = validateVenueQuote({ ...good, items: [{ description: '  Veg   plate ', quantity: '', unitPrice: '₹1,200' }, { description: 'Lawn', quantity: 2, unitPrice: 50000 }], discount: '5,000' }, TODAY);
    expect(r).toMatchObject({ ok: true, value: { items: [{ description: 'Veg plate', quantity: 1, unitPrice: 1200 }, { description: 'Lawn', quantity: 2, unitPrice: 50000 }], discount: 5000 } });
  });

  test('each wrong box gets its own message', () => {
    const r = validateVenueQuote({ items: [{ description: '', quantity: '0', unitPrice: 'free' }, { description: 'Lawn', quantity: '1.5', unitPrice: '-5' }], validUntil: '' }, TODAY);
    expect(r.ok === false && Object.keys(r.errors).sort()).toEqual(['items.0.description', 'items.0.quantity', 'items.0.unitPrice', 'items.1.quantity', 'items.1.unitPrice', 'validUntil']);
  });

  test('no lines, or too many, is refused', () => {
    expect(validateVenueQuote({ ...good, items: [] }, TODAY)).toMatchObject({ ok: false, errors: { items: 'Add at least one line' } });
    expect(validateVenueQuote({ validUntil: '2026-10-12' }, TODAY)).toMatchObject({ ok: false, errors: { items: expect.any(String) } });
    expect(validateVenueQuote({ ...good, items: Array.from({ length: 31 }, () => good.items[0]) }, TODAY)).toMatchObject({ ok: false, errors: { items: expect.stringContaining('30') } });
  });

  test('the discount cannot exceed the lines, and the total must be more than zero', () => {
    expect(validateVenueQuote({ ...good, discount: '200001' }, TODAY)).toMatchObject({ ok: false, errors: { discount: expect.any(String) } });
    expect(validateVenueQuote({ ...good, discount: '200000' }, TODAY)).toMatchObject({ ok: false, errors: { items: expect.stringContaining('₹0') } });
    expect(validateVenueQuote({ ...good, discount: 'ten' }, TODAY)).toMatchObject({ ok: false, errors: { discount: expect.any(String) } });
    expect(validateVenueQuote({ ...good, items: [{ description: 'Free tasting', quantity: 1, unitPrice: 0 }] }, TODAY)).toMatchObject({ ok: false, errors: { items: expect.any(String) } });
  });

  test('valid until: today or later, a real date', () => {
    expect(validateVenueQuote({ ...good, validUntil: TODAY }, TODAY)).toMatchObject({ ok: true });
    for (const bad of ['2026-10-04', '12/10/2026', 'next week', '2026-13-45']) expect(validateVenueQuote({ ...good, validUntil: bad }, TODAY)).toMatchObject({ ok: false, errors: { validUntil: expect.any(String) } });
  });

  test('totals, tax and the amount to confirm are never taken from the request', () => {
    const r = validateVenueQuote({ ...good, total: 1, subtotal: 1, advanceAmount: 1, gstEnabled: true, gstAmount: 36000, items: [{ ...good.items[0], vendorId: 'someone-else', lineTotal: 1 }] }, TODAY);
    expect(r.ok && Object.keys(r.value).sort()).toEqual(['discount', 'exclusions', 'inclusions', 'items', 'terms', 'validUntil']);
    expect(r.ok && Object.keys(r.value.items[0]).sort()).toEqual(['description', 'quantity', 'unitPrice']);
  });
});

describe('quoteStage', () => {
  test('where a quotation stands, in the venue’s words', () => {
    expect(quoteStage({ status: 'DRAFT', changesRequested: false })).toBe('DRAFT');
    expect(quoteStage({ status: 'SENT', changesRequested: false })).toBe('SENT');
    expect(quoteStage({ status: 'SENT', changesRequested: true })).toBe('CHANGES');
    expect(quoteStage({ status: 'ACCEPTED', changesRequested: true })).toBe('ACCEPTED');
    expect(quoteStage({ status: 'EXPIRED', changesRequested: false })).toBe('ENDED');
    expect(quoteStage({ status: 'REJECTED', changesRequested: false })).toBe('ENDED');
    expect(quoteStage({ status: 'SUPERSEDED', changesRequested: false })).toBeNull();
  });
});

describe('quoteShareMessage', () => {
  test('the venue’s own words, with the total and the link', () => {
    const text = quoteShareMessage({ customerName: 'Rahul Kumar', venueName: 'Swayamvar Hall', number: 'SWA-QTN-202610-0001', total: 250000, url: 'https://example.test/proposal/abc' });
    expect(text).toContain('Namaste Rahul,');
    expect(text).toContain('Swayamvar Hall (SWA-QTN-202610-0001)');
    expect(text).toContain('₹2,50,000');
    expect(text).toContain('https://example.test/proposal/abc');
    expect(text).not.toContain('Shaadi Shopping');
  });
});
