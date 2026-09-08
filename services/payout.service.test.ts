/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';

// Mocks `@/lib/prisma` wholesale (no DATABASE_URL/DB connection needed, same
// technique used throughout this repo) and lets the real repositories run
// against it — a single mock boundary, same pattern as
// weddingWorkspace.service.test.ts. Regression coverage for the
// VendorBooking transition-enforcement change: payout.service.ts is a
// separate service that never calls the new canTransitionVendorBooking
// check — it only reads the *current* value of VendorBooking.status — so
// this confirms a legitimately COMPLETED booking (the only way to reach
// COMPLETED is now CONFIRMED -> COMPLETED, per the new matrix) remains
// payout-eligible and nothing about that path was disturbed by the fix.
function makePrismaMock(vendorBookingStatus: string, existingPayouts: unknown[] = []) {
  const payoutCreateMock = mock(async (args: { data: Record<string, unknown> }) => ({
    id: 'payout-1',
    status: 'PENDING',
    ...args.data,
  }));

  const base = {
    vendorBooking: {
      findUnique: mock(async () => ({
        id: 'vb-1',
        weddingEventId: 'we-1',
        vendorId: 'vendor-1',
        status: vendorBookingStatus,
        agreedPrice: 10000,
      })),
    },
    weddingEvent: {
      findUnique: mock(async () => ({ id: 'we-1', weddingId: 'wedding-1' })),
    },
    wedding: {
      findUnique: mock(async () => ({ id: 'wedding-1', status: 'ACTIVE' })),
    },
    payout: {
      findMany: mock(async () => existingPayouts),
      count: mock(async () => existingPayouts.length),
      create: payoutCreateMock,
    },
    vendor: {
      findUnique: mock(async () => ({ categoryId: 'category-1' })),
    },
    commissionRate: {
      findFirst: mock(async () => ({ id: 'rate-1', categoryId: 'category-1', rate: 10 })),
    },
    activityLog: {
      create: mock(async () => ({ id: 'log-1' })),
    },
  };
  const prismaMock = {
    ...base,
    $transaction: mock(async (fn: (tx: typeof base) => unknown) => fn(base)),
  };
  return { prismaMock, payoutCreateMock };
}

async function loadPayoutServiceWith(prismaMock: unknown) {
  mock.module('@/lib/prisma', () => ({ prisma: prismaMock }));
  const { payoutService } = await import('./payout.service');
  return payoutService;
}

describe('payoutService.calculatePayoutForBooking — regression after VendorBooking transition enforcement', () => {
  test('a legitimately COMPLETED booking (reached via CONFIRMED -> COMPLETED, the only allowed path) is still payout-eligible', async () => {
    const { prismaMock, payoutCreateMock } = makePrismaMock('COMPLETED');
    const payoutService = await loadPayoutServiceWith(prismaMock);

    const payout = await payoutService.calculatePayoutForBooking('wedding-1', 'vb-1', null);

    expect(payout).toBeTruthy();
    expect(payoutCreateMock).toHaveBeenCalledTimes(1);
    expect(payout.grossAmount).toBe(10000);
    expect(payout.commissionAmount).toBe(1000); // 10% of 10000
    expect(payout.netAmount).toBe(9000);
  });

  test('a non-COMPLETED booking is still correctly rejected for payout calculation (unchanged behavior)', async () => {
    const { prismaMock, payoutCreateMock } = makePrismaMock('CONFIRMED');
    const payoutService = await loadPayoutServiceWith(prismaMock);

    await expect(payoutService.calculatePayoutForBooking('wedding-1', 'vb-1', null)).rejects.toThrow();
    expect(payoutCreateMock).not.toHaveBeenCalled();
  });
});
