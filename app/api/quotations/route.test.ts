/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';

// Mocks `@/lib/auth/session` (exports both real names, so other test files that reach the real
// module through lib/adminAuth aren't broken by this file's mock) and
// `@/services/quotation.service` (only this route's tests import the real one, so mocking it here
// can't hijack another file). The service's own rules are covered by lib/quotation/*.test.ts.
const session = { current: { user: { id: 'staff-1' } } as { user: { id: string } } | null };
type AnyFn = (...args: unknown[]) => Promise<unknown>;
const requireRole = mock<(roles: unknown) => Promise<typeof session.current>>(async () => session.current);
const service = {
  listForSource: mock<AnyFn>(async () => [] as unknown[]),
  create: mock<AnyFn>(async () => ({ id: 'q1' }) as unknown),
  getById: mock<AnyFn>(async () => ({}) as unknown),
  update: mock<AnyFn>(async () => ({}) as unknown),
  deleteDraft: mock<AnyFn>(async () => undefined),
};
mock.module('@/lib/auth/session', () => ({ requireRole, getSession: mock(async () => session.current) }));
mock.module('@/services/quotation.service', () => ({ quotationService: service }));
const { GET, POST } = await import('./route');

const ITEM = { description: 'Grand Ballroom — 500 guests', unitPrice: 400000, quantity: 1 };
const VALID = { sourceType: 'ENQUIRY', sourceId: 'e1', items: [ITEM], advanceAmount: 100000 };

const post = (body: unknown) =>
  new NextRequest('http://localhost/api/quotations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const get = (qs: string) => new NextRequest(`http://localhost/api/quotations${qs}`);

beforeEach(() => {
  session.current = { user: { id: 'staff-1' } };
  requireRole.mockClear();
  for (const fn of Object.values(service)) fn.mockClear();
  service.create.mockImplementation(async () => ({ id: 'q1' }));
  service.listForSource.mockImplementation(async () => []);
});

describe('GET /api/quotations', () => {
  test('rejects an unauthenticated caller with 401 and never touches the service', async () => {
    session.current = null;
    const res = await GET(get('?sourceType=ENQUIRY&sourceId=e1'));
    expect(res.status).toBe(401);
    expect(service.listForSource).not.toHaveBeenCalled();
  });

  test('requires the internal team roles (ADMIN_ROLES)', async () => {
    await GET(get('?sourceType=ENQUIRY&sourceId=e1'));
    expect(requireRole).toHaveBeenCalledWith(ADMIN_ROLES);
  });

  test.each([['', 'nothing'], ['?sourceType=ENQUIRY', 'no sourceId'], ['?sourceType=BOOKING&sourceId=x', 'an invalid sourceType']])(
    'returns 400 for %p (%s)',
    async (qs) => {
      const res = await GET(get(qs));
      expect(res.status).toBe(400);
      expect(service.listForSource).not.toHaveBeenCalled();
    }
  );

  test('lists the quotations for a source', async () => {
    service.listForSource.mockImplementation(async () => [{ id: 'q1' }]);
    const res = await GET(get('?sourceType=CONSULTATION&sourceId=c9'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: [{ id: 'q1' }] });
    expect(service.listForSource).toHaveBeenCalledWith('CONSULTATION', 'c9');
  });
});

describe('POST /api/quotations', () => {
  test('rejects an unauthenticated caller with 401 and creates nothing', async () => {
    session.current = null;
    expect((await POST(post(VALID))).status).toBe(401);
    expect(service.create).not.toHaveBeenCalled();
  });

  test('creates a draft: 201, source split from the body, the acting staff member passed through', async () => {
    const res = await POST(post(VALID));
    expect(res.status).toBe(201);
    expect(service.create).toHaveBeenCalledTimes(1);
    const [sourceType, sourceId, input, actorId] = service.create.mock.calls[0] as [string, string, Record<string, unknown>, string];
    expect([sourceType, sourceId, actorId]).toEqual(['ENQUIRY', 'e1', 'staff-1']);
    expect(input).not.toHaveProperty('sourceType');
    expect(input.advanceAmount).toBe(100000);
    expect(input.gstEnabled).toBe(false);
  });

  test('a client-sent total never reaches the service', async () => {
    await POST(post({ ...VALID, subtotal: 1, total: 1, balance: 1 }));
    const [, , input] = service.create.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(input).not.toHaveProperty('subtotal');
    expect(input).not.toHaveProperty('total');
    expect(input).not.toHaveProperty('balance');
  });

  test('a malformed body returns 400 with field-level issues, and creates nothing', async () => {
    const res = await POST(post({ ...VALID, items: [{ ...ITEM, unitPrice: -5 }] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid request');
    expect(body.issues.some((i: { path: (string | number)[] }) => i.path[0] === 'items')).toBe(true);
    expect(service.create).not.toHaveBeenCalled();
  });

  test.each([
    [new ConflictError('This enquiry already has an open quotation (QTN-202609-0001) — edit or finish it first'), 409],
    [new NotFoundError('ENQUIRY', 'e1'), 404],
    [new ValidationError('Advance cannot be more than the total'), 400],
  ])('maps service error %p to HTTP %p', async (error, status) => {
    service.create.mockImplementation(async () => {
      throw error;
    });
    const res = await POST(post(VALID));
    expect(res.status).toBe(status);
    expect((await res.json()).success).toBe(false);
  });
});
