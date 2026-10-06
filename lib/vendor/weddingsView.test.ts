/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { buildVendorWeddingsView, type VendorBookingRow } from './weddingsView';

function row(overrides: Partial<VendorBookingRow> = {}): VendorBookingRow {
  return {
    id: 'vb-1',
    bookingStatus: 'CONFIRMED',
    venueStatus: 'PENDING',
    amount: 50000,
    event: {
      id: 'wedding-1',
      name: 'Priya & Rahul',
      reference: 'WED-000123',
      type: 'Wedding',
      guestCount: 500,
      function: 'Sangeet',
      date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      startTime: '19:00',
      venueName: 'Grand Hall',
      venueAddress: null,
      city: 'Patna',
      functions: [],
    },
    requirements: { name: 'Standard Sound Package', description: '' },
    tasks: [],
    ...overrides,
  } as VendorBookingRow;
}

describe('buildVendorWeddingsView', () => {
  test('empty input produces an empty list', () => {
    expect(buildVendorWeddingsView([])).toEqual([]);
  });

  test('groups multiple bookings for the same wedding into one card', () => {
    const rows = [row({ id: 'vb-1', event: { ...row().event, function: 'Sangeet' } }), row({ id: 'vb-2', event: { ...row().event, function: 'Reception' } })];
    const cards = buildVendorWeddingsView(rows);
    expect(cards).toHaveLength(1);
    expect(cards[0].bookings).toHaveLength(2);
  });

  test('a booking awaiting vendor confirmation makes the wedding need attention', () => {
    const cards = buildVendorWeddingsView([row({ bookingStatus: 'PENDING_VENDOR_CONFIRMATION' })]);
    expect(cards[0].overallStatus).toBe('needs-attention');
    expect(cards[0].nextAction).toContain('Respond to booking request');
  });

  test('an overdue task makes the wedding need attention, independent of booking status', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const cards = buildVendorWeddingsView([row({ tasks: [{ id: 't1', title: 'Confirm menu count', status: 'TODO', dueAt: past }] })]);
    expect(cards[0].overallStatus).toBe('needs-attention');
    expect(cards[0].nextAction).toContain('Confirm menu count is overdue');
    expect(cards[0].bookings[0].overdueTasks).toHaveLength(1);
  });

  test('a done task due in the past is not overdue', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const cards = buildVendorWeddingsView([row({ tasks: [{ id: 't1', title: 'Confirm menu count', status: 'DONE', dueAt: past }] })]);
    expect(cards[0].overallStatus).toBe('upcoming');
  });

  test('all bookings completed and in the past is a completed wedding', () => {
    const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const cards = buildVendorWeddingsView([row({ bookingStatus: 'COMPLETED', event: { ...row().event, date: past } })]);
    expect(cards[0].overallStatus).toBe('completed');
    expect(cards[0].isPast).toBe(true);
  });

  test('a confirmed future booking with no issues is upcoming with a "Next:" action', () => {
    const cards = buildVendorWeddingsView([row()]);
    expect(cards[0].overallStatus).toBe('upcoming');
    expect(cards[0].nextAction).toContain('Next:');
  });

  test('cards are sorted by primary date ascending', () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const later = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
    const cards = buildVendorWeddingsView([
      row({ id: 'a', event: { ...row().event, id: 'wedding-later', date: later } }),
      row({ id: 'b', event: { ...row().event, id: 'wedding-soon', date: soon } }),
    ]);
    expect(cards.map((c) => c.weddingId)).toEqual(['wedding-soon', 'wedding-later']);
  });

  test('vendor amount is carried through per booking, never a wedding-level total', () => {
    const cards = buildVendorWeddingsView([row({ amount: 75000 })]);
    expect(cards[0].bookings[0].amount).toBe(75000);
  });

  describe('venue setup status (Venue Owner specialization)', () => {
    test('carries venueStatus through per booking, not per wedding', () => {
      const cards = buildVendorWeddingsView([row({ venueStatus: 'READY' })]);
      expect(cards[0].bookings[0].venueStatus).toBe('READY');
    });

    test('computes the correct next step for every non-terminal status', () => {
      const nextFor = (venueStatus: VendorBookingRow['venueStatus']) => buildVendorWeddingsView([row({ venueStatus })])[0].bookings[0].nextVenueStatus;
      expect(nextFor('PENDING')).toBe('READY_FOR_SETUP');
      expect(nextFor('READY_FOR_SETUP')).toBe('SETUP_IN_PROGRESS');
      expect(nextFor('SETUP_IN_PROGRESS')).toBe('READY');
      expect(nextFor('READY')).toBe('COMPLETED');
    });

    test('COMPLETED has no next step', () => {
      const cards = buildVendorWeddingsView([row({ venueStatus: 'COMPLETED' })]);
      expect(cards[0].bookings[0].nextVenueStatus).toBeNull();
    });

    test('two bookings in the same wedding track independent venue statuses', () => {
      const cards = buildVendorWeddingsView([
        row({ id: 'vb-1', venueStatus: 'PENDING', event: { ...row().event, function: 'Sangeet' } }),
        row({ id: 'vb-2', venueStatus: 'READY', event: { ...row().event, function: 'Reception' } }),
      ]);
      expect(cards[0].bookings.find((b) => b.id === 'vb-1')?.venueStatus).toBe('PENDING');
      expect(cards[0].bookings.find((b) => b.id === 'vb-2')?.venueStatus).toBe('READY');
    });
  });
});
