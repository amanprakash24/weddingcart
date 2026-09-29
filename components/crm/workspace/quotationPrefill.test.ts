import { describe, expect, test } from 'bun:test';
import { consultationQuotationPrefill, suggestedVendor } from './quotationPrefill';

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

  test('stored service keys become their customer-facing names; the vendor still matches on the key', () => {
    expect(
      consultationQuotationPrefill(['venue', 'photo-video', 'catering'], [{ serviceKey: 'venue', vendorId: 'vendor-7vachan' }])
    ).toEqual([
      { description: 'Venue', category: 'Venue', vendorId: 'vendor-7vachan' },
      { description: 'Photography & Video', category: 'Photography & Video', vendorId: undefined },
      { description: 'Catering', category: 'Catering', vendorId: undefined },
    ]);
  });
});

describe('suggestedVendor — the consultation choice, offered for a line without a vendor', () => {
  const selections = [{ serviceKey: 'venue', vendorId: 'v-7vachan', vendorName: '7 Vachan' }];
  test('matches the labelled line ("Venue") and an older raw-key line ("venue")', () => {
    expect(suggestedVendor({ category: 'Venue', description: 'Venue' }, selections)?.vendorName).toBe('7 Vachan');
    expect(suggestedVendor({ category: 'venue', description: 'venue' }, selections)?.vendorName).toBe('7 Vachan');
  });
  test('no match for other services or empty lines', () => {
    expect(suggestedVendor({ category: 'Catering', description: 'Catering' }, selections)).toBeNull();
    expect(suggestedVendor({ category: null, description: '' }, selections)).toBeNull();
  });
});
