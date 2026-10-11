/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { balanceReminderMessage, buildCollections, daysToWeddingWords, type CollectionRow } from './collections';

const NOW = new Date('2026-10-11T06:00:00+05:30');
const BUSINESS = { name: 'Swayamvar Hall', payOnLink: true };

const row = (over: Partial<CollectionRow> = {}): CollectionRow => ({
  enquiryId: 'e1',
  customerName: 'Rahul Kumar',
  phone: '9876543210',
  weddingDate: '2026-11-20',
  quotationNumber: 'SWA-QTN-202610-0001',
  weddingId: null,
  total: 100000,
  received: 30000,
  outstanding: 70000,
  confirmed: true,
  toConfirmRemaining: 0,
  stateLabel: 'Booking confirmed',
  claimsToCheck: 0,
  payments: [{ amount: 30000, paidAt: '2026-10-05T10:00:00.000Z' }],
  ...over,
});

describe('buildCollections', () => {
  test('no bookings: nothing to collect, nothing received', () => {
    expect(buildCollections([], NOW, BUSINESS)).toMatchObject({ toCollect: 0, receivedThisMonth: 0, monthLabel: 'October 2026', due: [], paidInFull: [], businessName: 'Swayamvar Hall', payOnLink: true });
  });

  test('adds up what is still owed and splits owing from paid in full', () => {
    const out = buildCollections(
      [row(), row({ enquiryId: 'e2', customerName: 'Anita', outstanding: 20000, received: 80000 }), row({ enquiryId: 'e3', customerName: 'Paid', outstanding: 0, received: 100000 })],
      NOW,
      BUSINESS,
    );
    expect(out.toCollect).toBe(90000);
    expect(out.due.map((i) => i.enquiryId).sort()).toEqual(['e1', 'e2']);
    expect(out.paidInFull.map((i) => i.enquiryId)).toEqual(['e3']);
  });

  test('the nearest wedding first; a date already passed before all; no date last', () => {
    const out = buildCollections(
      [row({ enquiryId: 'far', weddingDate: '2027-02-01' }), row({ enquiryId: 'none', weddingDate: null }), row({ enquiryId: 'past', weddingDate: '2026-10-01' }), row({ enquiryId: 'near', weddingDate: '2026-10-12' })],
      NOW,
      BUSINESS,
    );
    expect(out.due.map((i) => i.enquiryId)).toEqual(['past', 'near', 'far', 'none']);
    expect(out.due.map((i) => i.daysToWedding)).toEqual([-10, 1, 113, null]);
  });

  test('a date that is not a clear YYYY-MM-DD is treated as no date', () => {
    expect(buildCollections([row({ weddingDate: 'next winter' })], NOW, BUSINESS).due[0]).toMatchObject({ weddingDate: null, daysToWedding: null });
  });

  test('received this month counts payments dated this month in India — not last month, and by the Indian day', () => {
    const out = buildCollections(
      [
        row({
          payments: [
            { amount: 1000, paidAt: '2026-09-30T18:00:00.000Z' }, // 11:30 pm on 30 Sep in India — last month
            { amount: 2000, paidAt: '2026-09-30T19:00:00.000Z' }, // 12:30 am on 1 Oct in India — this month
            { amount: 4000, paidAt: '2026-10-10T08:00:00.000Z' },
          ],
        }),
        row({ enquiryId: 'e2', outstanding: 0, payments: [{ amount: 8000, paidAt: '2026-10-02T08:00:00.000Z' }] }),
      ],
      NOW,
      BUSINESS,
    );
    expect(out.receivedThisMonth).toBe(14000);
  });

  test('the payments themselves are not passed on to the screen', () => {
    expect(buildCollections([row()], NOW, BUSINESS).due[0]).not.toHaveProperty('payments');
  });
});

describe('daysToWeddingWords', () => {
  test('words for each case', () => {
    expect([null, 12, 1, 0, -3].map(daysToWeddingWords)).toEqual([null, 'in 12 days', 'tomorrow', 'today', 'date has passed']);
  });
});

describe('balanceReminderMessage', () => {
  const item = buildCollections([row()], NOW, BUSINESS).due[0];

  test('a confirmed booking: who, which booking, how much is left, and where to pay', () => {
    const text = balanceReminderMessage(item, { businessName: 'Swayamvar Hall', payOnLink: true });
    expect(text).toContain('Namaste Rahul Kumar,');
    expect(text).toContain('your booking with Swayamvar Hall for 20 Nov 2026 (quotation SWA-QTN-202610-0001)');
    expect(text).toContain('₹70,000 is still to be paid.');
    expect(text).toContain('"I have paid"');
    expect(text.endsWith('Thank you,\nSwayamvar Hall')).toBe(true);
  });

  test('not yet confirmed: says what confirms the booking', () => {
    const text = balanceReminderMessage({ ...item, confirmed: false, toConfirmRemaining: 5000, outstanding: 75000 }, { businessName: 'Swayamvar Hall', payOnLink: true });
    expect(text).toContain('₹5,000 more confirms your booking. In all, ₹75,000 is still to be paid.');
  });

  test('without a UPI ID in Settings the link has nowhere to pay — it is not mentioned', () => {
    const text = balanceReminderMessage(item, { businessName: 'Swayamvar Hall', payOnLink: false });
    expect(text).not.toContain('link');
    expect(text).not.toContain('I have paid');
  });

  test('no wedding date: the date is left out', () => {
    expect(balanceReminderMessage({ ...item, weddingDate: null }, { businessName: 'Swayamvar Hall', payOnLink: false })).toContain('your booking with Swayamvar Hall (quotation');
  });

  test('never says "marketplace" and never carries a link or a number of its own', () => {
    const text = balanceReminderMessage(item, { businessName: 'Swayamvar Hall', payOnLink: true });
    expect(text.toLowerCase()).not.toContain('marketplace');
    expect(text).not.toContain('http');
  });
});
