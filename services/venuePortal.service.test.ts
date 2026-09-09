/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { InvalidTransitionError, NotFoundError } from '@/lib/errors';

// Mocks `@/lib/prisma` wholesale (no DATABASE_URL/DB connection needed, same
// technique used throughout this repo) — venuePortal.service.ts calls
// prisma directly (no repository layer), so this is the only mock point
// needed.
function fakeBooking(venueStatus: string, vendorId = 'vendor-1') {
  return { id: 'vb-1', vendorId, venueStatus };
}

function makePrismaMock({ venueStatus, bookingVendorId = 'vendor-1' }: { venueStatus: string; bookingVendorId?: string }) {
  const updateMock = mock(async (args: { data: Record<string, unknown> }) => ({
    ...fakeBooking(venueStatus, bookingVendorId),
    ...args.data,
  }));
  // Mirrors real findFirst semantics: the ownership filter (vendorId) is
  // part of the where clause, so a booking belonging to a different vendor
  // simply isn't found.
  const findFirstMock = mock(async ({ where }: { where: { id: string; vendorId: string } }) =>
    where.vendorId === bookingVendorId ? fakeBooking(venueStatus, bookingVendorId) : null
  );
  const prismaMock = {
    vendorProfile: {
      findUnique: mock(async () => ({
        vendorId: 'vendor-1',
        vendor: { id: 'vendor-1', name: 'Test Vendor', city: 'Patna', address: '', category: { name: 'Venue' } },
      })),
    },
    vendorBooking: { findFirst: findFirstMock, update: updateMock },
  };
  return { prismaMock, updateMock, findFirstMock };
}

async function loadServiceWith(prismaMock: unknown) {
  mock.module('@/lib/prisma', () => ({ prisma: prismaMock }));
  const { venuePortalService } = await import('./venuePortal.service');
  return venuePortalService;
}

describe('venuePortalService.updateStatus — venue transition enforcement', () => {
  test('a legal transition (PENDING -> READY_FOR_SETUP) succeeds', async () => {
    const { prismaMock, updateMock } = makePrismaMock({ venueStatus: 'PENDING' });
    const service = await loadServiceWith(prismaMock);

    const result = await service.updateStatus('user-1', 'vb-1', 'READY_FOR_SETUP');

    expect(result.venueStatus).toBe('READY_FOR_SETUP');
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  test('skipping ahead (PENDING -> READY) is rejected before any write', async () => {
    const { prismaMock, updateMock } = makePrismaMock({ venueStatus: 'PENDING' });
    const service = await loadServiceWith(prismaMock);

    await expect(service.updateStatus('user-1', 'vb-1', 'READY')).rejects.toThrow(InvalidTransitionError);
    expect(updateMock).not.toHaveBeenCalled();
  });

  test('a backward move (READY -> SETUP_IN_PROGRESS) is rejected', async () => {
    const { prismaMock, updateMock } = makePrismaMock({ venueStatus: 'READY' });
    const service = await loadServiceWith(prismaMock);

    await expect(service.updateStatus('user-1', 'vb-1', 'SETUP_IN_PROGRESS')).rejects.toThrow(InvalidTransitionError);
    expect(updateMock).not.toHaveBeenCalled();
  });

  test('COMPLETED is terminal — no further transitions allowed', async () => {
    const { prismaMock, updateMock } = makePrismaMock({ venueStatus: 'COMPLETED' });
    const service = await loadServiceWith(prismaMock);

    await expect(service.updateStatus('user-1', 'vb-1', 'READY')).rejects.toThrow(InvalidTransitionError);
    expect(updateMock).not.toHaveBeenCalled();
  });

  test('the existing ownership check still runs first — a booking belonging to a different vendor is rejected as not found, not as an illegal transition', async () => {
    const { prismaMock, updateMock } = makePrismaMock({ venueStatus: 'PENDING', bookingVendorId: 'some-other-vendor' });
    const service = await loadServiceWith(prismaMock);

    await expect(service.updateStatus('user-1', 'vb-1', 'READY_FOR_SETUP')).rejects.toThrow(NotFoundError);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
