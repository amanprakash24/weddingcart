/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';

// Mocks `@/lib/prisma` wholesale (no DATABASE_URL/DB connection needed, same
// technique used in weddingWorkspace.service.test.ts) — convertBookingToWedding
// pulls in ~7 repositories, all of which transitively import @/lib/prisma at
// module-load time. Covers two things: convertBookingToWedding's own
// original failure mode (missing weddingDate), and the duplicate-Wedding
// cross-path guard added afterward — a Booking created from an
// Enquiry/Consultation (enquiryId/consultationId set) that already
// converted via the separate CRM pipeline must not spawn a second Wedding.
// This file does not modify weddingConversion.service.ts.
function fakeBooking(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'booking-1',
    status: 'CONFIRMED',
    weddingDate: new Date('2027-02-01'),
    city: 'Patna',
    guestCount: 200,
    weddingType: 'Wedding',
    total: 500000,
    enquiryId: null,
    consultationId: null,
    items: [
      { id: 'item-1', vendorId: 'vendor-1', vendorName: 'Royal Caterers', vendorCategory: 'catering', packageName: 'Gold Package', price: 500000, quantity: 1 },
    ],
    ...overrides,
  };
}

// `weddings` maps each of the four lookup shapes findWeddingForSource() and
// convertBookingToWedding()'s guard can perform to what should come back —
// omitted/undefined entries behave as "nothing found" (null), matching real
// Prisma findUnique/findFirst semantics for no match.
// Shared by every makePrismaMock() call in this file — records cross-mock
// call order (lock acquisitions interleaved with reads) so tests can assert
// "the lock was taken before the existence check ran", not just that both
// happened.
function makePrismaMock({
  booking,
  weddings = {},
  callLog = [],
}: {
  booking: ReturnType<typeof fakeBooking>;
  weddings?: {
    sourceBookingId?: Record<string, unknown> | null;
    sourceEnquiryId?: Record<string, unknown> | null;
    sourceConsultationId?: Record<string, unknown> | null;
    linkedBookingEnquiryId?: Record<string, unknown> | null;
    linkedBookingConsultationId?: Record<string, unknown> | null;
  };
  callLog?: string[];
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

  const findUniqueMock = mock(async ({ where }: { where: Record<string, unknown> }) => {
    callLog.push('read:findUnique');
    if ('sourceBookingId' in where) return weddings.sourceBookingId ?? null;
    if ('sourceEnquiryId' in where) return weddings.sourceEnquiryId ?? null;
    if ('sourceConsultationId' in where) return weddings.sourceConsultationId ?? null;
    return null;
  });
  // Mirrors weddingRepository.findByLinkedBookingEnquiryId/ConsultationId's
  // `tx.wedding.findFirst({ where: { sourceBooking: { enquiryId | consultationId } } })`.
  const findFirstMock = mock(
    async ({ where }: { where: { sourceBooking?: { enquiryId?: string; consultationId?: string } } }) => {
      callLog.push('read:findFirst');
      if (where.sourceBooking?.enquiryId) return weddings.linkedBookingEnquiryId ?? null;
      if (where.sourceBooking?.consultationId) return weddings.linkedBookingConsultationId ?? null;
      return null;
    }
  );
  // Stands in for the real pg_advisory_xact_lock call (see
  // weddingConversion.service.ts's acquireConversionLock) — a real Postgres
  // lock's blocking behavior can't be exercised against a mock, but its
  // *call shape* (which key, and that it runs before any existence check)
  // is exactly what makes the guard concurrency-safe, so that's what these
  // tests assert instead.
  const executeRawMock = mock(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
    callLog.push(`lock:${values[0]}`);
    return 1;
  });

  const base = {
    booking: { findUnique: mock(async () => booking) },
    wedding: {
      findUnique: findUniqueMock,
      findFirst: findFirstMock,
      create: weddingCreateMock,
      count: mock(async () => 0),
    },
    weddingEvent: { create: weddingEventCreateMock },
    vendorBooking: { create: vendorBookingCreateMock },
    task: { create: taskCreateMock },
    activityLog: { create: activityLogCreateMock },
    $executeRaw: executeRawMock,
  };
  const prismaMock = {
    ...base,
    $transaction: mock(async (fn: (tx: typeof base) => unknown) => fn(base)),
  };
  return {
    prismaMock,
    weddingCreateMock,
    weddingEventCreateMock,
    vendorBookingCreateMock,
    taskCreateMock,
    activityLogCreateMock,
    executeRawMock,
    callLog,
  };
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
    const { prismaMock, weddingCreateMock } = makePrismaMock({ booking, weddings: { sourceBookingId: existingWedding } });
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

describe('convertBookingToWedding — duplicate-Wedding cross-path guard (production-integrity fix)', () => {
  test('a standalone booking (no enquiryId/consultationId) converts exactly as before — the guard is a no-op for the ordinary /cart checkout path', async () => {
    const booking = fakeBooking({ enquiryId: null, consultationId: null });
    const { prismaMock, weddingCreateMock } = makePrismaMock({ booking });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    const wedding = await convertBookingToWedding('booking-1');

    expect((wedding as { sourceBookingId: string }).sourceBookingId).toBe('booking-1');
    expect(weddingCreateMock).toHaveBeenCalledTimes(1);
  });

  test('a booking linked to an Enquiry with no existing Wedding anywhere converts successfully', async () => {
    const booking = fakeBooking({ enquiryId: 'enquiry-1' });
    const { prismaMock, weddingCreateMock } = makePrismaMock({ booking, weddings: {} });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    const wedding = await convertBookingToWedding('booking-1');

    expect((wedding as { sourceBookingId: string }).sourceBookingId).toBe('booking-1');
    expect(weddingCreateMock).toHaveBeenCalledTimes(1);
  });

  test('a booking linked to an Enquiry that already converted via the CRM pipeline throws ConversionLockedError, not creating a second Wedding', async () => {
    const booking = fakeBooking({ enquiryId: 'enquiry-1' });
    const crmWedding = { id: 'wedding-crm', sourceEnquiryId: 'enquiry-1', weddingNumber: 'WED-2027-0002' };
    const { prismaMock, weddingCreateMock } = makePrismaMock({
      booking,
      weddings: { sourceEnquiryId: crmWedding },
    });
    const { convertBookingToWedding, InvalidBookingStateError } = await loadServiceWith(prismaMock, booking);
    const { ConversionLockedError } = await import('@/lib/errors');

    const promise = convertBookingToWedding('booking-1');
    await expect(promise).rejects.toThrow(ConversionLockedError);
    await expect(promise).rejects.not.toBeInstanceOf(InvalidBookingStateError);
    expect(weddingCreateMock).not.toHaveBeenCalled();
  });

  test('a booking linked to a Consultation that already converted via the CRM pipeline throws ConversionLockedError, not creating a second Wedding', async () => {
    const booking = fakeBooking({ consultationId: 'consultation-1' });
    const crmWedding = { id: 'wedding-crm', sourceConsultationId: 'consultation-1', weddingNumber: 'WED-2027-0003' };
    const { prismaMock, weddingCreateMock } = makePrismaMock({
      booking,
      weddings: { sourceConsultationId: crmWedding },
    });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);
    const { ConversionLockedError } = await import('@/lib/errors');

    await expect(convertBookingToWedding('booking-1')).rejects.toThrow(ConversionLockedError);
    expect(weddingCreateMock).not.toHaveBeenCalled();
  });

  test('a booking linked to an Enquiry where a *different* Booking under the same Enquiry already converted also throws, not just a direct CRM Wedding', async () => {
    const booking = fakeBooking({ id: 'booking-2', enquiryId: 'enquiry-1' });
    const otherBookingsWedding = { id: 'wedding-other', sourceBookingId: 'booking-1', weddingNumber: 'WED-2027-0004' };
    const { prismaMock, weddingCreateMock } = makePrismaMock({
      booking,
      weddings: { linkedBookingEnquiryId: otherBookingsWedding },
    });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);
    const { ConversionLockedError } = await import('@/lib/errors');

    await expect(convertBookingToWedding('booking-2')).rejects.toThrow(ConversionLockedError);
    expect(weddingCreateMock).not.toHaveBeenCalled();
  });

  test("the same-booking idempotency check still takes priority — retrying a booking that already has its own Wedding never hits the cross-path guard", async () => {
    const booking = fakeBooking({ enquiryId: 'enquiry-1' });
    const ownWedding = { id: 'wedding-own', sourceBookingId: 'booking-1', weddingNumber: 'WED-2027-0005' };
    // Even though a CRM Wedding also technically exists for this enquiry,
    // this booking's own prior conversion must win — no error, no duplicate.
    const crmWedding = { id: 'wedding-crm', sourceEnquiryId: 'enquiry-1', weddingNumber: 'WED-2027-0006' };
    const { prismaMock, weddingCreateMock } = makePrismaMock({
      booking,
      weddings: { sourceBookingId: ownWedding, sourceEnquiryId: crmWedding },
    });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    const result = await convertBookingToWedding('booking-1');

    expect(result as unknown as Record<string, unknown>).toEqual(ownWedding);
    expect(weddingCreateMock).not.toHaveBeenCalled();
  });
});

describe('findWeddingForSource — cross-path duplicate detection (production-integrity fix)', () => {
  test('still returns a direct CRM-path Wedding when one exists — existing single-path behavior unchanged', async () => {
    const booking = fakeBooking();
    const crmWedding = { id: 'wedding-crm', sourceEnquiryId: 'enquiry-1', weddingNumber: 'WED-2027-0007' };
    const { prismaMock } = makePrismaMock({ booking, weddings: { sourceEnquiryId: crmWedding } });
    const { findWeddingForSource } = await loadServiceWith(prismaMock, booking);

    const result = await findWeddingForSource('ENQUIRY', 'enquiry-1');

    expect(result as unknown as Record<string, unknown>).toEqual(crmWedding);
  });

  test('now also finds a Wedding created through a linked Booking, when there is no direct CRM-path FK — the core CRM-side fix', async () => {
    const booking = fakeBooking();
    const bookingWedding = { id: 'wedding-booking', sourceBookingId: 'booking-9', weddingNumber: 'WED-2027-0008' };
    const { prismaMock } = makePrismaMock({ booking, weddings: { linkedBookingEnquiryId: bookingWedding } });
    const { findWeddingForSource } = await loadServiceWith(prismaMock, booking);

    const result = await findWeddingForSource('ENQUIRY', 'enquiry-1');

    expect(result as unknown as Record<string, unknown>).toEqual(bookingWedding);
  });

  test('same cross-path detection for CONSULTATION', async () => {
    const booking = fakeBooking();
    const bookingWedding = { id: 'wedding-booking', sourceBookingId: 'booking-9', weddingNumber: 'WED-2027-0009' };
    const { prismaMock } = makePrismaMock({ booking, weddings: { linkedBookingConsultationId: bookingWedding } });
    const { findWeddingForSource } = await loadServiceWith(prismaMock, booking);

    const result = await findWeddingForSource('CONSULTATION', 'consultation-1');

    expect(result as unknown as Record<string, unknown>).toEqual(bookingWedding);
  });

  test('returns null when no Wedding exists via either path — unaffected regression', async () => {
    const booking = fakeBooking();
    const { prismaMock } = makePrismaMock({ booking, weddings: {} });
    const { findWeddingForSource } = await loadServiceWith(prismaMock, booking);

    expect(await findWeddingForSource('ENQUIRY', 'enquiry-1')).toBeNull();
    expect(await findWeddingForSource('CONSULTATION', 'consultation-1')).toBeNull();
  });

  test('LEAD is unaffected — no Booking link exists for Lead, so only the direct sourceLeadId check runs', async () => {
    const booking = fakeBooking();
    const leadWedding = { id: 'wedding-lead', sourceLeadId: 'lead-1', weddingNumber: 'WED-2027-0010' };
    const { prismaMock } = makePrismaMock({ booking, weddings: {} });
    // sourceLeadId isn't one of the branches findUniqueMock handles above —
    // extend it directly for this one case.
    (prismaMock.wedding.findUnique as ReturnType<typeof mock>).mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) => ('sourceLeadId' in where ? leadWedding : null)
    );
    const { findWeddingForSource } = await loadServiceWith(prismaMock, booking);

    const result = await findWeddingForSource('LEAD', 'lead-1');

    expect(result as unknown as Record<string, unknown>).toEqual(leadWedding);
  });
});

// Concurrency fix (production-integrity review, round 2): a mock can't
// exercise Postgres's actual blocking behavior for pg_advisory_xact_lock,
// but it can prove the two things that behavior depends on — (1) the lock
// is always acquired before any "does a Wedding already exist" read runs,
// so a concurrent transaction can never interleave between the check and
// the create, and (2) convertBookingToWedding and convertLeadToWedding lock
// on the *same* key for the same underlying Enquiry/Consultation, so they
// actually serialize against each other rather than each locking a
// different, non-conflicting key.
describe('convertBookingToWedding — advisory lock acquisition (concurrency fix)', () => {
  test('acquires the lock before running the same-booking or cross-path existence checks, not after', async () => {
    const booking = fakeBooking({ enquiryId: 'enquiry-1' });
    const { prismaMock, callLog } = makePrismaMock({ booking, weddings: {} });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    await convertBookingToWedding('booking-1');

    const firstReadIndex = callLog.findIndex((entry) => entry.startsWith('read:'));
    const lockIndexes = callLog.reduce<number[]>((acc, entry, i) => (entry.startsWith('lock:') ? [...acc, i] : acc), []);
    expect(lockIndexes.length).toBeGreaterThan(0);
    expect(Math.max(...lockIndexes)).toBeLessThan(firstReadIndex);
  });

  test('locks on every source identity the booking touches — its own id plus a linked Enquiry and Consultation — sorted for a deterministic order', async () => {
    const booking = fakeBooking({ id: 'booking-1', enquiryId: 'enquiry-1', consultationId: 'consultation-1' });
    const { prismaMock, executeRawMock } = makePrismaMock({ booking, weddings: {} });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    await convertBookingToWedding('booking-1');

    const lockedKeys = executeRawMock.mock.calls.map((call) => call[1]);
    expect(lockedKeys).toEqual(['BOOKING:booking-1', 'CONSULTATION:consultation-1', 'ENQUIRY:enquiry-1']);
  });

  test('a standalone booking (no enquiryId/consultationId) only locks its own id — no unnecessary cross-path lock', async () => {
    const booking = fakeBooking({ enquiryId: null, consultationId: null });
    const { prismaMock, executeRawMock } = makePrismaMock({ booking, weddings: {} });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    await convertBookingToWedding('booking-1');

    const lockedKeys = executeRawMock.mock.calls.map((call) => call[1]);
    expect(lockedKeys).toEqual(['BOOKING:booking-1']);
  });
});

describe('convertLeadToWedding — advisory lock acquisition (concurrency fix)', () => {
  function fakeEnquiry(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'enquiry-1',
      name: 'Priya Sharma',
      pipelineStage: 'WON',
      guestCount: '250',
      eventType: 'Traditional Hindu',
      ...overrides,
    };
  }

  function makeCrmPrismaMock({ weddingFound }: { weddingFound: Record<string, unknown> | null }) {
    const callLog: string[] = [];
    const findUniqueMock = mock(async () => {
      callLog.push('read:findUnique');
      return weddingFound;
    });
    const findFirstMock = mock(async () => {
      callLog.push('read:findFirst');
      return null;
    });
    const executeRawMock = mock(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      callLog.push(`lock:${values[0]}`);
      return 1;
    });
    const weddingCreateMock = mock(async (args: { data: Record<string, unknown> }) => ({ id: 'wedding-new', ...args.data }));
    const base = {
      wedding: { findUnique: findUniqueMock, findFirst: findFirstMock, create: weddingCreateMock, count: mock(async () => 0) },
      weddingEvent: { create: mock(async () => ({ id: 'we-1' })) },
      activityLog: { create: mock(async () => ({ id: 'log-1' })) },
      timelineMilestone: { createMany: mock(async () => ({ count: 0 })) },
      task: { create: mock(async () => ({ id: 'task-1' })) },
      $executeRaw: executeRawMock,
    };
    const prismaMock = { ...base, $transaction: mock(async (fn: (tx: typeof base) => unknown) => fn(base)) };
    return { prismaMock, executeRawMock, weddingCreateMock, callLog };
  }

  async function loadConvertLeadServiceWith(prismaMock: unknown, enquiry: ReturnType<typeof fakeEnquiry>) {
    mock.module('@/lib/prisma', () => ({ prisma: prismaMock }));
    mock.module('@/repositories/enquiry.repository', () => ({ enquiryRepository: { findById: mock(async () => enquiry) } }));
    mock.module('@/repositories/lead.repository', () => ({ leadRepository: { findById: mock(async () => null) } }));
    mock.module('@/repositories/consultation.repository', () => ({
      consultationRepository: { findById: mock(async () => null) },
    }));
    return import('./weddingConversion.service');
  }

  const convertInput = { weddingDate: new Date('2027-02-14'), city: 'Patna', tokenAdvanceReceived: true };

  test('locks the same `ENQUIRY:<id>` key convertBookingToWedding uses for a Booking linked to the same Enquiry — the two paths actually serialize against each other', async () => {
    const enquiry = fakeEnquiry();
    const { prismaMock, executeRawMock } = makeCrmPrismaMock({ weddingFound: null });
    const { convertLeadToWedding } = await loadConvertLeadServiceWith(prismaMock, enquiry);

    await convertLeadToWedding('ENQUIRY', 'enquiry-1', convertInput, null);

    const lockedKeys = executeRawMock.mock.calls.map((call) => call[1]);
    expect(lockedKeys).toEqual(['ENQUIRY:enquiry-1']);
  });

  test('acquires the lock before checking for an existing Wedding, and returns it (no duplicate) when a concurrent Booking-path conversion already committed one', async () => {
    const enquiry = fakeEnquiry();
    const existingWedding = { id: 'wedding-from-booking-path', sourceBookingId: 'booking-9', weddingNumber: 'WED-2027-0099' };
    const { prismaMock, weddingCreateMock, callLog } = makeCrmPrismaMock({ weddingFound: existingWedding });
    const { convertLeadToWedding } = await loadConvertLeadServiceWith(prismaMock, enquiry);

    const result = await convertLeadToWedding('ENQUIRY', 'enquiry-1', convertInput, null);

    expect(result as unknown as Record<string, unknown>).toEqual(existingWedding);
    expect(weddingCreateMock).not.toHaveBeenCalled();
    const firstReadIndex = callLog.findIndex((entry) => entry.startsWith('read:'));
    const lockIndex = callLog.findIndex((entry) => entry.startsWith('lock:'));
    expect(lockIndex).toBeLessThan(firstReadIndex);
  });
});

// ---------------------------------------------------------------------------
// Quotation build (docs/wedding-os/08-quotation.md §7): agreedPrice must respect quantity, and a quoted
// custom line without a vendor must not be reported as "vendor no longer exists".
// ---------------------------------------------------------------------------
describe('convertBookingToWedding — vendor booking agreed price respects quantity', () => {
  test('"500 plates × ₹800" becomes a ₹4,00,000 vendor booking, not ₹800', async () => {
    const booking = fakeBooking({
      items: [
        { id: 'i1', vendorId: 'vendor-1', vendorName: 'Royal Feast Catering', vendorCategory: 'Catering', packageName: 'Per plate', price: 800, quantity: 500 },
      ],
    });
    const { prismaMock, vendorBookingCreateMock } = makePrismaMock({ booking });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    await convertBookingToWedding('booking-1');

    const data = (vendorBookingCreateMock.mock.calls[0][0] as { data: { agreedPrice: number } }).data;
    expect(data.agreedPrice).toBe(400000);
  });

  test('a single-quantity line keeps its price, so existing marketplace bookings are unchanged', async () => {
    const booking = fakeBooking();
    const { prismaMock, vendorBookingCreateMock } = makePrismaMock({ booking });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    await convertBookingToWedding('booking-1');

    expect((vendorBookingCreateMock.mock.calls[0][0] as { data: { agreedPrice: number } }).data.agreedPrice).toBe(500000);
  });

  test('each item gets its own quantity-aware price', async () => {
    const booking = fakeBooking({
      items: [
        { id: 'i1', vendorId: 'v1', vendorName: 'A', vendorCategory: 'Catering', packageName: 'Plates', price: 800, quantity: 500 },
        { id: 'i2', vendorId: 'v2', vendorName: 'B', vendorCategory: 'Venues', packageName: 'Hall', price: 300000, quantity: 1 },
        { id: 'i3', vendorId: 'v3', vendorName: 'C', vendorCategory: 'Cabs', packageName: 'Cars', price: 5000, quantity: 4 },
      ],
    });
    const { prismaMock, vendorBookingCreateMock } = makePrismaMock({ booking });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    await convertBookingToWedding('booking-1');

    const prices = vendorBookingCreateMock.mock.calls.map((c) => (c[0] as { data: { agreedPrice: number } }).data.agreedPrice);
    expect(prices).toEqual([400000, 300000, 20000]);
  });
});

describe('convertBookingToWedding — vendor-less lines', () => {
  test('a quoted custom line (no vendor yet) creates an "assign a vendor" task, no vendor booking, and honest wording', async () => {
    const booking = fakeBooking({
      items: [
        { id: 'i1', vendorId: null, vendorName: 'To be assigned', vendorCategory: 'Decorators', packageName: 'Custom stage', price: 40000, quantity: 1 },
      ],
    });
    const { prismaMock, vendorBookingCreateMock, taskCreateMock, activityLogCreateMock } = makePrismaMock({ booking });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    await convertBookingToWedding('booking-1');

    expect(vendorBookingCreateMock).not.toHaveBeenCalled();
    const taskTitles = taskCreateMock.mock.calls.map((c) => (c[0] as { data: { title: string } }).data.title);
    expect(taskTitles).toContain('Assign a vendor for "Custom stage"');
    const logs = activityLogCreateMock.mock.calls.map((c) => (c[0] as { data: { summary: string } }).data.summary);
    expect(logs.some((l) => l.includes('No vendor assigned yet for "Custom stage"'))).toBe(true);
    expect(logs.some((l) => l.includes('no longer exists'))).toBe(false);
  });

  test('a real vendor that was removed keeps the original "no longer exists" wording', async () => {
    const booking = fakeBooking({
      items: [{ id: 'i1', vendorId: null, vendorName: 'Touch Of Cozy', vendorCategory: 'Venues', packageName: 'Hall', price: 300000, quantity: 1 }],
    });
    const { prismaMock, taskCreateMock, activityLogCreateMock } = makePrismaMock({ booking });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    await convertBookingToWedding('booking-1');

    const taskTitles = taskCreateMock.mock.calls.map((c) => (c[0] as { data: { title: string } }).data.title);
    expect(taskTitles).toContain('Assign replacement vendor for "Hall"');
    const logs = activityLogCreateMock.mock.calls.map((c) => (c[0] as { data: { summary: string } }).data.summary);
    expect(logs.some((l) => l.includes('vendor no longer exists'))).toBe(true);
  });
});
