/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { buildVendorTodayView } from './todayView';
import type { VendorBookingRow } from './weddingsView';

function row(overrides: Partial<VendorBookingRow> = {}): VendorBookingRow {
  return {
    id: 'vb-1',
    bookingStatus: 'CONFIRMED',
    venueStatus: 'READY',
    respondedAt: null,
    amount: 50000,
    event: {
      id: 'wedding-1', name: 'Priya & Rahul', reference: 'WED-000123', type: 'Wedding', guestCount: 500,
      function: 'Sangeet', date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), startTime: '19:00',
      venueName: 'Grand Hall', venueAddress: null, city: 'Patna', functions: [],
    },
    requirements: { name: 'Sound & Lighting', description: '' },
    tasks: [],
    ...overrides,
  } as VendorBookingRow;
}

describe('buildVendorTodayView', () => {
  test('no bookings: calm next action, everything else empty', () => {
    const view = buildVendorTodayView([]);
    expect(view.nextAction.tone).toBe('calm');
    expect(view.attentionItems).toEqual([]);
    expect(view.todaysServices).toEqual([]);
    expect(view.upcomingWeddings).toEqual([]);
    expect(view.pendingResponses).toEqual([]);
    expect(view.recentActivity).toEqual([]);
  });

  test('a booking awaiting confirmation is the highest-priority next action and appears in both lists', () => {
    const view = buildVendorTodayView([row({ bookingStatus: 'PENDING_VENDOR_CONFIRMATION' })]);
    expect(view.nextAction.tone).toBe('attention');
    expect(view.nextAction.title).toContain('Respond to booking request');
    expect(view.pendingResponses).toHaveLength(1);
    expect(view.attentionItems.some((a) => a.title.includes('Respond to booking request'))).toBe(true);
  });

  test("a booking dated today appears in today's services, not upcoming weddings", () => {
    const todayIso = new Date().toISOString();
    const view = buildVendorTodayView([row({ event: { ...row().event, date: todayIso } })]);
    expect(view.todaysServices).toHaveLength(1);
    expect(view.upcomingWeddings).toHaveLength(0);
  });

  test('a confirmed future booking appears in upcoming weddings', () => {
    const view = buildVendorTodayView([row()]);
    expect(view.upcomingWeddings).toHaveLength(1);
  });

  test('an overdue task appears in attention items', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const view = buildVendorTodayView([row({ tasks: [{ id: 't1', title: 'Confirm menu count', status: 'TODO', dueAt: past }] })]);
    expect(view.attentionItems.some((a) => a.title.includes('Confirm menu count'))).toBe(true);
  });

  test('recent activity is derived from respondedAt, most recent first, capped at 5', () => {
    const rows = Array.from({ length: 7 }, (_, i) =>
      row({ id: `vb-${i}`, bookingStatus: 'CONFIRMED', respondedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString() })
    );
    const view = buildVendorTodayView(rows);
    expect(view.recentActivity).toHaveLength(5);
    expect(view.recentActivity[0].id).toBe('vb-0');
  });

  test('a booking with no respondedAt never appears in recent activity', () => {
    const view = buildVendorTodayView([row({ respondedAt: null })]);
    expect(view.recentActivity).toEqual([]);
  });

  describe('venue setup risk (Venue Owner specialization)', () => {
    test('a venue booking imminent and not ready becomes the top attention item and next action', () => {
      const soon = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      const view = buildVendorTodayView([row({ event: { ...row().event, date: soon }, venueStatus: 'PENDING' })], true);
      expect(view.nextAction.title).toContain('Setup not ready');
      expect(view.attentionItems.some((a) => a.title.includes('Setup not ready'))).toBe(true);
    });

    test('the same imminent, not-ready booking is NOT flagged when the vendor is not a venue', () => {
      const soon = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      const view = buildVendorTodayView([row({ event: { ...row().event, date: soon }, venueStatus: 'PENDING' })], false);
      expect(view.attentionItems.some((a) => a.title.includes('Setup not ready'))).toBe(false);
    });

    test('a venue booking already READY is not flagged even if imminent', () => {
      const soon = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      const view = buildVendorTodayView([row({ event: { ...row().event, date: soon }, venueStatus: 'READY' })], true);
      expect(view.attentionItems.some((a) => a.title.includes('Setup not ready'))).toBe(false);
    });

    test('a venue booking not ready but far in the future is not flagged', () => {
      const view = buildVendorTodayView([row({ venueStatus: 'PENDING' })], true); // default event date is 5 days out
      expect(view.attentionItems.some((a) => a.title.includes('Setup not ready'))).toBe(false);
    });
  });
});
