/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { buildVendorPaymentsView, type VendorPayoutRow } from './paymentsView';
import type { VendorBookingRow } from './weddingsView';

function bookingRow(overrides: Partial<VendorBookingRow> = {}): VendorBookingRow {
  return {
    id: 'vb-1',
    bookingStatus: 'COMPLETED',
    venueStatus: 'COMPLETED',
    respondedAt: null,
    amount: 50000,
    event: {
      id: 'wedding-1', name: 'Priya & Rahul', reference: 'WED-000123', type: 'Wedding', guestCount: 500,
      function: 'Sangeet', date: '2026-08-01T00:00:00.000Z', startTime: '19:00',
      venueName: 'Grand Hall', venueAddress: null, city: 'Patna', functions: [],
    },
    requirements: { name: 'Sound & Lighting', description: '' },
    tasks: [],
    ...overrides,
  } as VendorBookingRow;
}

function payoutRow(overrides: Partial<VendorPayoutRow> = {}): VendorPayoutRow {
  return {
    id: 'payout-1',
    bookingId: 'vb-1',
    weddingName: 'Priya & Rahul',
    weddingReference: 'WED-000123',
    function: 'Sangeet',
    eventDate: '2026-08-01T00:00:00.000Z',
    grossAmount: 50000,
    commissionRate: 10,
    commissionAmount: 5000,
    netAmount: 45000,
    status: 'PAID',
    paidAt: '2026-08-05T00:00:00.000Z',
    createdAt: '2026-08-02T00:00:00.000Z',
    ...overrides,
  } as VendorPayoutRow;
}

describe('buildVendorPaymentsView', () => {
  test('no bookings, no payouts: everything empty', () => {
    const view = buildVendorPaymentsView([], []);
    expect(view.paid).toEqual([]);
    expect(view.pending).toEqual([]);
    expect(view.awaitingCalculation).toEqual([]);
    expect(view.summary.awaitingCount).toBe(0);
  });

  test('a PAID payout appears in paid, not pending, and sums into totalReceived', () => {
    const view = buildVendorPaymentsView([bookingRow()], [payoutRow({ status: 'PAID', netAmount: 45000 })]);
    expect(view.paid).toHaveLength(1);
    expect(view.pending).toHaveLength(0);
    expect(view.summary.totalReceivedLabel).toBe('₹45,000');
    expect(view.summary.totalPendingLabel).toBe('₹0');
  });

  test('a PENDING payout appears in pending, not paid, and sums into totalPending', () => {
    const view = buildVendorPaymentsView([bookingRow()], [payoutRow({ status: 'PENDING', netAmount: 45000, paidAt: null })]);
    expect(view.pending).toHaveLength(1);
    expect(view.paid).toHaveLength(0);
    expect(view.summary.totalPendingLabel).toBe('₹45,000');
    expect(view.pending[0].paidOnLabel).toBeNull();
  });

  test('a COMPLETED booking with no matching payout is awaiting calculation', () => {
    const view = buildVendorPaymentsView([bookingRow({ id: 'vb-2', bookingStatus: 'COMPLETED' })], []);
    expect(view.awaitingCalculation).toHaveLength(1);
    expect(view.awaitingCalculation[0].bookingId).toBe('vb-2');
    expect(view.summary.awaitingCount).toBe(1);
  });

  test('a COMPLETED booking that already has a payout is not double-counted as awaiting', () => {
    const view = buildVendorPaymentsView(
      [bookingRow({ id: 'vb-1', bookingStatus: 'COMPLETED' })],
      [payoutRow({ bookingId: 'vb-1', status: 'PAID' })]
    );
    expect(view.awaitingCalculation).toHaveLength(0);
  });

  test('a non-COMPLETED booking with no payout is never awaiting calculation', () => {
    const view = buildVendorPaymentsView([bookingRow({ id: 'vb-3', bookingStatus: 'CONFIRMED' })], []);
    expect(view.awaitingCalculation).toHaveLength(0);
  });

  test('commission label includes rate', () => {
    const view = buildVendorPaymentsView([], [payoutRow({ commissionAmount: 5000, commissionRate: 10 })]);
    expect(view.paid[0].commissionLabel).toBe('₹5,000 (10%)');
  });
});
