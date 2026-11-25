import { describe, expect, test } from 'bun:test';
import { checkChecklistItem, checklistGroup, checklistSeed, CHECKLIST_TEMPLATE, redatedDue } from './checklist';
import { bookedByCategory, budgetCategoryFor, budgetSummary, checkExpense, checkPlanned, checkTotal } from './coupleBudget';

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
    expect(checklistGroup({ done: false, dueDate: null, ready: true }, today)).toBe('EARLIER');
    expect(checklistGroup({ done: false, dueDate: null, ready: false }, today)).toBe('ANYTIME'); // the couple's own, undated
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
      { category: 'OUTFITS', label: 'Outfits', planned: 150000, spent: 85000, booked: 0 },
      { category: 'GIFTS', label: 'Gifts & shagun', planned: null, spent: 10000, booked: 0 },
      { category: 'OTHER', label: 'Other', planned: null, spent: 45000, booked: 0 }, // an own vendor with no category words
    ]);
    expect(budgetSummary({ total: null, planned: [], booked: { agreed: 0, paid: 0 }, ownVendors: [], expenses: [] }).left).toBeNull();
  });

  test('what is booked with us shows under its category, split to add up to exactly the agreed total', () => {
    const s = budgetSummary({
      total: 1000000,
      planned: [{ category: 'VENUE', planned: 300000 }],
      booked: { agreed: 100001, paid: 25000 }, // after discount / GST the agreed total differs from the lines
      bookedLines: [
        { category: 'Venue', description: 'Grand hall — 500 guests', amount: 60000 },
        { category: 'Decorators', description: 'Decoration package', amount: 30000 },
        { category: null, description: 'Veg buffet dinner', amount: 10000 },
      ],
      ownVendors: [{ price: 40000, category: 'Photographer' }],
      expenses: [{ category: 'VENUE', amount: 5000, paid: 5000 }],
    });
    const by = Object.fromEntries(s.categories.map((c) => [c.category, c]));
    expect(by.VENUE).toMatchObject({ planned: 300000, booked: 60001, spent: 65001 });
    expect(by.DECOR).toMatchObject({ booked: 30000, spent: 30000 });
    expect(by.CATERING).toMatchObject({ booked: 10000, spent: 10000 });
    expect(by.PHOTO).toMatchObject({ booked: 0, spent: 40000 });
    expect(s.categories.reduce((n, c) => n + c.booked, 0)).toBe(100001);
    expect(s.committed).toBe(100001 + 40000 + 5000);
  });

  test('category words', () => {
    expect(budgetCategoryFor('Decorators', 'x')).toBe('DECOR');
    expect(budgetCategoryFor(null, 'Mandap decoration')).toBe('DECOR');
    expect(budgetCategoryFor('', 'DJ and sound')).toBe('MUSIC');
    expect(budgetCategoryFor('Makeup artist')).toBe('MAKEUP');
    expect(budgetCategoryFor('Pandit ji')).toBe('RITUALS');
    expect(budgetCategoryFor('Something else')).toBe('OTHER');
    expect(bookedByCategory(5000, [])).toEqual(new Map());
  });

  test('a real expense date only', () => {
    expect(checkExpense({ category: 'GIFTS', title: 'x', amount: 1, spentOn: '2026-13-45' })).toMatchObject({ ok: false });
    expect(checkExpense({ category: 'GIFTS', title: 'x', amount: 1, spentOn: '2026-02-30' })).toMatchObject({ ok: false });
    expect(checkExpense({ category: 'GIFTS', title: 'x', amount: 1, spentOn: '2026-12-01' })).toMatchObject({ ok: true });
  });
});

describe('ready-made dates follow the wedding day', () => {
  const today = '2026-11-25';
  test('unchanged wedding day: nothing moves, an overdue item stays overdue', () => {
    expect(redatedDue('book-venue', '2027-06-01', today, '2026-12-23')).toBeUndefined();
    expect(redatedDue('book-venue', '2027-05-01', '2026-12-30', '2026-11-22')).toBeUndefined(); // overdue since 22 Nov, day unchanged
    expect(redatedDue('book-venue', '2026-12-01', today, null)).toBeUndefined(); // still an earlier step
  });
  test('the wedding moved later: dates move, an earlier step gets its date back', () => {
    expect(redatedDue('book-venue', '2027-07-01', today, '2026-12-23')?.toISOString().slice(0, 10)).toBe('2027-01-22');
    expect(redatedDue('book-venue', '2027-07-01', today, null)?.toISOString().slice(0, 10)).toBe('2027-01-22');
  });
  test('the wedding moved earlier: a date now past becomes an earlier step', () => {
    expect(redatedDue('book-venue', '2027-03-01', today, '2026-12-23')).toBeNull();
  });
  test('an unknown key is left alone', () => {
    expect(redatedDue('nope', '2027-03-01', today, '2026-12-23')).toBeUndefined();
  });
});
