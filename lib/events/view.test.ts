/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { eventView } from './view';

const event = () => ({
  id: 'ev1', title: 'Wedding Expo', status: 'PUBLISHED', passTypes: [{ id: 'p1', price: 500 }],
  orders: [{ id: 'o1', customerName: 'Priya', customerPhone: '9876543210', customerEmail: 'p@example.com', amount: 1000, paymentReference: 'pay_1' }],
  tickets: [{ id: 't1', ticketCode: 'TCK-1', qrCode: 'QR-1', attendeeName: 'Priya', attendeePhone: '9876543210' }],
});

describe('eventView', () => {
  test('the public never gets orders or tickets (names, phones, emails, amounts, ticket and QR codes)', () => {
    const view = eventView(event(), { isAdmin: false, isFounder: false });
    expect(view).toEqual({ id: 'ev1', title: 'Wedding Expo', status: 'PUBLISHED', passTypes: [{ id: 'p1', price: 500 }] });
    expect(JSON.stringify(view)).not.toMatch(/9876543210|p@example\.com|TCK-1|QR-1|pay_1/);
  });

  test('the team gets orders and tickets for check-in, but no order amounts', () => {
    const view = eventView(event(), { isAdmin: true, isFounder: false }) as unknown as { orders: { customerName: string; amount: number | null }[]; tickets: unknown[] };
    expect(view.orders[0]).toMatchObject({ customerName: 'Priya', amount: null });
    expect(view.tickets).toHaveLength(1);
  });

  test('the founder gets everything', () => {
    expect(eventView(event(), { isAdmin: true, isFounder: true })).toEqual(event());
  });
});
