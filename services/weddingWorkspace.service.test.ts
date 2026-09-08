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
