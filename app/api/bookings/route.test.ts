/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';

// Mocks `@/lib/adminAuth` and `@/services/booking.service` — isolates the
// route's own response-shaping from the real service/repository. Covers the
// one new observable behavior added here: the admin bookings list now
// carries the related Wedding's id (repositories/booking.repository.ts's
// `withItems` include), so the "Open Wedding Workspace" link in
// components/AdminClient.tsx has something to key off. Registers its own
// mock.module() for '@/services/booking.service' immediately before each
// dynamic import — app/api/bookings/[id]/route.test.ts mocks that same
// module path with a different (non-overlapping) shape, and Bun's
// mock.module() patches are global to the whole test process, not scoped
// per file (same gotcha fixed in weddingConversion.service.test.ts).
function fakeBooking(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'booking-1',
    name: 'Test Customer',
    phone: '9876543210',
    city: 'Patna',
    total: 500000,
    status: 'CONFIRMED',
    items: [],
    wedding: null,
    ...overrides,
  };
}

async function loadRouteWith(list: ReturnType<typeof mock>) {
  mock.module('@/lib/adminAuth', () => ({ requireAdmin: mock(async () => true) }));
  mock.module('@/services/booking.service', () => ({ bookingService: { list } }));
  const route = await import('./route');
  return { GET: route.GET };
}

describe('GET /api/bookings — exposes the related Wedding id, when one exists', () => {
  test('a booking with a converted Wedding includes wedding.id in the response', async () => {
    const list = mock(async () => ({ data: [fakeBooking({ wedding: { id: 'wedding-1' } })], total: 1 }));
    const { GET } = await loadRouteWith(list);

    const res = await GET();
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.data[0].wedding).toEqual({ id: 'wedding-1' });
  });

  test('a booking with no Wedding yet has wedding: null, not an error', async () => {
    const list = mock(async () => ({ data: [fakeBooking({ wedding: null })], total: 1 }));
    const { GET } = await loadRouteWith(list);

    const res = await GET();
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.data[0].wedding).toBeNull();
  });
});
