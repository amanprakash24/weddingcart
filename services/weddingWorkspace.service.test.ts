/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { InvalidTransitionError, NotFoundError } from '@/lib/errors';

// Mocks `@/lib/prisma` wholesale (no DATABASE_URL/DB connection needed, same
// technique used throughout this repo) — the full weddingWorkspace.service.ts
// module imports ~11 repositories, all of which transitively import
// @/lib/prisma at module-load time, so this is the one mock point that
// satisfies every one of them without needing to mock each repository
// module individually.
function fakeVendorBooking(status: string) {
  return {
    id: 'vb-1',
    weddingEventId: 'we-1',
    vendorId: 'vendor-1',
    status,
    declineReason: null,
    respondedAt: null,
    onTimeService: null,
  };
}

function makePrismaMock({
  vendorBookingStatus,
  weddingId = 'wedding-1',
}: {
  vendorBookingStatus: string;
  weddingId?: string;
}) {
  const updateMock = mock(async (args: { data: Record<string, unknown> }) => ({
    ...fakeVendorBooking(vendorBookingStatus),
    ...args.data,
  }));
  const activityLogCreateMock = mock(async () => ({ id: 'log-1' }));

  const base = {
    vendorBooking: {
      findUnique: mock(async () => fakeVendorBooking(vendorBookingStatus)),
      update: updateMock,
    },
    weddingEvent: {
      findUnique: mock(async () => ({ id: 'we-1', weddingId })),
    },
    activityLog: {
      create: activityLogCreateMock,
    },
    wedding: {
      findUnique: mock(async () => ({ id: weddingId, status: 'ACTIVE' })), // not PLANNING, so maybeActivateWedding no-ops
      update: mock(async () => ({ id: weddingId, status: 'ACTIVE' })),
    },
  };
  const prismaMock = {
    ...base,
    $transaction: mock(async (fn: (tx: typeof base) => unknown) => fn(base)),
  };
  return { prismaMock, updateMock, activityLogCreateMock };
}

async function loadServiceWith(prismaMock: unknown) {
  mock.module('@/lib/prisma', () => ({ prisma: prismaMock }));
  const { weddingWorkspaceService } = await import('./weddingWorkspace.service');
  return weddingWorkspaceService;
}

describe('weddingWorkspaceService.updateVendorBookingStatus — transition enforcement', () => {
  test('a legal transition (PENDING_VENDOR_CONFIRMATION -> CONFIRMED) succeeds', async () => {
    const { prismaMock, updateMock } = makePrismaMock({ vendorBookingStatus: 'PENDING_VENDOR_CONFIRMATION' });
    const service = await loadServiceWith(prismaMock);

    const result = await service.updateVendorBookingStatus('wedding-1', 'vb-1', 'CONFIRMED');

    expect(result.status).toBe('CONFIRMED');
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  test('an illegal transition (DECLINED -> COMPLETED) throws InvalidTransitionError before any database update', async () => {
    const { prismaMock, updateMock, activityLogCreateMock } = makePrismaMock({ vendorBookingStatus: 'DECLINED' });
    const service = await loadServiceWith(prismaMock);

    await expect(service.updateVendorBookingStatus('wedding-1', 'vb-1', 'COMPLETED')).rejects.toThrow(
      InvalidTransitionError
    );

    // The whole point of enforcing this before the transaction: neither the
    // vendor booking update nor the activity log write should ever fire for
    // a rejected transition.
    expect(updateMock).not.toHaveBeenCalled();
    expect(activityLogCreateMock).not.toHaveBeenCalled();
  });

  test('an illegal transition (CANCELLED -> COMPLETED) is also rejected', async () => {
    const { prismaMock, updateMock } = makePrismaMock({ vendorBookingStatus: 'CANCELLED' });
    const service = await loadServiceWith(prismaMock);

    await expect(service.updateVendorBookingStatus('wedding-1', 'vb-1', 'COMPLETED')).rejects.toThrow(
      InvalidTransitionError
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  test('the existing ownership check still runs first — a booking belonging to a different wedding is rejected as not found, not as an illegal transition', async () => {
    const { prismaMock, updateMock } = makePrismaMock({
      vendorBookingStatus: 'PENDING_VENDOR_CONFIRMATION',
      weddingId: 'some-other-wedding',
    });
    const service = await loadServiceWith(prismaMock);

    await expect(service.updateVendorBookingStatus('wedding-1', 'vb-1', 'CONFIRMED')).rejects.toThrow(NotFoundError);
    expect(updateMock).not.toHaveBeenCalled();
  });
});

// ---- transitionStatus: completing a wedding ----
// V1 model: a wedding is completable without any vendor ever confirming. PLANNING -> COMPLETED is allowed by the matrix, and the
// service adds exactly one rule to that new path — the wedding's last day must have arrived. Nothing else (vendors, tasks, money)
// is consulted, and ACTIVE -> COMPLETED behaves as it always did.
const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);

function makeWeddingPrismaMock({ status, primaryDate, functionDates = [] }: { status: string; primaryDate: Date; functionDates?: Date[] }) {
  const wedding = { id: 'wedding-1', status, primaryDate };
  const weddingUpdate = mock(async (args: { data: Record<string, unknown> }) => ({ ...wedding, ...args.data }));
  const activityLogCreate = mock(async () => ({ id: 'log-1' }));
  const vendorBookingAny = mock(async () => {
    throw new Error('vendor bookings must not be consulted when transitioning a wedding');
  });
  const base = {
    wedding: { findUnique: mock(async () => wedding), update: weddingUpdate },
    weddingEvent: {
      findMany: mock(async () => functionDates.map((date, i) => ({ id: `we-${i}`, weddingId: 'wedding-1', date }))),
      count: mock(async () => functionDates.length),
    },
    activityLog: { create: activityLogCreate },
    vendorBooking: { findMany: vendorBookingAny, findUnique: vendorBookingAny, count: vendorBookingAny },
  };
  const prismaMock = { ...base, $transaction: mock(async (fn: (tx: typeof base) => unknown) => fn(base)) };
  return { prismaMock, weddingUpdate, activityLogCreate };
}

async function outcome(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(() => null, (e: unknown) => e);
}

describe('weddingWorkspaceService.transitionStatus — completing a wedding', () => {
  test('a vendorless PLANNING wedding whose day has passed CAN be completed, and completedAt is set', async () => {
    const past = daysFromNow(-3);
    const { prismaMock, weddingUpdate, activityLogCreate } = makeWeddingPrismaMock({ status: 'PLANNING', primaryDate: past, functionDates: [past] });
    const service = await loadServiceWith(prismaMock);

    const result = await service.transitionStatus('wedding-1', 'COMPLETED');

    expect(result.status).toBe('COMPLETED');
    expect(weddingUpdate).toHaveBeenCalledTimes(1);
    const data = weddingUpdate.mock.calls[0][0].data;
    expect(data.status).toBe('COMPLETED');
    expect(data.completedAt).toBeInstanceOf(Date);
    expect(activityLogCreate).toHaveBeenCalledTimes(1);
  });

  test('a PLANNING wedding with no function rows at all completes on its own date (primaryDate alone)', async () => {
    const { prismaMock, weddingUpdate } = makeWeddingPrismaMock({ status: 'PLANNING', primaryDate: daysFromNow(-1), functionDates: [] });
    const service = await loadServiceWith(prismaMock);
    await service.transitionStatus('wedding-1', 'COMPLETED');
    expect(weddingUpdate).toHaveBeenCalledTimes(1);
  });

  test('PLANNING -> COMPLETED before the wedding is refused with a plain message, and nothing is written', async () => {
    const future = daysFromNow(30);
    const { prismaMock, weddingUpdate, activityLogCreate } = makeWeddingPrismaMock({ status: 'PLANNING', primaryDate: future, functionDates: [future] });
    const service = await loadServiceWith(prismaMock);

    const error = (await outcome(service.transitionStatus('wedding-1', 'COMPLETED'))) as Error;

    expect(error).toBeInstanceOf(InvalidTransitionError);
    expect(error.message).toContain('last day');
    expect(weddingUpdate).not.toHaveBeenCalled();
    expect(activityLogCreate).not.toHaveBeenCalled();
  });

  test('a multi-day PLANNING wedding cannot be completed while a later function is still ahead', async () => {
    const { prismaMock, weddingUpdate } = makeWeddingPrismaMock({
      status: 'PLANNING', primaryDate: daysFromNow(-1), functionDates: [daysFromNow(-2), daysFromNow(-1), daysFromNow(3)],
    });
    const service = await loadServiceWith(prismaMock);
    expect(await outcome(service.transitionStatus('wedding-1', 'COMPLETED'))).toBeInstanceOf(InvalidTransitionError);
    expect(weddingUpdate).not.toHaveBeenCalled();
  });

  test('ACTIVE -> COMPLETED is unchanged — it still works with no date check', async () => {
    const future = daysFromNow(30);
    const { prismaMock, weddingUpdate } = makeWeddingPrismaMock({ status: 'ACTIVE', primaryDate: future, functionDates: [future] });
    const service = await loadServiceWith(prismaMock);
    const result = await service.transitionStatus('wedding-1', 'COMPLETED');
    expect(result.status).toBe('COMPLETED');
    expect(weddingUpdate).toHaveBeenCalledTimes(1);
  });

  test('ACTIVE -> POSTPONED and PLANNING -> POSTPONED / CANCELLED are unaffected by the completion rule', async () => {
    const future = daysFromNow(30);
    for (const [from, to] of [['ACTIVE', 'POSTPONED'], ['PLANNING', 'POSTPONED'], ['PLANNING', 'CANCELLED']] as const) {
      const { prismaMock, weddingUpdate } = makeWeddingPrismaMock({ status: from, primaryDate: future, functionDates: [future] });
      const service = await loadServiceWith(prismaMock);
      const result = await service.transitionStatus('wedding-1', to);
      expect(result.status).toBe(to);
      expect(weddingUpdate.mock.calls[0][0].data.completedAt).toBeUndefined();
    }
  });

  test('still-illegal moves stay illegal: PLANNING -> ACTIVE, POSTPONED -> COMPLETED, COMPLETED -> anything, CANCELLED -> COMPLETED', async () => {
    const past = daysFromNow(-3);
    for (const [from, to] of [['PLANNING', 'ACTIVE'], ['POSTPONED', 'COMPLETED'], ['COMPLETED', 'PLANNING'], ['CANCELLED', 'COMPLETED']] as const) {
      const { prismaMock, weddingUpdate } = makeWeddingPrismaMock({ status: from, primaryDate: past, functionDates: [past] });
      const service = await loadServiceWith(prismaMock);
      expect(await outcome(service.transitionStatus('wedding-1', to))).toBeInstanceOf(InvalidTransitionError);
      expect(weddingUpdate).not.toHaveBeenCalled();
    }
  });
});
