/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { NextRequest } from 'next/server';
import { InvalidTransitionError } from '@/lib/errors';

// Mocks `@/lib/prisma` (satisfies lib/auth/rateLimit.ts's import chain — no
// DATABASE_URL/DB connection needed) and `@/services/event.service`
// (isolates the route's own rate-limit/validation logic from the real
// service, which is separately tested in services/event.service.test.ts),
// same technique as app/api/consultations/route.test.ts.
function makeLoginAttemptStore() {
  const rows: { identifier: string; success: boolean; createdAt: Date }[] = [];
  return {
    count: mock(async (args: { where: { identifier: string; createdAt: { gt: Date } } }) => {
      const { identifier, createdAt } = args.where;
      return rows.filter((r) => r.identifier === identifier && r.createdAt.getTime() > createdAt.gt.getTime()).length;
    }),
    create: mock(async (args: { data: { identifier: string; success: boolean } }) => {
      const row = { ...args.data, createdAt: new Date() };
      rows.push(row);
      return row;
    }),
  };
}

function postRequest(body: unknown, ip = '1.2.3.4') {
  return new NextRequest('http://localhost/api/events/e1/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

function params() {
  return Promise.resolve({ id: 'e1' });
}

async function loadRouteWith(
  loginAttemptStore: ReturnType<typeof makeLoginAttemptStore>,
  createOrder = mock(async (eventId: string, input: unknown) => ({
    order: { id: 'order-1', eventId, ...(input as object) },
    paymentUrl: 'https://razorpay.example/pay/order-1',
  }))
) {
  mock.module('@/lib/prisma', () => ({ prisma: { loginAttempt: loginAttemptStore } }));
  mock.module('@/services/event.service', () => ({ eventService: { createOrder } }));
  const route = await import('./route');
  return { POST: route.POST, createOrder };
}

const VALID_BODY = {
  customerName: 'Priya Sharma',
  customerPhone: '9876543210',
  customerEmail: 'priya@example.com',
  passTypeId: 'pass-1',
  quantity: 2,
  notes: 'Aisle seats please',
};

describe('POST /api/events/[id]/orders — rate limiting', () => {
  test('allows requests under the threshold, then rejects with 429 once exceeded', async () => {
    const store = makeLoginAttemptStore();
    const { POST } = await loadRouteWith(store);

    for (let i = 0; i < 5; i++) {
      const res = await POST(postRequest(VALID_BODY), { params: params() });
      expect(res.status).toBe(201);
    }
    const blocked = await POST(postRequest(VALID_BODY), { params: params() });
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.success).toBe(false);
  });

  test('does not let one IP exhaust the limit for another IP', async () => {
    const store = makeLoginAttemptStore();
    const { POST } = await loadRouteWith(store);

    for (let i = 0; i < 5; i++) {
      await POST(postRequest(VALID_BODY, '1.2.3.4'), { params: params() });
    }
    expect((await POST(postRequest(VALID_BODY, '1.2.3.4'), { params: params() })).status).toBe(429);
    expect((await POST(postRequest(VALID_BODY, '9.9.9.9'), { params: params() })).status).toBe(201);
  });
});

describe('POST /api/events/[id]/orders — request validation', () => {
  test('a valid order request succeeds and reaches eventService.createOrder with the parsed fields', async () => {
    const store = makeLoginAttemptStore();
    const { POST, createOrder } = await loadRouteWith(store);

    const res = await POST(postRequest(VALID_BODY), { params: params() });

    expect(res.status).toBe(201);
    expect(createOrder).toHaveBeenCalledTimes(1);
    const [eventId, input] = createOrder.mock.calls[0] as [string, Record<string, unknown>];
    expect(eventId).toBe('e1');
    expect(input.customerName).toBe('Priya Sharma');
    expect(input.customerPhone).toBe('9876543210');
    expect(input.customerEmail).toBe('priya@example.com');
    expect(input.passTypeId).toBe('pass-1');
    expect(input.quantity).toBe(2);
    expect(input.notes).toBe('Aisle seats please');
  });

  test('quantity above 10 is rejected', async () => {
    const store = makeLoginAttemptStore();
    const { POST, createOrder } = await loadRouteWith(store);

    const res = await POST(postRequest({ ...VALID_BODY, quantity: 11 }), { params: params() });

    expect(res.status).toBe(400);
    expect(createOrder).not.toHaveBeenCalled();
  });

  test('quantity of 0 is rejected', async () => {
    const store = makeLoginAttemptStore();
    const { POST, createOrder } = await loadRouteWith(store);

    const res = await POST(postRequest({ ...VALID_BODY, quantity: 0 }), { params: params() });

    expect(res.status).toBe(400);
    expect(createOrder).not.toHaveBeenCalled();
  });

  test('a non-integer quantity is rejected', async () => {
    const store = makeLoginAttemptStore();
    const { POST, createOrder } = await loadRouteWith(store);

    const res = await POST(postRequest({ ...VALID_BODY, quantity: 2.5 }), { params: params() });

    expect(res.status).toBe(400);
    expect(createOrder).not.toHaveBeenCalled();
  });

  test('a missing customerName is rejected', async () => {
    const store = makeLoginAttemptStore();
    const { customerName: _omit, ...rest } = VALID_BODY;
    const { POST, createOrder } = await loadRouteWith(store);

    const res = await POST(postRequest(rest), { params: params() });

    expect(res.status).toBe(400);
    expect(createOrder).not.toHaveBeenCalled();
  });

  test('an invalid customerPhone (not 10 digits) is rejected', async () => {
    const store = makeLoginAttemptStore();
    const { POST, createOrder } = await loadRouteWith(store);

    const res = await POST(postRequest({ ...VALID_BODY, customerPhone: '12345' }), { params: params() });

    expect(res.status).toBe(400);
    expect(createOrder).not.toHaveBeenCalled();
  });

  test('an invalid customerEmail is rejected', async () => {
    const store = makeLoginAttemptStore();
    const { POST, createOrder } = await loadRouteWith(store);

    const res = await POST(postRequest({ ...VALID_BODY, customerEmail: 'not-an-email' }), { params: params() });

    expect(res.status).toBe(400);
    expect(createOrder).not.toHaveBeenCalled();
  });

  test('a blank customerEmail is accepted, matching the public order form which sends "" for no email', async () => {
    const store = makeLoginAttemptStore();
    const { POST, createOrder } = await loadRouteWith(store);

    const res = await POST(postRequest({ ...VALID_BODY, customerEmail: '' }), { params: params() });

    expect(res.status).toBe(201);
    const [, input] = createOrder.mock.calls[0] as [string, Record<string, unknown>];
    expect(input.customerEmail).toBeNull();
  });

  test('a missing passTypeId is rejected', async () => {
    const store = makeLoginAttemptStore();
    const { passTypeId: _omit, ...rest } = VALID_BODY;
    const { POST, createOrder } = await loadRouteWith(store);

    const res = await POST(postRequest(rest), { params: params() });

    expect(res.status).toBe(400);
    expect(createOrder).not.toHaveBeenCalled();
  });

  test('a missing quantity defaults to 1', async () => {
    const store = makeLoginAttemptStore();
    const { quantity: _omit, ...rest } = VALID_BODY;
    const { POST, createOrder } = await loadRouteWith(store);

    const res = await POST(postRequest(rest), { params: params() });

    expect(res.status).toBe(201);
    const [, input] = createOrder.mock.calls[0] as [string, Record<string, unknown>];
    expect(input.quantity).toBe(1);
  });

  test('paymentProvider/paymentReference pass through unchanged and unvalidated, as before', async () => {
    const store = makeLoginAttemptStore();
    const { POST, createOrder } = await loadRouteWith(store);

    await POST(postRequest({ ...VALID_BODY, paymentProvider: 'CUSTOM', paymentReference: 'ref-123' }), {
      params: params(),
    });

    const [, input] = createOrder.mock.calls[0] as [string, Record<string, unknown>];
    expect(input.paymentProvider).toBe('CUSTOM');
    expect(input.paymentReference).toBe('ref-123');
  });
});

describe('POST /api/events/[id]/orders — existing sales-limit enforcement still surfaces correctly', () => {
  test("a sold-out pass type's InvalidTransitionError from eventService.createOrder is mapped to a 400", async () => {
    const store = makeLoginAttemptStore();
    const createOrder = mock(async () => {
      throw new InvalidTransitionError('Sales limit reached for this pass type');
    });
    const { POST } = await loadRouteWith(store, createOrder);

    const res = await POST(postRequest(VALID_BODY), { params: params() });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Sales limit reached for this pass type');
    expect(createOrder).toHaveBeenCalledTimes(1);
  });
});
