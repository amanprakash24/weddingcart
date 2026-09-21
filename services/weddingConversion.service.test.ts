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
// The lead's stage follows the booking (services/leadStage.service.ts): a stand-in for the lead / enquiry / consultation tables
// that starts at ACCEPTED and records what the conversion writes.
function stageDelegate(stage = 'ACCEPTED') {
  return {
    findUnique: mock(async () => ({ pipelineStage: stage })),
    update: mock(async (args: { data: Record<string, unknown> }) => ({ ...args.data })),
  };
}

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
  quotation = null,
  invoiceCreateFails = false,
}: {
  quotation?: Record<string, unknown> | null;
  invoiceCreateFails?: boolean;
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

  const invoiceCreateMock = mock(async (args: { data: Record<string, unknown> }) => {
    if (invoiceCreateFails) throw new Error('invoice insert failed');
    return { id: 'inv-1', ...args.data };
  });
  const quotationUpdateMock = mock(async (args: { data: Record<string, unknown> }) => ({ id: 'q-1', ...args.data }));
  const quotationFindUniqueMock = mock(async () => quotation);

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
      findMany: mock(async () => []), // number generation: no earlier wedding in the bucket
    },
    invoice: {
      create: invoiceCreateMock,
      findMany: mock(async () => []), // number generation: no earlier invoice in the bucket
    },
    quotation: {
      findUnique: quotationFindUniqueMock,
      update: quotationUpdateMock,
    },
    weddingEvent: { create: weddingEventCreateMock },
    vendorBooking: { create: vendorBookingCreateMock },
    task: { create: taskCreateMock },
    activityLog: { create: activityLogCreateMock },
    lead: stageDelegate(),
    enquiry: stageDelegate(),
    consultation: stageDelegate(),
    $executeRaw: executeRawMock,
  };
  const prismaMock = {
    ...base,
    $transaction: mock(async (fn: (tx: typeof base) => unknown) => fn(base)),
  };
  return {
    prismaMock,
    stageTables: { enquiry: base.enquiry, consultation: base.consultation },
    weddingCreateMock,
    weddingEventCreateMock,
    vendorBookingCreateMock,
    taskCreateMock,
    activityLogCreateMock,
    executeRawMock,
    callLog,
    invoiceCreateMock,
    quotationUpdateMock,
    quotationFindUniqueMock,
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

  test('the enquiry the booking came from reads Booked once the wedding exists — same transaction, and logged on its timeline', async () => {
    const booking = fakeBooking({ enquiryId: 'enquiry-1' });
    const { prismaMock, stageTables, activityLogCreateMock } = makePrismaMock({ booking, weddings: {} });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    await convertBookingToWedding('booking-1');

    expect(stageTables.enquiry.update).toHaveBeenCalledTimes(1);
    expect(stageTables.enquiry.update.mock.calls[0][0].data.pipelineStage).toBe('WON');
    expect(stageTables.consultation.update).not.toHaveBeenCalled();
    const logged = activityLogCreateMock.mock.calls.map((c) => c[0].data.summary as string);
    expect(logged).toContain('Stage changed: Accepted — booking pending → Booked');
  });

  test('a standalone booking (no enquiry/consultation) touches no lead stage', async () => {
    const booking = fakeBooking();
    const { prismaMock, stageTables } = makePrismaMock({ booking, weddings: {} });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);
    await convertBookingToWedding('booking-1');
    expect(stageTables.enquiry.update).not.toHaveBeenCalled();
    expect(stageTables.consultation.update).not.toHaveBeenCalled();
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
    // only the CONVERSION locks must precede every read; the number-bucket lock (lock:number:…) is taken later,
    // right before the number is generated, and is asserted separately below
    const lockIndexes = callLog.reduce<number[]>(
      (acc, entry, i) => (entry.startsWith('lock:') && !entry.startsWith('lock:number:') ? [...acc, i] : acc),
      []
    );
    expect(lockIndexes.length).toBeGreaterThan(0);
    expect(Math.max(...lockIndexes)).toBeLessThan(firstReadIndex);
  });

  test('locks on every source identity the booking touches — its own id plus a linked Enquiry and Consultation — sorted for a deterministic order', async () => {
    const booking = fakeBooking({ id: 'booking-1', enquiryId: 'enquiry-1', consultationId: 'consultation-1' });
    const { prismaMock, executeRawMock } = makePrismaMock({ booking, weddings: {} });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    await convertBookingToWedding('booking-1');

    const lockedKeys = executeRawMock.mock.calls.map((call) => call[1]).filter((key) => !String(key).startsWith('number:'));
    expect(lockedKeys).toEqual(['BOOKING:booking-1', 'CONSULTATION:consultation-1', 'ENQUIRY:enquiry-1']);
  });

  test('a standalone booking (no enquiryId/consultationId) only locks its own id — no unnecessary cross-path lock', async () => {
    const booking = fakeBooking({ enquiryId: null, consultationId: null });
    const { prismaMock, executeRawMock } = makePrismaMock({ booking, weddings: {} });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    await convertBookingToWedding('booking-1');

    const lockedKeys = executeRawMock.mock.calls.map((call) => call[1]).filter((key) => !String(key).startsWith('number:'));
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

  function makeCrmPrismaMock({
    weddingFound,
    acceptedQuotation = null,
  }: {
    weddingFound: Record<string, unknown> | null;
    acceptedQuotation?: Record<string, unknown> | null;
  }) {
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
    const invoiceCreateMock = mock(async (args: { data: Record<string, unknown> }) => ({ id: 'inv-crm', ...args.data }));
    const quotationUpdateMock = mock(async (args: { data: Record<string, unknown> }) => ({ id: 'q-crm', ...args.data }));
    const base = {
      wedding: {
        findUnique: findUniqueMock,
        findFirst: findFirstMock,
        create: weddingCreateMock,
        count: mock(async () => 0),
        findMany: mock(async () => []),
      },
      invoice: { create: invoiceCreateMock, findMany: mock(async () => []) },
      quotation: { findFirst: mock(async () => acceptedQuotation), update: quotationUpdateMock },
      weddingEvent: { create: mock(async () => ({ id: 'we-1' })) },
      activityLog: { create: mock(async () => ({ id: 'log-1' })) },
      lead: stageDelegate(),
      enquiry: stageDelegate(),
      consultation: stageDelegate(),
      timelineMilestone: { createMany: mock(async () => ({ count: 0 })) },
      task: { create: mock(async () => ({ id: 'task-1' })) },
      $executeRaw: executeRawMock,
    };
    const prismaMock = { ...base, $transaction: mock(async (fn: (tx: typeof base) => unknown) => fn(base)) };
    return { prismaMock, executeRawMock, weddingCreateMock, callLog, invoiceCreateMock, quotationUpdateMock };
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

    const lockedKeys = executeRawMock.mock.calls.map((call) => call[1]).filter((key) => !String(key).startsWith('number:'));
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

  describe('convertLeadToWedding — automatic advance invoice (CRM path)', () => {
    const crmEnquiry = () => ({
      id: 'enquiry-1',
      name: 'Priya Sharma',
      phone: '9812345678',
      email: 'priya@example.com',
      city: 'Patna',
      pipelineStage: 'WON',
      guestCount: '250',
      eventType: 'Traditional Hindu',
    });
    const crmInput = { weddingDate: new Date('2027-02-14'), city: 'Patna', tokenAdvanceReceived: false };

    async function loadCrm(prismaMock: unknown) {
      mock.module('@/lib/prisma', () => ({ prisma: prismaMock }));
      mock.module('@/repositories/enquiry.repository', () => ({ enquiryRepository: { findById: mock(async () => crmEnquiry()) } }));
      mock.module('@/repositories/lead.repository', () => ({ leadRepository: { findById: mock(async () => null) } }));
      mock.module('@/repositories/consultation.repository', () => ({ consultationRepository: { findById: mock(async () => null) } }));
      return import('./weddingConversion.service');
    }

    test('the source\'s ACCEPTED quotation becomes a draft advance invoice addressed to the enquiry, with no tax', async () => {
      const { prismaMock, invoiceCreateMock, quotationUpdateMock } = makeCrmPrismaMock({ weddingFound: null, acceptedQuotation: acceptedQuotation() });
      const { convertLeadToWedding } = await loadCrm(prismaMock);

      await convertLeadToWedding('ENQUIRY', 'enquiry-1', crmInput, 'staff-1');

      expect(invoiceCreateMock).toHaveBeenCalledTimes(1);
      const data = (invoiceCreateMock.mock.calls[0][0] as { data: Record<string, unknown> }).data;
      expect(data).toMatchObject({
        status: 'DRAFT',
        total: 200000,
        gstEnabled: false,
        gstAmount: 0,
        clientName: 'Priya Sharma',
        clientPhone: '9812345678',
        clientEmail: 'priya@example.com',
        clientCity: 'Patna',
        eventDate: '2027-02-14',
      });
      expect((quotationUpdateMock.mock.calls[0][0] as { data: unknown }).data).toEqual({ advanceInvoice: { connect: { id: 'inv-crm' } } });
    });

    test('a source with no accepted quotation converts exactly as before — no invoice', async () => {
      const { prismaMock, invoiceCreateMock } = makeCrmPrismaMock({ weddingFound: null, acceptedQuotation: null });
      const { convertLeadToWedding } = await loadCrm(prismaMock);

      await convertLeadToWedding('ENQUIRY', 'enquiry-1', crmInput, null);

      expect(invoiceCreateMock).not.toHaveBeenCalled();
    });

    test('an advance invoice that already exists is not created again', async () => {
      const { prismaMock, invoiceCreateMock } = makeCrmPrismaMock({
        weddingFound: null,
        acceptedQuotation: acceptedQuotation({ advanceInvoiceId: 'inv-existing' }),
      });
      const { convertLeadToWedding } = await loadCrm(prismaMock);

      await convertLeadToWedding('ENQUIRY', 'enquiry-1', crmInput, null);

      expect(invoiceCreateMock).not.toHaveBeenCalled();
    });

    test('an already-converted source returns the existing wedding and creates no invoice', async () => {
      const { prismaMock, invoiceCreateMock } = makeCrmPrismaMock({
        weddingFound: { id: 'wedding-existing', weddingNumber: 'WED-2027-0009' },
        acceptedQuotation: acceptedQuotation(),
      });
      const { convertLeadToWedding } = await loadCrm(prismaMock);

      await convertLeadToWedding('ENQUIRY', 'enquiry-1', crmInput, null);

      expect(invoiceCreateMock).not.toHaveBeenCalled();
    });
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

// ---------------------------------------------------------------------------
// Race-safe numbering inside the conversion (docs/wedding-os/08-quotation.md §7 #2)
// ---------------------------------------------------------------------------
describe('convertBookingToWedding — wedding number generation is serialized', () => {
  test('takes the WED-YYYY- bucket lock AFTER the conversion locks and BEFORE the wedding is created', async () => {
    const booking = fakeBooking({ enquiryId: 'enquiry-1' });
    const { prismaMock, callLog, weddingCreateMock } = makePrismaMock({ booking });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    await convertBookingToWedding('booking-1');

    const year = new Date().getFullYear();
    const numberLockIndex = callLog.findIndex((entry) => entry === `lock:number:WED-${year}-`);
    const conversionLocks = callLog.map((e, i) => (e.startsWith('lock:') && !e.startsWith('lock:number:') ? i : -1)).filter((i) => i >= 0);
    expect(numberLockIndex).toBeGreaterThan(-1);
    expect(numberLockIndex).toBeGreaterThan(Math.max(...conversionLocks));
    expect(weddingCreateMock).toHaveBeenCalledTimes(1);
  });

  test('the first wedding of the year is WED-YYYY-0001 (highest existing + 1, not a row count)', async () => {
    const booking = fakeBooking();
    const { prismaMock, weddingCreateMock } = makePrismaMock({ booking });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    await convertBookingToWedding('booking-1');

    const data = (weddingCreateMock.mock.calls[0][0] as { data: { weddingNumber: string } }).data;
    expect(data.weddingNumber).toBe(`WED-${new Date().getFullYear()}-0001`);
  });
});

// ---------------------------------------------------------------------------
// Automatic advance invoice (docs/wedding-os/08-quotation.md §6.6)
// ---------------------------------------------------------------------------
const acceptedQuotation = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'q-1',
  quotationNumber: 'QTN-202609-0007',
  status: 'ACCEPTED',
  total: 730000,
  advanceAmount: 200000,
  advanceInvoiceId: null,
  items: [],
  ...overrides,
});

describe('convertBookingToWedding — automatic advance invoice', () => {
  test('a booking from an accepted quotation creates ONE draft invoice for the advance, with no tax', async () => {
    const booking = fakeBooking({ quotationId: 'q-1', name: 'Rahul Sharma', phone: '9876543210' });
    const { prismaMock, invoiceCreateMock } = makePrismaMock({ booking, quotation: acceptedQuotation() });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    await convertBookingToWedding('booking-1');

    expect(invoiceCreateMock).toHaveBeenCalledTimes(1);
    const data = (invoiceCreateMock.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({
      status: 'DRAFT',
      subtotal: 200000,
      discount: 0,
      total: 200000,
      gstEnabled: false,
      gstAmount: 0,
      clientName: 'Rahul Sharma',
      clientPhone: '9876543210',
      clientCity: 'Patna',
      eventDate: '2027-02-01',
      wedding: { connect: { id: 'wedding-1' } },
    });
    expect(String(data.invoiceNumber)).toMatch(/^INV-\d{6}-0001$/);
    expect((data.items as { create: unknown[] }).create).toEqual([{ description: 'Advance — QTN-202609-0007', amount: 200000, quantity: 1 }]);
    expect(String(data.notes)).toContain('No tax applied');
  });

  test('the invoice is linked back to the quotation (the idempotency anchor) and the event is logged on the wedding', async () => {
    const booking = fakeBooking({ quotationId: 'q-1', name: 'Rahul', phone: '9876543210' });
    const { prismaMock, quotationUpdateMock, activityLogCreateMock } = makePrismaMock({ booking, quotation: acceptedQuotation() });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    await convertBookingToWedding('booking-1');

    expect((quotationUpdateMock.mock.calls[0][0] as { data: unknown }).data).toEqual({ advanceInvoice: { connect: { id: 'inv-1' } } });
    const logs = activityLogCreateMock.mock.calls.map((c) => (c[0] as { data: { type: string; summary: string } }).data);
    const invoiceLog = logs.find((l) => l.type === 'INVOICE_CREATED');
    expect(invoiceLog?.summary).toContain('QTN-202609-0007');
    expect(invoiceLog?.summary).toContain('₹2,00,000');
  });

  test('the invoice is created AFTER the wedding exists, inside the same transaction', async () => {
    const booking = fakeBooking({ quotationId: 'q-1', name: 'Rahul', phone: '9876543210' });
    const { prismaMock, weddingCreateMock, invoiceCreateMock } = makePrismaMock({ booking, quotation: acceptedQuotation() });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    await convertBookingToWedding('booking-1');

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(weddingCreateMock.mock.invocationCallOrder[0]).toBeLessThan(invoiceCreateMock.mock.invocationCallOrder[0]);
  });

  test('NO payment link is created: nothing calls out over the network during conversion', async () => {
    const booking = fakeBooking({ quotationId: 'q-1', name: 'Rahul', phone: '9876543210' });
    const { prismaMock } = makePrismaMock({ booking, quotation: acceptedQuotation() });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);
    const realFetch = globalThis.fetch;
    const fetchSpy = mock(async () => new Response('{}'));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    try {
      await convertBookingToWedding('booking-1');
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test.each([
    ['no quotation on the booking', {}, null],
    ['a booking whose quotation is not accepted', { quotationId: 'q-1' }, acceptedQuotation({ status: 'SENT' })],
    ['a zero advance', { quotationId: 'q-1' }, acceptedQuotation({ advanceAmount: 0 })],
    ['an advance invoice that already exists (retry / race)', { quotationId: 'q-1' }, acceptedQuotation({ advanceInvoiceId: 'inv-existing' })],
  ])('creates NO invoice for %s', async (_name, bookingOverrides, quotation) => {
    const booking = fakeBooking({ name: 'Rahul', phone: '9876543210', ...bookingOverrides });
    const { prismaMock, invoiceCreateMock, quotationUpdateMock } = makePrismaMock({ booking, quotation });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    await convertBookingToWedding('booking-1');

    expect(invoiceCreateMock).not.toHaveBeenCalled();
    expect(quotationUpdateMock).not.toHaveBeenCalled();
  });

  test('a booking with no quotation never even looks one up — existing marketplace bookings are untouched', async () => {
    const booking = fakeBooking();
    const { prismaMock, quotationFindUniqueMock } = makePrismaMock({ booking });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    await convertBookingToWedding('booking-1');

    expect(quotationFindUniqueMock).not.toHaveBeenCalled();
  });

  test('if the invoice cannot be created the WHOLE conversion fails — no wedding without its invoice', async () => {
    const booking = fakeBooking({ quotationId: 'q-1', name: 'Rahul', phone: '9876543210' });
    const { prismaMock } = makePrismaMock({ booking, quotation: acceptedQuotation(), invoiceCreateFails: true });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    await expect(convertBookingToWedding('booking-1')).rejects.toThrow('invoice insert failed');
  });

  test('retrying an already-converted booking returns the wedding and creates no second invoice', async () => {
    const booking = fakeBooking({ quotationId: 'q-1', name: 'Rahul', phone: '9876543210' });
    const existing = { id: 'wedding-existing', sourceBookingId: 'booking-1', weddingNumber: 'WED-2027-0001' };
    const { prismaMock, invoiceCreateMock } = makePrismaMock({
      booking,
      quotation: acceptedQuotation(),
      weddings: { sourceBookingId: existing },
    });
    const { convertBookingToWedding } = await loadServiceWith(prismaMock, booking);

    const result = await convertBookingToWedding('booking-1');

    expect((result as unknown as { id: string }).id).toBe('wedding-existing');
    expect(invoiceCreateMock).not.toHaveBeenCalled();
  });
});
