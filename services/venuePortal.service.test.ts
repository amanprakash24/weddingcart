/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { InvalidTransitionError, NotFoundError, ValidationError } from '@/lib/errors';

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

function makeAvailabilityPrismaMock(existingRows: { date: Date; status: string; note: string | null }[] = []) {
  const upsertMock = mock(async (args: { where: { vendorId_date: { vendorId: string; date: Date } } }) => args);
  const deleteManyMock = mock(async () => ({ count: 1 }));
  const findManyMock = mock(async () => existingRows);
  const transactionMock = mock(async (ops: Promise<unknown>[]) => Promise.all(ops));
  const prismaMock = {
    vendorProfile: {
      findUnique: mock(async () => ({
        vendorId: 'vendor-1',
        vendor: { id: 'vendor-1', name: 'Test Vendor', city: 'Patna', address: '', category: { name: 'Venue' } },
      })),
    },
    vendorAvailability: { upsert: upsertMock, deleteMany: deleteManyMock, findMany: findManyMock },
    $transaction: transactionMock,
  };
  return { prismaMock, upsertMock, deleteManyMock, findManyMock, transactionMock };
}

describe('venuePortalService.setAvailability — self-service availability writes', () => {
  const future = (daysFromNow: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + daysFromNow);
    return d.toISOString().slice(0, 10);
  };

  test('setting a future date to BLOCKED upserts it, scoped to the caller\'s own vendor', async () => {
    const { prismaMock, upsertMock } = makeAvailabilityPrismaMock();
    const service = await loadServiceWith(prismaMock);

    await service.setAvailability('user-1', [{ date: future(10), status: 'BLOCKED', note: 'Family event' }]);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0].where.vendorId_date.vendorId).toBe('vendor-1');
  });

  test('status: null deletes the override instead of upserting', async () => {
    const { prismaMock, upsertMock, deleteManyMock } = makeAvailabilityPrismaMock();
    const service = await loadServiceWith(prismaMock);

    await service.setAvailability('user-1', [{ date: future(5), status: null }]);

    expect(deleteManyMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  test('a past date is rejected before any write', async () => {
    const { prismaMock, upsertMock } = makeAvailabilityPrismaMock();
    const service = await loadServiceWith(prismaMock);

    await expect(service.setAvailability('user-1', [{ date: future(-1), status: 'BLOCKED' }])).rejects.toThrow(ValidationError);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  test('an empty list is rejected', async () => {
    const { prismaMock, upsertMock } = makeAvailabilityPrismaMock();
    const service = await loadServiceWith(prismaMock);

    await expect(service.setAvailability('user-1', [])).rejects.toThrow(ValidationError);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  test('more than 90 dates in one request is rejected', async () => {
    const { prismaMock, upsertMock } = makeAvailabilityPrismaMock();
    const service = await loadServiceWith(prismaMock);
    const entries = Array.from({ length: 91 }, (_, i) => ({ date: future(i), status: 'BLOCKED' as const }));

    await expect(service.setAvailability('user-1', entries)).rejects.toThrow(ValidationError);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  test('an unparseable date is rejected', async () => {
    const { prismaMock, upsertMock } = makeAvailabilityPrismaMock();
    const service = await loadServiceWith(prismaMock);

    await expect(service.setAvailability('user-1', [{ date: 'not-a-date', status: 'BLOCKED' }])).rejects.toThrow(ValidationError);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  test('multiple dates in one request all get written inside the same transaction', async () => {
    const { prismaMock, upsertMock, transactionMock } = makeAvailabilityPrismaMock();
    const service = await loadServiceWith(prismaMock);

    await service.setAvailability('user-1', [
      { date: future(1), status: 'BLOCKED' },
      { date: future(2), status: 'TENTATIVE' },
      { date: future(3), status: 'AVAILABLE' },
    ]);

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledTimes(3);
  });

  test('a request from a user with no vendor profile is rejected as not found', async () => {
    const { prismaMock, upsertMock } = makeAvailabilityPrismaMock();
    prismaMock.vendorProfile.findUnique = mock(async () => null) as never;
    const service = await loadServiceWith(prismaMock);

    await expect(service.setAvailability('user-without-profile', [{ date: future(1), status: 'BLOCKED' }])).rejects.toThrow(NotFoundError);
    expect(upsertMock).not.toHaveBeenCalled();
  });
});

describe('venuePortalService.respond — the vendor answers a booking request (12 Oct 2026)', () => {
  // The real staff change (weddingWorkspaceService.updateVendorBookingStatus) runs underneath, against this fake database.
  function makeRespondMock({ status = 'PENDING_VENDOR_CONFIRMATION', bookingVendorId = 'vendor-1' }: { status?: string; bookingVendorId?: string } = {}) {
    const row = { id: 'vb-1', vendorId: bookingVendorId, weddingEventId: 'we-1', status, respondedAt: null, onTimeService: null, declineReason: null };
    const update = mock(async (args: { data: Record<string, unknown> }) => ({ ...row, ...args.data }));
    const logCreate = mock(async () => ({ id: 'log-1' }));
    const base = {
      vendorProfile: { findUnique: mock(async () => ({ vendorId: 'vendor-1', vendor: { id: 'vendor-1', name: 'Test Vendor', city: 'Patna', address: '', category: { name: 'Caterer' } } })) },
      vendorBooking: {
        findFirst: mock(async ({ where }: { where: { vendorId: string } }) => (where.vendorId === bookingVendorId ? { id: 'vb-1', status, weddingEvent: { weddingId: 'wedding-1' } } : null)),
        findUnique: mock(async () => row),
        updateMany: mock(async () => ({ count: 1 })),
        update,
      },
      weddingEvent: { findUnique: mock(async () => ({ id: 'we-1', weddingId: 'wedding-1' })) },
      activityLog: { create: logCreate },
      task: { updateMany: mock(async () => ({ count: 1 })) },
      wedding: { findUnique: mock(async () => ({ id: 'wedding-1', status: 'ACTIVE' })), update: mock(async () => ({})) },
    };
    return { prismaMock: { ...base, $transaction: mock(async (fn: (tx: typeof base) => unknown) => fn(base)) }, update, logCreate };
  }

  test('confirm: the booking is confirmed, and the timeline says the vendor did it, by name', async () => {
    const { prismaMock, update, logCreate } = makeRespondMock();
    const result = await (await loadServiceWith(prismaMock)).respond('user-1', 'vb-1', { answer: 'CONFIRM' });
    expect(result.status).toBe('CONFIRMED');
    expect(update.mock.calls[0][0].data).toMatchObject({ status: 'CONFIRMED', declineReason: null });
    expect((logCreate.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data).toMatchObject({ summary: 'The vendor confirmed the booking in Vendor OS', performedBy: { connect: { id: 'user-1' } } });
  });

  test('decline: needs a reason, which is kept on the booking for the team', async () => {
    const none = makeRespondMock();
    expect(await (await loadServiceWith(none.prismaMock)).respond('user-1', 'vb-1', { answer: 'DECLINE', reason: ' ' }).catch((e) => e)).toBeInstanceOf(ValidationError);
    expect(none.update).not.toHaveBeenCalled();
    const { prismaMock, update } = makeRespondMock();
    const result = await (await loadServiceWith(prismaMock)).respond('user-1', 'vb-1', { answer: 'DECLINE', reason: 'Already booked that night' });
    expect(result).toMatchObject({ status: 'DECLINED', declineReason: 'Already booked that night' });
    expect(update.mock.calls[0][0].data).toMatchObject({ status: 'DECLINED', declineReason: 'Already booked that night' });
  });

  test('another vendor’s booking is not found; one already answered cannot be answered again', async () => {
    const other = makeRespondMock({ bookingVendorId: 'vendor-2' });
    expect(await (await loadServiceWith(other.prismaMock)).respond('user-1', 'vb-1', { answer: 'CONFIRM' }).catch((e) => e)).toBeInstanceOf(NotFoundError);
    const done = makeRespondMock({ status: 'CONFIRMED' });
    expect(await (await loadServiceWith(done.prismaMock)).respond('user-1', 'vb-1', { answer: 'DECLINE', reason: 'Changed my mind' }).catch((e) => e)).toBeInstanceOf(InvalidTransitionError);
    expect(done.update).not.toHaveBeenCalled();
  });
});
