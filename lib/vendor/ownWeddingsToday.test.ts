/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { withOwnWeddings } from './ownWeddingsToday';
import type { VendorTodayView } from './todayView';
import type { VenueWeddingListItem } from '@/services/venueWedding.service';

// Today must count the business's OWN weddings too (launch walkthrough, 11 Nov 2026: "0 upcoming weddings" with 5 confirmed).
const empty: VendorTodayView = {
  nextAction: { title: 'Nothing needs your attention right now', tone: 'calm' },
  attentionItems: [], todaysServices: [], upcomingWeddings: [], pendingResponses: [], recentActivity: [],
};
const own = (id: string, daysToGo: number | null, stage: VenueWeddingListItem['stage'] = 'PLANNING'): VenueWeddingListItem => ({
  id, number: `KUS-WED-${id}`, customerName: `Couple ${id}`, date: '2027-01-20', guestCount: 200, stage, stageLabel: stage, daysToGo, functions: ['Haldi', 'Wedding'],
});

describe("Today with the business's own weddings", () => {
  test('own upcoming weddings are counted and listed, nearest first, each opening its own wedding', () => {
    const v = withOwnWeddings(empty, [own('b', 30), own('a', 5)]);
    expect(v.upcomingCount).toBe(2);
    expect(v.upcomingWeddings.map((w) => w.wedding)).toEqual(['Couple a', 'Couple b']);
    expect(v.upcomingWeddings[0].href).toBe('/vendor/weddings/a');
    expect(v.nextAction.title).toBe('Next: Couple a — Haldi, Wedding');
  });

  test("a wedding today is in today's services and is the next action", () => {
    const v = withOwnWeddings(empty, [own('t', 0), own('u', 3)]);
    expect(v.todaysServices.map((s) => s.wedding)).toEqual(['Couple t']);
    expect(v.upcomingCount).toBe(1);
    expect(v.nextAction.title).toBe('Today: Couple t — Haldi, Wedding');
  });

  test('completed, cancelled, postponed and past weddings are left out', () => {
    const v = withOwnWeddings(empty, [own('c', 4, 'COMPLETED'), own('x', 4, 'CANCELLED'), own('p', 4, 'POSTPONED'), own('old', -3), own('n', null)]);
    expect(v.upcomingCount).toBe(0);
    expect(v.todaysServices).toHaveLength(0);
    expect(v.nextAction.title).toBe('Nothing needs your attention right now');
  });

  test("Shaadi Shopping's bookings and own weddings are sorted together; the count is not capped by the list", () => {
    const base = { ...empty, upcomingWeddings: [{ id: 'ss', wedding: 'SS wedding', date: '12 Nov', function: 'Sangeet', daysToGo: 10 }] };
    const v = withOwnWeddings(base, Array.from({ length: 7 }, (_, i) => own(String(i), i + 1)));
    expect(v.upcomingCount).toBe(8);
    expect(v.upcomingWeddings).toHaveLength(6);
    expect(v.upcomingWeddings[0].wedding).toBe('Couple 0');
  });

  test('something that needs attention stays the next action', () => {
    const v = withOwnWeddings({ ...empty, nextAction: { title: 'Respond to booking request — X', tone: 'attention' } }, [own('a', 2)]);
    expect(v.nextAction.title).toBe('Respond to booking request — X');
  });

  test('not loaded yet, or not allowed: Today is unchanged', () => {
    const v = withOwnWeddings(empty, null);
    expect(v.upcomingCount).toBe(0);
    expect(v.nextAction).toEqual(empty.nextAction);
  });
});
