/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { ConflictError, ConversionLockedError, NotFoundError, ValidationError } from '@/lib/errors';

// Same isolation technique as ../actions.route.test.ts.
const session = { current: { user: { id: 'staff-1' } } as { user: { id: string } } | null };
type AnyFn = (...args: unknown[]) => Promise<unknown>;
const requireRole = mock<(roles: unknown) => Promise<typeof session.current>>(async () => session.current);
const BOOKING = {
  id: 'b1',
  name: 'Rahul Sharma',
  phone: '9876543210',
  city: 'Patna',
  total: 690000,
  status: 'NEW',
  weddingDate: new Date('2026-11-20T00:00:00Z'),
  guestCount: 500,
  quotationId: 'q1',
  items: [{}, {}, {}],
  secretInternalField: 'must not leak',
};
const service = {
  createBooking: mock<AnyFn>(async () => BOOKING),
};
mock.module('@/lib/auth/session', () => ({ requireRole, getSession: mock(async () => session.current) }));
mock.module('@/services/quotation.service', () => ({ quotationService: service }));
const { POST } = await import('./route');

const params = { params: Promise.resolve({ id: 'q1' }) };
const post = (body?: unknown, raw?: string) =>
  new NextRequest('http://localhost/api/quotations/q1/create-booking', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });

beforeEach(() => {
  session.current = { user: { id: 'staff-1' } };
  service.createBooking.mockClear();
  service.createBooking.mockImplementation(async () => BOOKING);
});

describe('POST /api/quotations/[id]/create-booking', () => {
  test('is staff-only: 401 without a session, and nothing is created', async () => {
    session.current = null;
    expect((await POST(post({}), params)).status).toBe(401);
    expect(service.createBooking).not.toHaveBeenCalled();
  });

  test('creates the booking from an empty body: 201 with a summary (no internal fields)', async () => {
    const res = await POST(post(), params);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toMatchObject({ id: 'b1', status: 'NEW', total: 690000, quotationId: 'q1', itemCount: 3, city: 'Patna' });
    expect(JSON.stringify(body)).not.toContain('secretInternalField');
    expect(service.createBooking).toHaveBeenCalledWith('q1', {}, 'staff-1');
  });

  test('passes only the validated overrides, with the date as a Date', async () => {
    await POST(post({ weddingDate: '2026-12-05', guestCount: '300', city: 'Ranchi', total: 1, items: [] }), params);
    const [, overrides] = service.createBooking.mock.calls[0] as [string, Record<string, unknown>];
    expect((overrides.weddingDate as Date).toISOString()).toBe('2026-12-05T00:00:00.000Z');
    expect(overrides.guestCount).toBe(300);
    expect(overrides.city).toBe('Ranchi');
    expect(overrides).not.toHaveProperty('total');
    expect(overrides).not.toHaveProperty('items');
  });

  test('a free-text date is 400 with the field named, and nothing is created', async () => {
    const res = await POST(post({ weddingDate: '20 October 20202' }), params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.issues[0].path).toEqual(['weddingDate']);
    expect(service.createBooking).not.toHaveBeenCalled();
  });

  test('an unreadable JSON body is treated as "no overrides", not a server error', async () => {
    const res = await POST(post(undefined, '{not json'), params);
    expect(res.status).toBe(201);
    expect(service.createBooking).toHaveBeenCalledWith('q1', {}, 'staff-1');
  });

  test.each([
    [new ConflictError('A booking was already created from this quotation'), 409],
    [new ConflictError("Record the customer's acceptance before creating a booking"), 409],
    [new ConversionLockedError('Cannot create a booking: this enquiry already converted to Wedding WED-2026-0002'), 409],
    [new ValidationError('Add the wedding date — the date on this enquiry is missing or not a clear date, and a booking needs one to become a wedding'), 400],
    [new NotFoundError('Quotation', 'q1'), 404],
  ])('maps service error %p to HTTP %p', async (error, status) => {
    service.createBooking.mockImplementation(async () => {
      throw error;
    });
    const res = await POST(post({}), params);
    expect(res.status).toBe(status);
    expect((await res.json()).success).toBe(false);
  });
});
