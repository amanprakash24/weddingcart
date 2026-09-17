/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import type { VendorWithRelations } from '@/repositories/vendor.repository';

// Separate file from enquiry.service.test.ts on purpose: that file already
// does a top-level `await import('./enquiry.service')` (to reach
// evaluateEnquiryDeleteGuard) before any per-test mock.module() call could
// run, so enquiry.service.ts's internal vendorRepository/enquiryRepository
// bindings would already be resolved to the real modules by the time a
// test here tried to mock them — same reasoning as booking.service.test.ts's
// own top-of-file comment about registering mocks before the first import.
function fakeVendor(): VendorWithRelations {
  return {
    id: 'vendor-1',
    slug: 'some-vendor',
    packages: [],
    faqs: [],
  } as unknown as VendorWithRelations;
}

describe('enquiryService.create', () => {
  test('connects consultationId via the relation field (never a raw scalar) when provided — Consultation -> Enquiry bridge', async () => {
    const findBySlug = mock(async () => fakeVendor());
    const create = mock(async (data: unknown) => ({ id: 'enquiry-1', ...(data as Record<string, unknown>) }));

    mock.module('@/repositories/vendor.repository', () => ({ vendorRepository: { findBySlug } }));
    mock.module('@/repositories/enquiry.repository', () => ({ enquiryRepository: { create } }));
    const { enquiryService } = await import('./enquiry.service');

    await enquiryService.create({
      vendorId: 'some-vendor',
      vendorName: 'Some Vendor',
      vendorCategory: 'cat-1',
      name: 'Priya Sharma',
      phone: '9876543210',
      city: 'Patna',
      eventDate: '2027-02-14',
      eventType: 'wedding',
      consultationId: 'consultation-1',
    });

    const persisted = create.mock.calls[0][0] as { consultation?: unknown };
    expect(persisted.consultation).toEqual({ connect: { id: 'consultation-1' } });
  });

  test('leaves consultation unset when no consultationId is provided — preserves existing /vendors/[id] enquiry-form behavior', async () => {
    const findBySlug = mock(async () => fakeVendor());
    const create = mock(async (data: unknown) => ({ id: 'enquiry-1', ...(data as Record<string, unknown>) }));

    mock.module('@/repositories/vendor.repository', () => ({ vendorRepository: { findBySlug } }));
    mock.module('@/repositories/enquiry.repository', () => ({ enquiryRepository: { create } }));
    const { enquiryService } = await import('./enquiry.service');

    await enquiryService.create({
      vendorId: 'some-vendor',
      vendorName: 'Some Vendor',
      vendorCategory: 'cat-1',
      name: 'Priya Sharma',
      phone: '9876543210',
      city: 'Patna',
      eventDate: '2027-02-14',
      eventType: 'wedding',
    });

    const persisted = create.mock.calls[0][0] as { consultation?: unknown };
    expect(persisted.consultation).toBeUndefined();
  });

  test('one Consultation can produce multiple Enquiries — consultationId is not unique', async () => {
    const findBySlug = mock(async () => fakeVendor());
    const create = mock(async (data: unknown) => ({ id: 'enquiry-1', ...(data as Record<string, unknown>) }));

    mock.module('@/repositories/vendor.repository', () => ({ vendorRepository: { findBySlug } }));
    mock.module('@/repositories/enquiry.repository', () => ({ enquiryRepository: { create } }));
    const { enquiryService } = await import('./enquiry.service');

    const base = {
      vendorId: 'some-vendor',
      vendorName: 'Some Vendor',
      vendorCategory: 'cat-1',
      name: 'Priya Sharma',
      phone: '9876543210',
      city: 'Patna',
      eventDate: '2027-02-14',
      eventType: 'wedding',
      consultationId: 'consultation-1',
    };

    await enquiryService.create(base);
    await enquiryService.create({ ...base, vendorId: 'another-vendor' });

    expect(create.mock.calls.length).toBe(2);
    expect((create.mock.calls[0][0] as { consultation?: unknown }).consultation).toEqual({ connect: { id: 'consultation-1' } });
    expect((create.mock.calls[1][0] as { consultation?: unknown }).consultation).toEqual({ connect: { id: 'consultation-1' } });
  });
});
