/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { functionOf, indiaDay, planLineFunctions } from './lineFunctions';

const d = (day: string) => new Date(`${day}T00:00:00.000Z`);
const weddingDay = d('2026-12-11');

describe('functionOf', () => {
  test('standard names, any case, become that function', () => {
    expect(functionOf('haldi')).toEqual({ type: 'HALDI', label: null });
    expect(functionOf(' Wedding ')).toEqual({ type: 'WEDDING', label: null });
  });
  test('any other name is kept as an "Other" function with that name', () => {
    expect(functionOf('Accommodation')).toEqual({ type: 'OTHER', label: 'Accommodation' });
    expect(functionOf('Welcome   dinner')).toEqual({ type: 'OTHER', label: 'Welcome dinner' });
  });
  test('no name joins the Wedding', () => {
    expect(functionOf(null)).toEqual({ type: 'WEDDING', label: null });
    expect(functionOf('  ')).toEqual({ type: 'WEDDING', label: null });
  });
});

describe('planLineFunctions', () => {
  test('one function per name and day; several services can share one', () => {
    const { created, targets } = planLineFunctions(
      [
        { key: 'a', functionLabel: 'Haldi', eventDate: d('2026-12-10') },
        { key: 'b', functionLabel: 'haldi', eventDate: d('2026-12-10') },
        { key: 'c', functionLabel: 'Wedding', eventDate: d('2026-12-11') },
        { key: 'd', functionLabel: 'Haldi', eventDate: d('2026-12-11') },
      ],
      weddingDay
    );
    expect(created.map((c) => `${c.type}@${indiaDay(c.date)}`)).toEqual(['HALDI@2026-12-10', 'WEDDING@2026-12-11', 'HALDI@2026-12-11']);
    expect(targets.get('a')).toEqual({ newIndex: 0 });
    expect(targets.get('b')).toEqual({ newIndex: 0 });
    expect(targets.get('d')).toEqual({ newIndex: 2 });
  });

  test('lines with no function and no day go to the Wedding on the wedding day — what older quotations did', () => {
    const { created, targets } = planLineFunctions(
      [
        { key: 'a', functionLabel: null, eventDate: null },
        { key: 'b', functionLabel: null, eventDate: null },
      ],
      weddingDay
    );
    expect(created).toEqual([{ type: 'WEDDING', label: null, date: weddingDay }]);
    expect([...targets.values()]).toEqual([{ newIndex: 0 }, { newIndex: 0 }]);
  });

  test('an existing function with the same name and day is reused, never duplicated', () => {
    const existing = [
      // stored at India midnight (older rows) — still the 10th in India
      { id: 'ev-acc', type: 'OTHER', label: 'accommodation', date: new Date('2026-12-09T18:30:00.000Z') },
      { id: 'ev-wed', type: 'WEDDING', label: null, date: d('2026-12-11') },
    ];
    const { created, targets } = planLineFunctions(
      [
        { key: 'a', functionLabel: 'Accommodation', eventDate: d('2026-12-10') },
        { key: 'b', functionLabel: 'Wedding', eventDate: null },
        { key: 'c', functionLabel: 'Accommodation', eventDate: d('2026-12-11') },
      ],
      weddingDay,
      existing
    );
    expect(targets.get('a')).toEqual({ existingId: 'ev-acc' });
    expect(targets.get('b')).toEqual({ existingId: 'ev-wed' });
    expect(created).toEqual([{ type: 'OTHER', label: 'Accommodation', date: d('2026-12-11') }]);
    expect(targets.get('c')).toEqual({ newIndex: 0 });
  });

  test('"Other" functions are told apart by their names', () => {
    const { created } = planLineFunctions(
      [
        { key: 'a', functionLabel: 'Accommodation', eventDate: d('2026-12-10') },
        { key: 'b', functionLabel: 'Welcome dinner', eventDate: d('2026-12-10') },
      ],
      weddingDay
    );
    expect(created.map((c) => c.label)).toEqual(['Accommodation', 'Welcome dinner']);
  });
});
