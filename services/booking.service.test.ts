/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import type { VendorWithRelations } from '@/repositories/vendor.repository';
import { NotFoundError } from '@/lib/errors';

// Replaces the repository modules wholesale (rather than importing them and
// reassigning a method) so this test never loads lib/prisma.ts — no real
// DATABASE_URL/DB connection needed, same "no external dependency" discipline
// as lib/crypto/encryption.test.ts. Must be registered before booking.service
// is imported, hence the dynamic import below instead of a static one.
function fakeVendor(): VendorWithRelations {
  return {
    id: 'vendor-1',
    slug: 'some-vendor',
    packages: [
      {
        id: 'pkg-1',
        legacyMongoId: null,
        vendorId: 'vendor-1',
        name: 'Basic Package',
        description: 'A basic package',
        price: 5000, // authoritative price — must win over any client-supplied price
        features: [],
        isPopular: false,
        isPerPlate: false,
        image: '',
      },
    ],
    faqs: [],
  } as unknown as VendorWithRelations;
}

describe('bookingService.create', () => {
  test('creates a booking with the server-side VendorPackage price, ignoring a client-supplied price', async () => {
    const findBySlug = mock(async () => fakeVendor());
    const create = mock(async (data: unknown) => ({ id: 'booking-1', ...(data as Record<string, unknown>) }));

    mock.module('@/repositories/vendor.repository', () => ({ vendorRepository: { findBySlug } }));
    mock.module('@/repositories/booking.repository', () => ({ bookingRepository: { create } }));
    const { bookingService } = await import('./booking.service');

    const booking = await bookingService.create({
      name: 'Priya Sharma',
      phone: '9876543210',
      city: 'Patna',
      total: 1, // bogus client-supplied total — must be ignored
      items: [
        {
          vendorId: 'some-vendor',
          vendorName: 'Some Vendor',
          vendorCategory: 'Venues',
          packageName: 'Basic Package',
          price: 1, // bogus client-supplied price — must be ignored
          quantity: 2,
        },
      ],
    });

    expect(booking).toBeTruthy();
    expect(create).toHaveBeenCalledTimes(1);
    const persisted = create.mock.calls[0][0] as { total: number };
    expect(persisted.total).toBe(5000 * 2); // real VendorPackage price, not the client's 1
  });

  test('rejects a booking whose vendor slug does not resolve', async () => {
    const findBySlug = mock(async () => null);
    mock.module('@/repositories/vendor.repository', () => ({ vendorRepository: { findBySlug } }));
    const { bookingService } = await import('./booking.service');

    await expect(
      bookingService.create({
        name: 'Priya Sharma',
        phone: '9876543210',
        city: 'Patna',
        total: 5000,
        items: [
          {
            vendorId: 'no-such-vendor',
            vendorName: 'Some Vendor',
            vendorCategory: 'Venues',
            packageName: 'Basic Package',
            price: 5000,
            quantity: 1,
          },
        ],
      })
    ).rejects.toThrow(NotFoundError);
  });

  test("rejects a booking whose packageName does not match any of the vendor's real packages", async () => {
    const findBySlug = mock(async () => fakeVendor());
    mock.module('@/repositories/vendor.repository', () => ({ vendorRepository: { findBySlug } }));
    const { bookingService } = await import('./booking.service');

    await expect(
      bookingService.create({
        name: 'Priya Sharma',
        phone: '9876543210',
        city: 'Patna',
        total: 5000,
        items: [
          {
            vendorId: 'some-vendor',
            vendorName: 'Some Vendor',
            vendorCategory: 'Venues',
            packageName: 'Nonexistent Package',
            price: 5000,
            quantity: 1,
          },
        ],
      })
    ).rejects.toThrow(NotFoundError);
  });
});
