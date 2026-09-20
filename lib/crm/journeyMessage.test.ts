/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { journeyMessage, whatsappUrl, type JourneyMessageInput } from './journeyMessage';

const input: JourneyMessageInput = {
  quotation: {
    quotationNumber: 'QTN-202609-0001',
    items: [{ description: 'Venue', quantity: 1, unitPrice: 200000 }],
    subtotal: 200000,
    discount: 0,
    gstEnabled: false,
    gstAmount: 0,
    total: 200000,
    advanceAmount: 75000,
    validUntil: '2026-09-27T18:29:59.000Z',
  },
  customerName: 'Rahul & Priya',
  eventDate: '5 Dec 2026',
  sentOn: '18 Sep 2026',
  weddingNumber: 'WED-2026-0003',
};

describe('whatsappUrl', () => {
  test('links to the customer’s own 10-digit number, message URL-encoded', () => {
    expect(whatsappUrl('+91 98765 00001', 'Hi & bye')).toBe('https://wa.me/919876500001?text=Hi%20%26%20bye');
    expect(whatsappUrl('09876500001', 'x')).toBe('https://wa.me/919876500001?text=x');
  });
  test('an unusable number gives no link (the UI then offers Copy)', () => {
    expect(whatsappUrl('12345', 'x')).toBeNull();
    expect(whatsappUrl('', 'x')).toBeNull();
    expect(whatsappUrl(null, 'x')).toBeNull();
  });
});

describe('journeyMessage — the right message for the moment', () => {
  test.each([
    ['DRAFT', 'quote'],
    ['SENT', 'follow-up'],
    ['ACCEPTED', 'thanks'],
    ['BOOKING_PENDING', 'thanks'],
    ['BOOKING_CONFIRMED', 'confirmed'],
  ] as const)('%s → %s', (state, kind) => {
    expect(journeyMessage(state, input)?.kind).toBe(kind);
  });

  test('no message when there is nothing to say', () => {
    for (const state of ['NO_QUOTE', 'LAPSED', 'READY_TO_CONVERT', 'NOT_PROCEEDING'] as const) {
      expect(journeyMessage(state, input)).toBeNull();
    }
  });

  test('the thank-you quotes THIS quotation’s advance, whatever it is', () => {
    expect(journeyMessage('ACCEPTED', input)?.text).toContain('₹75,000');
    const other = { ...input, quotation: { ...input.quotation!, advanceAmount: 310000 } };
    expect(journeyMessage('ACCEPTED', other)?.text).toContain('₹3,10,000');
    expect(journeyMessage('ACCEPTED', other)?.text).not.toContain('₹75,000');
  });

  test('no message contains internal wording', () => {
    for (const state of ['DRAFT', 'SENT', 'ACCEPTED', 'BOOKING_PENDING', 'BOOKING_CONFIRMED'] as const) {
      expect(journeyMessage(state, input)?.text).not.toMatch(/QUOTATION_|ACCEPTED|PENDING|DRAFT|status|stage|enquiry|marketplace/i);
    }
  });

  test('the confirmation uses the wedding reference given, not a fixed one', () => {
    expect(journeyMessage('BOOKING_CONFIRMED', { ...input, weddingNumber: 'WED-2027-0042' })?.text).toContain('WED-2027-0042');
  });
});
