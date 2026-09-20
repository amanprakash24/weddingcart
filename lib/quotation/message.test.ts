/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { SHAADI_PHONE_DISPLAY } from '@/lib/shaadiContact';
import { buildAcceptanceThanks, buildBookingConfirmedMessage, buildFollowUpMessage, buildQuotationMessage, formatQuoteDate } from './message';

const base = {
  quotationNumber: 'QTN-202609-0001',
  items: [
    { description: 'Grand Ballroom — 500 guests', quantity: 1, unitPrice: 300000 },
    { description: 'Catering per plate', quantity: 500, unitPrice: 800 },
  ],
  subtotal: 700000,
  discount: 0,
  gstEnabled: false,
  gstAmount: 0,
  total: 700000,
  advanceAmount: 200000,
  validUntil: '2026-10-01T18:29:59.000Z',
  terms: null,
};

describe('formatQuoteDate', () => {
  test('formats in IST, so the end of 1 Oct IST reads as 1 Oct (not 2 Oct)', () => {
    expect(formatQuoteDate('2026-10-01T18:29:59.000Z')).toBe('1 Oct 2026');
  });

  test('returns null for nothing or garbage', () => {
    expect(formatQuoteDate(null)).toBeNull();
    expect(formatQuoteDate('not a date')).toBeNull();
  });
});

describe('buildQuotationMessage', () => {
  test('greets by name, names the quote, lists each line with quantity × price, and shows total / advance / balance', () => {
    const text = buildQuotationMessage(base, 'Rahul Sharma');
    expect(text).toContain('Namaste Rahul Sharma');
    expect(text).toContain('your quotation (QTN-202609-0001)');
    expect(text).toContain('• Grand Ballroom — 500 guests: ₹3,00,000');
    expect(text).toContain('• Catering per plate: 500 × ₹800 = ₹4,00,000');
    expect(text).toContain('Total: ₹7,00,000');
    expect(text).toContain('Advance to confirm: ₹2,00,000');
    expect(text).toContain('Balance: ₹5,00,000');
    expect(text).toContain('valid until 1 Oct 2026');
  });

  test('always points the customer at Shaadi Shopping\'s own number', () => {
    expect(buildQuotationMessage(base)).toContain(`call us on ${SHAADI_PHONE_DISPLAY}`);
  });

  test('never calls Shaadi Shopping a marketplace', () => {
    expect(buildQuotationMessage(base, 'A').toLowerCase()).not.toContain('marketplace');
  });

  test('a missing name still reads naturally', () => {
    expect(buildQuotationMessage(base, null)).toMatch(/^Namaste 🙏/);
    expect(buildQuotationMessage(base, '   ')).toMatch(/^Namaste 🙏/);
  });

  test('shows subtotal, discount and tax only when they exist', () => {
    const plain = buildQuotationMessage(base);
    expect(plain).not.toContain('Subtotal');
    expect(plain).not.toContain('Discount');
    expect(plain).not.toContain('Tax');

    const full = buildQuotationMessage({ ...base, discount: 10000, gstEnabled: true, gstAmount: 5000, total: 695000 });
    expect(full).toContain('Subtotal: ₹7,00,000');
    expect(full).toContain('Discount: −₹10,000');
    expect(full).toContain('Tax: ₹5,000');
  });

  test('a typed tax amount is hidden when tax is switched off', () => {
    expect(buildQuotationMessage({ ...base, gstEnabled: false, gstAmount: 5000 })).not.toContain('Tax');
  });

  test('omits the advance lines when there is no advance', () => {
    const text = buildQuotationMessage({ ...base, advanceAmount: 0 });
    expect(text).not.toContain('Advance');
    expect(text).not.toContain('Balance');
  });

  test('includes the customer-facing terms, but the internal note is not part of the input at all', () => {
    expect(buildQuotationMessage({ ...base, terms: '50% advance, balance a week before the event.' })).toContain(
      '50% advance, balance a week before the event.'
    );
    expect(Object.keys(base)).not.toContain('notes');
  });
});

describe('message wording for customers', () => {
  const everything = () => [
    buildQuotationMessage(base, 'Rahul & Priya', { eventDate: '5 Dec 2026' }),
    buildFollowUpMessage(base, 'Rahul & Priya', '18 Sep 2026'),
    buildAcceptanceThanks(base, 'Rahul & Priya'),
    buildBookingConfirmedMessage('Rahul & Priya', 'WED-2026-0003', '5 Dec 2026'),
  ];

  test('no message exposes internal or system wording', () => {
    for (const text of everything()) {
      expect(text).not.toMatch(/QUOTATION_|STATUS_|ACCEPTED|SENT|DRAFT|PENDING|booking status|lead stage|enquiry|consultation|marketplace/i);
    }
  });

  test('every message is signed by the team', () => {
    for (const text of everything()) expect(text.trim().endsWith('— Team Shaadi Shopping')).toBe(true);
  });

  test('the quotation message mentions the wedding date only when one is given', () => {
    expect(buildQuotationMessage(base, 'A', { eventDate: '5 Dec 2026' })).toContain('for your wedding on 5 Dec 2026');
    expect(buildQuotationMessage(base, 'A')).toContain('for your wedding. Here is');
  });

  test('the follow-up refers to the quote, its total and its validity, and asks for a call', () => {
    const text = buildFollowUpMessage(base, 'Rahul', '18 Sep 2026');
    expect(text).toContain('shared on 18 Sep 2026 (QTN-202609-0001)');
    expect(text).toContain('total ₹7,00,000, valid until 1 Oct 2026');
    expect(text).toContain('quick call');
  });

  test('the thank-you quotes the quote\x27s own advance — never a fixed figure — and skips it when there is none', () => {
    expect(buildAcceptanceThanks({ quotationNumber: 'Q1', advanceAmount: 125000 }, 'A')).toContain('₹1,25,000');
    const none = buildAcceptanceThanks({ quotationNumber: 'Q1', advanceAmount: 0 }, 'A');
    expect(none).not.toContain('₹');
    expect(none).toContain('confirm your booking');
  });

  test('the confirmation carries the wedding reference and date when known', () => {
    const text = buildBookingConfirmedMessage('A', 'WED-2026-0003', '5 Dec 2026');
    expect(text).toContain('WED-2026-0003');
    expect(text).toContain('for 5 Dec 2026');
    expect(buildBookingConfirmedMessage(null, null)).toContain('Congratulations!');
  });
});
