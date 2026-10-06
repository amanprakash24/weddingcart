/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { groupAvailabilityByMonth, type VendorAvailabilityRow } from './availabilityView';

function row(date: string, status: VendorAvailabilityRow['status'] = 'AVAILABLE', note: string | null = null): VendorAvailabilityRow {
  return { date, status, note };
}

describe('groupAvailabilityByMonth', () => {
  test('empty input produces an empty list', () => {
    expect(groupAvailabilityByMonth([])).toEqual([]);
  });

  test('groups entries into the correct month bucket', () => {
    const groups = groupAvailabilityByMonth([row('2026-09-05'), row('2026-09-20'), row('2026-10-02')]);
    expect(groups).toHaveLength(2);
    expect(groups[0].entries).toHaveLength(2);
    expect(groups[1].entries).toHaveLength(1);
  });

  test('months are sorted chronologically even if input order is not', () => {
    const groups = groupAvailabilityByMonth([row('2026-11-01'), row('2026-09-01'), row('2026-10-01')]);
    expect(groups.map((g) => g.monthKey)).toEqual(['2026-09', '2026-10', '2026-11']);
  });

  test('entries within a month are sorted by date ascending', () => {
    const groups = groupAvailabilityByMonth([row('2026-09-20'), row('2026-09-05')]);
    expect(groups[0].entries.map((e) => e.date)).toEqual(['2026-09-05', '2026-09-20']);
  });

  test('status and note pass through unchanged', () => {
    const groups = groupAvailabilityByMonth([row('2026-09-05', 'BLOCKED', 'Personal event')]);
    expect(groups[0].entries[0].status).toBe('BLOCKED');
    expect(groups[0].entries[0].note).toBe('Personal event');
  });
});
