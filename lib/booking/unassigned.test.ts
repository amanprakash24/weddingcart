/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { UNASSIGNED_VENDOR_NAME, agreedPriceFor, isUnassignedItem, planVendorlessItem } from './unassigned';

const item = {
  packageName: 'Stage decoration',
  vendorName: UNASSIGNED_VENDOR_NAME,
  vendorCategory: 'Decorators',
  price: 40000,
  quantity: 1,
};

describe('agreedPriceFor — a vendor booking is the whole line, not one unit of it', () => {
  test('500 plates × ₹800 is ₹4,00,000 (conversion used to record ₹800)', () => {
    expect(agreedPriceFor({ price: 800, quantity: 500 })).toBe(400000);
  });

  test('a single unit is unchanged, so existing marketplace bookings behave as before', () => {
    expect(agreedPriceFor({ price: 50000, quantity: 1 })).toBe(50000);
  });

  test('a zero price stays zero', () => {
    expect(agreedPriceFor({ price: 0, quantity: 12 })).toBe(0);
  });
});

describe('isUnassignedItem', () => {
  test('recognises the placeholder vendor name and nothing else', () => {
    expect(isUnassignedItem(item)).toBe(true);
    expect(isUnassignedItem({ vendorName: 'Royal Caterers' })).toBe(false);
    expect(isUnassignedItem({ vendorName: 'to be assigned' })).toBe(false);
  });
});

describe('planVendorlessItem — honest wording for the two reasons a line has no vendor', () => {
  test('a quoted custom line says a vendor has not been assigned, with the amount to allocate', () => {
    const plan = planVendorlessItem({ ...item, price: 800, quantity: 500 });
    expect(plan.summary).toBe('No vendor assigned yet for "Stage decoration" (Decorators) — ₹4,00,000 to allocate');
    expect(plan.taskTitle).toBe('Assign a vendor for "Stage decoration"');
    expect(plan.taskDescription).toContain('500 × ₹800 = ₹4,00,000');
    // it must NOT claim a vendor was removed
    expect(plan.summary).not.toContain('no longer exists');
    expect(plan.taskDescription).not.toContain('no longer exists');
  });

  test('a real vendor that was removed keeps the original wording exactly', () => {
    const plan = planVendorlessItem({ ...item, vendorName: 'Touch Of Cozy', vendorCategory: 'Venues', price: 300000 });
    expect(plan.summary).toBe('Skipped converting "Stage decoration" (Touch Of Cozy) — vendor no longer exists');
    expect(plan.taskTitle).toBe('Assign replacement vendor for "Stage decoration"');
    expect(plan.taskDescription).toBe('Original vendor "Touch Of Cozy" (Venues) no longer exists. Original price: 300000.');
  });
});
