/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { buildVendorServicesView } from './servicesView';
import type { VendorBookingRow } from './weddingsView';

function row(overrides: Partial<VendorBookingRow> = {}): VendorBookingRow {
  return {
    id: 'vb-1',
    bookingStatus: 'CONFIRMED',
    venueStatus: 'PENDING',
    amount: 50000,
    event: {
      id: 'wedding-1', name: 'Priya & Rahul', reference: 'WED-000123', type: 'Wedding', guestCount: 500,
      function: 'Sangeet', date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), startTime: '19:00',
      venueName: 'Grand Hall', venueAddress: null, city: 'Patna', functions: [],
    },
    requirements: { name: 'Sound & Lighting', description: 'Full PA system + stage lights' },
    tasks: [],
    ...overrides,
  } as VendorBookingRow;
}

describe('buildVendorServicesView', () => {
  test('empty input produces an empty list', () => {
    expect(buildVendorServicesView([])).toEqual([]);
  });

  test('is service-oriented: two bookings for the same wedding stay two separate cards', () => {
    const cards = buildVendorServicesView([row({ id: 'vb-1', event: { ...row().event, function: 'Sangeet' } }), row({ id: 'vb-2', event: { ...row().event, function: 'Reception' } })]);
    expect(cards).toHaveLength(2);
  });

  test('a booking awaiting vendor confirmation needs attention with the right next action', () => {
    const cards = buildVendorServicesView([row({ bookingStatus: 'PENDING_VENDOR_CONFIRMATION' })]);
    expect(cards[0].bucket).toBe('needs-attention');
    expect(cards[0].nextAction).toBe('Respond to this booking request');
  });

  test('an overdue task needs attention independent of booking status', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const cards = buildVendorServicesView([row({ tasks: [{ id: 't1', title: 'Confirm menu count', status: 'TODO', dueAt: past }] })]);
    expect(cards[0].bucket).toBe('needs-attention');
    expect(cards[0].nextAction).toBe('Confirm menu count is overdue');
    expect(cards[0].overdueTasks).toHaveLength(1);
  });

  test('a completed, past service is in the completed bucket', () => {
    const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const cards = buildVendorServicesView([row({ bookingStatus: 'COMPLETED', event: { ...row().event, date: past } })]);
    expect(cards[0].bucket).toBe('completed');
  });

  test('a confirmed future service with no issues is upcoming', () => {
    const cards = buildVendorServicesView([row()]);
    expect(cards[0].bucket).toBe('upcoming');
    expect(cards[0].nextAction).toContain('Service on');
  });

  test('carries the agreed amount and service name/description through unchanged', () => {
    const cards = buildVendorServicesView([row({ amount: 82000 })]);
    expect(cards[0].agreedAmount).toBe(82000);
    expect(cards[0].serviceName).toBe('Sound & Lighting');
    expect(cards[0].serviceDescription).toBe('Full PA system + stage lights');
  });

  test('cards are sorted by date ascending', () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const later = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
    const cards = buildVendorServicesView([
      row({ id: 'a', event: { ...row().event, date: later } }),
      row({ id: 'b', event: { ...row().event, date: soon } }),
    ]);
    expect(cards.map((c) => c.bookingId)).toEqual(['b', 'a']);
  });

  describe('venue setup status (Venue Owner specialization)', () => {
    test('carries venueStatus through unchanged', () => {
      const cards = buildVendorServicesView([row({ venueStatus: 'SETUP_IN_PROGRESS' })]);
      expect(cards[0].venueStatus).toBe('SETUP_IN_PROGRESS');
    });

    test('computes the correct next step for every non-terminal status, mirroring lib/wedding/lifecycle.ts', () => {
      const next = (venueStatus: VendorBookingRow['venueStatus']) => buildVendorServicesView([row({ venueStatus })])[0].nextVenueStatus;
      expect(next('PENDING')).toBe('READY_FOR_SETUP');
      expect(next('READY_FOR_SETUP')).toBe('SETUP_IN_PROGRESS');
      expect(next('SETUP_IN_PROGRESS')).toBe('READY');
      expect(next('READY')).toBe('COMPLETED');
    });

    test('COMPLETED has no next step', () => {
      const cards = buildVendorServicesView([row({ venueStatus: 'COMPLETED' })]);
      expect(cards[0].nextVenueStatus).toBeNull();
    });
  });
});
