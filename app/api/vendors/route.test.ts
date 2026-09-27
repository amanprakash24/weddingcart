/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { NextRequest } from 'next/server';
import { ValidationError } from '@/lib/errors';

const create = mock(async (data: Record<string, unknown>) => ({
  id: 'vendor-1',
  ...data,
}));

mock.module('@/lib/adminAuth', () => ({ requireAdmin: mock(async () => true) }));
mock.module('@/services/vendor.service', () => ({
  vendorService: { create },
}));

function postRequest(body: unknown) {
  return new NextRequest('http://localhost/api/vendors', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const CATEGORY_ID = '51361797-941d-4890-b369-4c9c0d27d8f6';
const VALID_BODY = {
  name: 'DB Test Venue',
  ownerName: 'Test Owner',
  ownerPhone: '9876543210',
  ownerEmail: 'owner@example.com',
  categoryId: CATEGORY_ID,
  city: 'Patna',
  address: 'Test address',
  area: 'Danapur',
  priceMin: 50000,
  priceMax: 200000,
  priceUnit: 'PACKAGE',
  guestCapacity: 300,
  venueType: 'Banquet Hall',
  defaultTerms: 'Test terms',
  image: 'https://example.com/venue.jpg',
  images: ['https://example.com/venue.jpg'],
  virtualTourVideo: '',
  description: 'A test venue description.',
  features: ['Parking'],
  isFeatured: false,
  status: 'DRAFT',
  faqs: [],
};

const { POST } = await import('./route');

describe('POST /api/vendors', () => {
  test('creates a vendor with the Category UUID and returns the service result', async () => {
    create.mockClear();

    const res = await POST(postRequest(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(201);
    const { faqs: _faqs, ...createdVendorFields } = VALID_BODY;
    expect(body).toEqual({ success: true, data: { id: 'vendor-1', ...createdVendorFields } });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0]).toMatchObject({ categoryId: CATEGORY_ID });
    expect(create.mock.calls[0]?.[0]).not.toMatchObject({ categoryId: 'venue' });
  });

  test('passes service errors through handleApiError instead of the old generic response', async () => {
    create.mockImplementationOnce(async () => {
      throw new ValidationError('Category UUID is invalid');
    });

    const res = await POST(postRequest(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ success: false, error: 'Category UUID is invalid' });
    expect(body.error).not.toBe('Failed to create vendor');
  });
});
