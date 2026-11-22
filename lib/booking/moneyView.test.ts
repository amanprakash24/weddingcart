/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { Role } from '@/lib/auth/roles';
import { bookingMoneyView, canSetBookingStatus } from './moneyView';

const booking = () => ({
  id: 'b1', name: 'Priya', phone: '9876543210', city: 'Patna', status: 'new', total: 250000,
  items: [{ vendorName: 'Decor Co', packageName: 'Gold', price: 125000, quantity: 2 }],
});

describe('bookingMoneyView (old cart Bookings screen)', () => {
  test('founder: total and item prices kept', () => {
    expect(bookingMoneyView([Role.SUPER_ADMIN], booking())).toEqual(booking());
  });
  test.each([[Role.SALES], [Role.OPERATIONS]])('%s: total and prices withheld; names, contacts and items kept', (role) => {
    const view = bookingMoneyView([role], booking());
    expect(view.total).toBeNull();
    expect(view.items[0].price).toBeNull();
    expect(view).toMatchObject({ name: 'Priya', phone: '9876543210', city: 'Patna', status: 'new' });
    expect(view.items[0]).toMatchObject({ vendorName: 'Decor Co', packageName: 'Gold', quantity: 2 });
  });
  test('a booking without items still works', () => {
    expect(bookingMoneyView([Role.SALES], { total: 10 as number | null })).toEqual({ total: null });
  });
});

describe('canSetBookingStatus', () => {
  test('the team may mark new, contacted or closed', () => {
    for (const s of ['NEW', 'CONTACTED', 'CLOSED']) expect(canSetBookingStatus([Role.SALES], s)).toBe(true);
  });
  test('only the founder confirms (it creates the wedding and its money)', () => {
    expect(canSetBookingStatus([Role.SALES], 'CONFIRMED')).toBe(false);
    expect(canSetBookingStatus([Role.OPERATIONS], 'CONFIRMED')).toBe(false);
    expect(canSetBookingStatus([Role.SUPER_ADMIN], 'CONFIRMED')).toBe(true);
  });
});
