import { describe, expect, test } from 'bun:test';
import { checkChecklistItem, checklistGroup, checklistSeed, CHECKLIST_TEMPLATE } from './checklist';
import { budgetSummary, checkExpense, checkPlanned, checkTotal } from './coupleBudget';

describe('the ready-made checklist', () => {
  test('keys are unique', () => {
    expect(new Set(CHECKLIST_TEMPLATE.map((t) => t.key)).size).toBe(CHECKLIST_TEMPLATE.length);
  });
  test('dated back from the wedding day; function items only for functions the wedding has', () => {
    const seed = checklistSeed('2027-06-01', ['WEDDING', 'HALDI'], '2026-11-25');
    const keys = seed.map((s) => s.templateKey);
    expect(keys).toContain('haldi-items');
    expect(keys).toContain('baraat');
    expect(keys).not.toContain('book-mehndi');
    expect(keys).not.toContain('tilak');
    expect(seed.find((s) => s.templateKey === 'book-venue')?.dueDate?.toISOString().slice(0, 10)).toBe('2026-12-23'); // 160 days before
    expect(seed.find((s) => s.templateKey === 'rest')?.dueDate?.toISOString().slice(0, 10)).toBe('2027-05-31');
  });
  test('a wedding a few days away: past steps come undated, not overdue', () => {
    const seed = checklistSeed('2026-11-30', ['WEDDING'], '2026-11-25');
    expect(seed.find((s) => s.templateKey === 'book-venue')?.dueDate).toBeNull();
    expect(seed.find((s) => s.templateKey === 'pack-bags')?.dueDate?.toISOString().slice(0, 10)).toBe('2026-11-27');
  });
  test('groups', () => {
    const today = '2026-11-25';
    expect(checklistGroup({ done: true, dueDate: '2026-01-01' }, today)).toBe('DONE');
    expect(checklistGroup({ done: false, dueDate: null }, today)).toBe('EARLIER');
    expect(checklistGroup({ done: false, dueDate: '2026-11-24' }, today)).toBe('OVERDUE');
    expect(checklistGroup({ done: false, dueDate: '2026-12-02' }, today)).toBe('THIS_WEEK');
    expect(checklistGroup({ done: false, dueDate: '2026-12-03' }, today)).toBe('LATER');
  });
  test('an item the couple writes', () => {
    expect(checkChecklistItem({ title: '  Buy  sehra ', dueDate: '2026-11-28' })).toMatchObject({ ok: true, value: { title: 'Buy sehra', notes: null } });
    expect(checkChecklistItem({ title: ' ' })).toMatchObject({ ok: false });
    expect(checkChecklistItem({ title: 'x', dueDate: '2026-02-30' })).toMatchObject({ ok: false });
  });
});

describe('the couple’s budget', () => {
  test('inputs', () => {
    expect(checkTotal('8,00,000')).toEqual({ ok: true, value: 800000 });
    expect(checkTotal('')).toEqual({ ok: true, value: null });
    expect(checkTotal('-5')).toMatchObject({ ok: false });
    expect(checkPlanned('OUTFITS', 150000)).toEqual({ ok: true, value: { category: 'OUTFITS', planned: 150000 } });
    expect(checkPlanned('CAR', 1)).toMatchObject({ ok: false });
    expect(checkExpense({ category: 'OUTFITS', title: 'Lehenga', amount: '85000', paid: '20000' })).toMatchObject({ ok: true, value: { amount: 85000, paid: 20000 } });
    expect(checkExpense({ category: 'OUTFITS', title: 'Lehenga', amount: 1000, paid: 2000 })).toMatchObject({ ok: false });
    expect(checkExpense({ category: 'OUTFITS', title: 'Lehenga', amount: 0 })).toMatchObject({ ok: false });
  });
  test('summary: booked + own vendors + expenses against the total', () => {
    const s = budgetSummary({
      total: 500000,
      planned: [{ category: 'OUTFITS', planned: 150000 }],
      booked: { agreed: 85500, paid: 21375 },
      ownVendors: [{ price: 45000 }, { price: null }],
      expenses: [{ category: 'OUTFITS', amount: 85000, paid: 20000 }, { category: 'GIFTS', amount: 10000, paid: 10000 }],
    });
    expect(s).toMatchObject({ committed: 225500, paid: 51375, left: 274500, plannedTotal: 150000, parts: { booked: 85500, ownVendors: 45000, expenses: 95000 } });
    expect(s.categories).toEqual([
      { category: 'OUTFITS', label: 'Outfits', planned: 150000, spent: 85000 },
      { category: 'GIFTS', label: 'Gifts & shagun', planned: null, spent: 10000 },
    ]);
    expect(budgetSummary({ total: null, planned: [], booked: { agreed: 0, paid: 0 }, ownVendors: [], expenses: [] }).left).toBeNull();
  });
});
