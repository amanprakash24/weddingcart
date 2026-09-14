/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';

// Mocks `@/lib/prisma` wholesale (no DATABASE_URL/DB connection needed, same
// technique used in weddingWorkspace.service.test.ts) — convertBookingToWedding
// pulls in ~7 repositories, all of which transitively import @/lib/prisma at
// module-load time. This is the first coverage this function has ever had
// (confirmed zero prior test files reference weddingConversion.service.ts) —
// added to close the specific failure mode found while wiring it into
// app/api/bookings/[id]/route.ts: an admin confirming a booking with no
// weddingDate previously left it permanently CONFIRMED with no Wedding and no
// visible error. This file does not modify weddingConversion.service.ts.
function fakeBooking(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'booking-1',
    status: 'CONFIRMED',
    weddingDate: new Date('2027-02-01'),
    city: 'Patna',
    guestCount: 200,
    weddingType: 'Wedding',
    total: 500000,
    items: [
      { id: 'item-1', vendorId: 'vendor-1', vendorName: 'Royal Caterers', vendorCategory: 'catering', packageName: 'Gold Package', price: 500000 },
    ],
    ...overrides,
  };
}

function makePrismaMock({
  booking,
  existingWedding = null,
}: {
  booking: ReturnType<typeof fakeBooking>;
  existingWedding?: Record<string, unknown> | null;
}) {
  const weddingCreateMock = mock(async (args: { data: Record<string, unknown> }) => ({
    id: 'wedding-1',
    weddingNumber: 'WED-2027-0001',
    ...args.data,
    sourceBooking: undefined,
    sourceBookingId: booking.id,
  }));
  const weddingEventCreateMock = mock(async (args: { data: Record<string, unknown> }) => ({ id: 'we-1', ...args.data }));
  const vendorBookingCreateMock = mock(async (args: { data: Record<string, unknown> }) => ({ id: 'vb-1', ...args.data }));
  const taskCreateMock = mock(async (args: { data: Record<string, unknown> }) => ({ id: 'task-1', ...args.data }));
  const activityLogCreateMock = mock(async (args: { data: Record<string, unknown> }) => ({ id: 'log-1', ...args.data }));

  const base = {
    booking: { findUnique: mock(async () => booking) },
    wedding: {
      findUnique: mock(async ({ where }: { where: Record<string, unknown> }) =>
        'sourceBookingId' in where ? existingWedding : null
      ),
      create: weddingCreateMock,
      count: mock(async () => 0),
    },
    weddingEvent: { create: weddingEventCreateMock },
    vendorBooking: { create: vendorBookingCreateMock },
    task: { create: taskCreateMock },
    activityLog: { create: activityLogCreateMock },
  };
  const prismaMock = {
    ...base,
    $transaction: mock(async (fn: (tx: typeof base) => unknown) => fn(base)),
  };
  return { prismaMock, weddingCreateMock, weddingEventCreateMock, vendorBookingCreateMock, taskCreateMock, activityLogCreateMock };
}

// Also re-mocks `@/repositories/booking.repository` explicitly (not just
// `@/lib/prisma`) — services/booking.service.test.ts registers its own
// mock.module() for this same path with an incomplete shape ({ create }
// only, no findById). Bun's mock.module() patches are global for the whole
// test process, not scoped per file, so without this override, running the
// full suite (not just this file in isolation) would resolve
// bookingRepository to that other file's stale mock and fail with
// "bookingRepository.findById is not a function". Registering our own
// mock.module() for the same path here always wins for imports that happen
// after it, regardless of what ran earlier — reads `booking` by reference
// (not a snapshot), so tests that mutate it between calls (e.g. simulating a
// weddingDate backfill) still see the update on a later call.
async function loadServiceWith(prismaMock: unknown, booking: ReturnType<typeof fakeBooking>) {
  mock.module('@/lib/prisma', () => ({ prisma: prismaMock }));
  mock.module('@/repositories/booking.repository', () => ({
    bookingRepository: { findById: mock(async () => booking) },
  }));
  return import('./weddingConversion.service');
}

describe('convertBookingToWedding — the failure mode found in production-integrity review', () => {
  test('a booking with no weddingDate throws InvalidBookingStateError, and never opens the write transaction (no partial Wedding data)', async () => {
    const booking = fakeBooking({ weddingDate: null });
    const { prismaMock, weddingCreateMock } = makePrismaMock({ booking });
    const { convertBookingToWedding, InvalidBookingStateError } = await loadServiceWith(prismaMock, booking);

    await expect(convertBookingToWedding('booking-1')).rejects.toThrow(InvalidBookingStateError);

    expect(weddingCreateMock).not.toHaveBeenCalled();
    expect((prismaMock as { $transaction: ReturnType<typeof mock> }).$transaction).not.toHaveBeenCalled();
  });

  test('a CONFIRMED booking with a weddingDate converts successfully — Wedding, WeddingEvent, and one VendorBooking+Task per item', async () => {
    const booking = fakeBooking();
    const { prismaMock, weddingCreateMock, weddingEventCreateMock, vendorBookingCreateMock, taskCreateMock } = makePrismaMock({
      booking,
    });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    const wedding = await convertBookingToWedding('booking-1');

    expect((wedding as { sourceBookingId: string }).sourceBookingId).toBe('booking-1');
    expect(weddingCreateMock).toHaveBeenCalledTimes(1);
    expect(weddingEventCreateMock).toHaveBeenCalledTimes(1);
    expect(vendorBookingCreateMock).toHaveBeenCalledTimes(1);
    expect(taskCreateMock).toHaveBeenCalledTimes(1);
  });

  test('calling it again on an already-converted booking returns the existing Wedding, without creating a duplicate', async () => {
    const booking = fakeBooking();
    const existingWedding = { id: 'wedding-existing', sourceBookingId: 'booking-1', weddingNumber: 'WED-2027-0001' };
    const { prismaMock, weddingCreateMock } = makePrismaMock({ booking, existingWedding });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    const result = await convertBookingToWedding('booking-1');

    expect(result as unknown as Record<string, unknown>).toEqual(existingWedding);
    expect(weddingCreateMock).not.toHaveBeenCalled();
  });

  test('retrying after the weddingDate gap is fixed succeeds, using the exact same call the first (failed) attempt used', async () => {
    const booking = fakeBooking({ weddingDate: null });
    const { prismaMock, weddingCreateMock } = makePrismaMock({ booking });
    const { convertBookingToWedding, InvalidBookingStateError } = await loadServiceWith(prismaMock, booking);

    await expect(convertBookingToWedding('booking-1')).rejects.toThrow(InvalidBookingStateError);
    expect(weddingCreateMock).not.toHaveBeenCalled();

    // A coordinator backfills the missing date on the same booking row.
    (booking as { weddingDate: Date | null }).weddingDate = new Date('2027-03-01');

    const wedding = await convertBookingToWedding('booking-1');

    expect((wedding as { sourceBookingId: string }).sourceBookingId).toBe('booking-1');
    expect(weddingCreateMock).toHaveBeenCalledTimes(1);
  });
});
