import { describe, expect, test } from 'bun:test';
import { consultationQuotationPrefill } from './quotationPrefill';

describe('consultationQuotationPrefill', () => {
  test('maps selected vendors to matching services', () => {
    expect(
      consultationQuotationPrefill(['Venue', 'Decoration', 'Photography'], [
        { serviceKey: ' photography ', vendorId: 'vendor-a' },
        { serviceKey: 'Decoration', vendorId: 'vendor-b' },
      ])
    ).toEqual([
      { description: 'Venue', category: 'Venue', vendorId: undefined },
      { description: 'Decoration', category: 'Decoration', vendorId: 'vendor-b' },
      { description: 'Photography', category: 'Photography', vendorId: 'vendor-a' },
    ]);
  });

  test('does not match different service names', () => {
    expect(
      consultationQuotationPrefill(['Makeup'], [{ serviceKey: 'Photography', vendorId: 'vendor-a' }])
    ).toEqual([{ description: 'Makeup', category: 'Makeup', vendorId: undefined }]);
  });
});
