/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CUSTOMER_ACTIVITY_TYPES, customerActivityText } from './activityText';

// What a couple may see of their timeline (Customer Portal). Staff summaries carry prices and commission — they must never reach it.
describe('customer activity text', () => {
  test('only an allow-list of event types, each with one fixed sentence', () => {
    expect(CUSTOMER_ACTIVITY_TYPES.sort()).toEqual(['DOCUMENT_UPLOADED', 'PAYMENT_RECEIVED', 'VENDOR_CONFIRMED', 'VENDOR_DECLINED']);
    expect(customerActivityText('PAYMENT_RECEIVED')).toBe('Payment received — thank you');
  });

  test('STATUS_CHANGED (payouts, commission, agreed prices are logged under it) and every internal type are left out', () => {
    for (const t of ['STATUS_CHANGED', 'NOTE', 'CALL', 'ASSIGNED', 'TASK_COMPLETED', 'QUOTATION_SENT', 'APPROVAL_REQUESTED']) expect(customerActivityText(t)).toBeNull();
  });

  test('the portal maps through it and never passes a staff summary', () => {
    const src = readFileSync(join(import.meta.dir, '..', '..', 'services', 'clientPortal.service.ts'), 'utf8');
    expect(src).toContain('customerActivityText(entry.type)');
    expect(src).not.toMatch(/summary:\s*entry\.summary/);
  });
});
