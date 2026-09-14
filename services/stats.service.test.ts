/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';

// Mocks the 7 repository modules statsService.get() calls directly, each
// with count()/sumTotal() implementations that take a small delay before
// resolving and track how many calls are simultaneously in flight — proves
// statsService.get() genuinely serializes its 12 queries (never more than 1
// outstanding at once) instead of firing them concurrently via Promise.all,
// which was this route's single heaviest contributor to exhausting the
// shared, intentionally-capped (max: 3) Postgres connection pool under
// AdminClient.tsx's 9-way simultaneous fetchAll() burst on every Dashboard
// load (production-integrity fix). Mocks at the repository boundary rather
// than '@/lib/prisma' specifically to avoid this file's mocks being
// overridden by services/booking.service.test.ts's own mock.module() calls
// for '@/repositories/vendor.repository' and '@/repositories/booking
// .repository' (a different, incomplete shape for a different test's
// purposes) — Bun's mock.module() patches are global to the whole test
// process, not scoped per file, so mocking every path this file's subject
// actually imports, explicitly, is what makes this collision-proof
// regardless of run order (same technique used in weddingConversion.service
// .test.ts for the identical class of collision).
interface TrackingState {
  inFlight: number;
  maxInFlight: number;
  callOrder: string[];
}

function tracked(name: string, resolveValue: (where?: Record<string, unknown>) => unknown, state: TrackingState) {
  return mock(async (where?: Record<string, unknown>) => {
    state.inFlight += 1;
    state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
    state.callOrder.push(name);
    await new Promise((done) => setTimeout(done, 5));
    state.inFlight -= 1;
    return resolveValue(where);
  });
}

function makeTrackedRepositoryMocks() {
  const state: TrackingState = { inFlight: 0, maxInFlight: 0, callOrder: [] };
  const isNew = (where?: Record<string, unknown>) => where?.status === 'NEW';

  const bookingCount = tracked('booking.count', (w) => (isNew(w) ? 0 : 8), state);
  const bookingSumTotal = tracked('booking.sumTotal', () => 500000, state);

  const mocks = {
    vendorRepository: { count: tracked('vendor.count', () => 87, state) },
    categoryRepository: { count: tracked('category.count', () => 22, state) },
    enquiryRepository: { count: tracked('enquiry.count', (w) => (isNew(w) ? 0 : 1), state) },
    consultationRepository: { count: tracked('consultation.count', (w) => (isNew(w) ? 0 : 22), state) },
    bookingRepository: { count: bookingCount, sumTotal: bookingSumTotal },
    vendorApplicationRepository: { count: tracked('vendorApplication.count', (w) => (isNew(w) ? 0 : 2), state) },
    leadRepository: { count: tracked('lead.count', () => 0, state) },
  };
  return { mocks, state };
}

async function loadServiceWith(mocks: ReturnType<typeof makeTrackedRepositoryMocks>['mocks']) {
  mock.module('@/repositories/vendor.repository', () => ({ vendorRepository: mocks.vendorRepository }));
  mock.module('@/repositories/category.repository', () => ({ categoryRepository: mocks.categoryRepository }));
  mock.module('@/repositories/enquiry.repository', () => ({ enquiryRepository: mocks.enquiryRepository }));
  mock.module('@/repositories/consultation.repository', () => ({ consultationRepository: mocks.consultationRepository }));
  mock.module('@/repositories/booking.repository', () => ({ bookingRepository: mocks.bookingRepository }));
  mock.module('@/repositories/vendorApplication.repository', () => ({ vendorApplicationRepository: mocks.vendorApplicationRepository }));
  mock.module('@/repositories/lead.repository', () => ({ leadRepository: mocks.leadRepository }));
  return import('./stats.service');
}

describe('statsService.get() — serialized, not concurrent (production-integrity fix)', () => {
  test('never has more than one query in flight at a time', async () => {
    const { mocks, state } = makeTrackedRepositoryMocks();
    const { statsService } = await loadServiceWith(mocks);

    await statsService.get();

    expect(state.maxInFlight).toBe(1);
  });

  test('issues exactly the 12 expected queries, in order', async () => {
    const { mocks, state } = makeTrackedRepositoryMocks();
    const { statsService } = await loadServiceWith(mocks);

    await statsService.get();

    expect(state.callOrder).toEqual([
      'vendor.count', 'category.count', 'enquiry.count', 'consultation.count',
      'enquiry.count', 'consultation.count', 'booking.count', 'booking.count',
      'vendorApplication.count', 'vendorApplication.count', 'lead.count', 'booking.sumTotal',
    ]);
  });

  test('returns the correct composed shape, mapping each query to the right field', async () => {
    const { mocks } = makeTrackedRepositoryMocks();
    const { statsService } = await loadServiceWith(mocks);

    const result = await statsService.get();

    expect(result).toEqual({
      vendors: 87, categories: 22, enquiries: 1, consultations: 22,
      newEnquiries: 0, newConsultations: 0, bookings: 8, newBookings: 0,
      outsideVendors: 2, newOutsideVendors: 0, leads: 0, revenue: 500000,
    });
  });
});
