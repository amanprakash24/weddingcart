/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { NextRequest } from 'next/server';

// Mocks `@/lib/adminAuth`, `@/services/booking.service`,
// `@/services/weddingConversion.service`, and `@/lib/whatsapp` — isolates the
// route's own status-transition/conversion-wiring/error-mapping logic from
// the real services, which have their own coverage
// (weddingConversion.service.test.ts covers convertBookingToWedding's actual
// idempotency and no-partial-write guarantees directly). Defines a local
// InvalidBookingStateError stand-in and exports it from the mocked module so
// the route's own `instanceof InvalidBookingStateError` check resolves
// against the exact same class reference the mock throws.
class FakeInvalidBookingStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBookingStateError';
  }
}

function fakeBooking(status: string) {
  return {
    id: 'booking-1',
    name: 'Test Customer',
    phone: '9876543210',
    city: 'Patna',
    total: 500000,
    status,
    items: [{ id: 'item-1', vendorName: 'Royal Caterers', packageName: 'Gold Package', price: 500000, quantity: 1 }],
  };
}

async function loadRouteWith({
  existingStatus,
  convertBookingToWedding = mock(async () => ({ id: 'wedding-1' })),
  sendWhatsAppMessage = mock(async () => ({ ok: true })),
}: {
  existingStatus: string;
  convertBookingToWedding?: ReturnType<typeof mock>;
  sendWhatsAppMessage?: ReturnType<typeof mock>;
}) {
  const getByIdMock = mock(async () => fakeBooking(existingStatus));
  const updateMock = mock(async (id: string, data: { status: string }) => ({ id, status: data.status }));

  mock.module('@/lib/adminAuth', () => ({ requireAdmin: mock(async () => true) }));
  mock.module('@/services/booking.service', () => ({ bookingService: { getById: getByIdMock, update: updateMock } }));
  mock.module('@/services/weddingConversion.service', () => ({
    convertBookingToWedding,
    InvalidBookingStateError: FakeInvalidBookingStateError,
  }));
  mock.module('@/lib/whatsapp', () => ({ sendWhatsAppMessage }));

  const route = await import('./route');
  return { PUT: route.PUT, getByIdMock, updateMock, convertBookingToWedding, sendWhatsAppMessage };
}

function putRequest(body: unknown) {
  return new NextRequest('http://localhost/api/bookings/booking-1', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function params() {
  return Promise.resolve({ id: 'booking-1' });
}

describe('PUT /api/bookings/[id] — Booking CONFIRMED -> Wedding conversion wiring', () => {
  test('confirmation with a valid weddingDate: Booking is marked CONFIRMED and Wedding conversion is invoked', async () => {
    const convertBookingToWedding = mock(async () => ({ id: 'wedding-1' }));
    const { PUT, updateMock } = await loadRouteWith({ existingStatus: 'CONTACTED', convertBookingToWedding });

    const res = await PUT(putRequest({ status: 'confirmed' }), { params: params() });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('confirmed');
    expect(updateMock).toHaveBeenCalledWith('booking-1', { status: 'CONFIRMED' });
    expect(convertBookingToWedding).toHaveBeenCalledWith('booking-1');
  });

  test('confirmation with a missing weddingDate: the failure is explicit (409), not a silent success and not a generic 500', async () => {
    const convertBookingToWedding = mock(async () => {
      throw new FakeInvalidBookingStateError('Booking booking-1 has no weddingDate — cannot convert until one is set');
    });
    const { PUT, updateMock } = await loadRouteWith({ existingStatus: 'CONTACTED', convertBookingToWedding });

    const res = await PUT(putRequest({ status: 'confirmed' }), { params: params() });
    const body = await res.json();

    // The booking's own status write still happened (separate, already-
    // committed operation) — proving this is a distinct, explicit failure
    // signal about conversion specifically, not a report that nothing at
    // all happened.
    expect(updateMock).toHaveBeenCalledWith('booking-1', { status: 'CONFIRMED' });
    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error).toContain('no weddingDate');
    expect(body.error).toContain('confirmed');
  });

  test('an unexpected error from conversion (not InvalidBookingStateError) is not swallowed into the 409 — it still surfaces as a 500', async () => {
    const convertBookingToWedding = mock(async () => {
      throw new Error('unexpected database error');
    });
    const { PUT } = await loadRouteWith({ existingStatus: 'CONTACTED', convertBookingToWedding });

    const res = await PUT(putRequest({ status: 'confirmed' }), { params: params() });

    expect(res.status).toBe(500);
  });

  test('retrying the same confirmation (existing status already CONFIRMED) re-attempts conversion — no CONTACTED workaround needed', async () => {
    let attempt = 0;
    const convertBookingToWedding = mock(async () => {
      attempt += 1;
      if (attempt === 1) throw new FakeInvalidBookingStateError('no weddingDate');
      return { id: 'wedding-1' };
    });
    const { PUT } = await loadRouteWith({ existingStatus: 'CONFIRMED', convertBookingToWedding });

    const first = await PUT(putRequest({ status: 'confirmed' }), { params: params() });
    expect(first.status).toBe(409);

    const second = await PUT(putRequest({ status: 'confirmed' }), { params: params() });
    const secondBody = await second.json();

    expect(second.status).toBe(200);
    expect(secondBody.success).toBe(true);
    expect(convertBookingToWedding).toHaveBeenCalledTimes(2);
  });

  test('repeated confirmation of an already-converted booking stays idempotent at the route level — both calls succeed', async () => {
    const convertBookingToWedding = mock(async () => ({ id: 'wedding-1' }));
    const { PUT } = await loadRouteWith({ existingStatus: 'CONFIRMED', convertBookingToWedding });

    const first = await PUT(putRequest({ status: 'confirmed' }), { params: params() });
    const second = await PUT(putRequest({ status: 'confirmed' }), { params: params() });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(convertBookingToWedding).toHaveBeenCalledTimes(2);
  });
});

describe('PUT /api/bookings/[id] — existing CONTACTED/WhatsApp behavior is unchanged', () => {
  test('a fresh transition into CONTACTED still sends the WhatsApp message, and does not touch conversion', async () => {
    const convertBookingToWedding = mock(async () => ({ id: 'wedding-1' }));
    const sendWhatsAppMessage = mock(async () => ({ ok: true }));
    const { PUT } = await loadRouteWith({ existingStatus: 'NEW', convertBookingToWedding, sendWhatsAppMessage });

    const res = await PUT(putRequest({ status: 'contacted' }), { params: params() });

    expect(res.status).toBe(200);
    expect(sendWhatsAppMessage).toHaveBeenCalledTimes(1);
    expect(convertBookingToWedding).not.toHaveBeenCalled();
  });

  test('re-saving an already-CONTACTED booking does not re-send the WhatsApp message', async () => {
    const sendWhatsAppMessage = mock(async () => ({ ok: true }));
    const { PUT } = await loadRouteWith({ existingStatus: 'CONTACTED', sendWhatsAppMessage });

    const res = await PUT(putRequest({ status: 'contacted' }), { params: params() });

    expect(res.status).toBe(200);
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
  });
});
