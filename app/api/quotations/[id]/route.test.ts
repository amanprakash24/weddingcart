/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { ConflictError, NotFoundError } from '@/lib/errors';

// Same isolation technique as ../route.test.ts (see the comment there).
const session = { current: { user: { id: 'staff-1' } } as { user: { id: string } } | null };
type AnyFn = (...args: unknown[]) => Promise<unknown>;
const requireRole = mock<(roles: unknown) => Promise<typeof session.current>>(async () => session.current);
const service = {
  listForSource: mock<AnyFn>(async () => [] as unknown[]),
  create: mock<AnyFn>(async () => ({}) as unknown),
  getById: mock<AnyFn>(async () => ({ id: 'q1' }) as unknown),
  update: mock<AnyFn>(async () => ({ id: 'q1' }) as unknown),
  deleteDraft: mock<AnyFn>(async () => undefined),
};
mock.module('@/lib/auth/session', () => ({ requireRole, getSession: mock(async () => session.current) }));
mock.module('@/services/quotation.service', () => ({ quotationService: service }));
const { GET, PATCH, DELETE } = await import('./route');

const params = { params: Promise.resolve({ id: 'q1' }) };
const ITEM = { description: 'Catering', unitPrice: 800, quantity: 500 };
const req = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/quotations/q1', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeEach(() => {
  session.current = { user: { id: 'staff-1' } };
  for (const fn of Object.values(service)) fn.mockClear();
  service.getById.mockImplementation(async () => ({ id: 'q1' }));
  service.update.mockImplementation(async () => ({ id: 'q1' }));
  service.deleteDraft.mockImplementation(async () => undefined);
});

describe('authentication — every method is staff-only', () => {
  test.each([
    ['GET', () => GET(req('GET'), params)],
    ['PATCH', () => PATCH(req('PATCH', { items: [ITEM] }), params)],
    ['DELETE', () => DELETE(req('DELETE'), params)],
  ])('%s returns 401 without a session and never reaches the service', async (_m, call) => {
    session.current = null;
    expect((await call()).status).toBe(401);
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
  });
});

describe('GET /api/quotations/[id]', () => {
  test('returns the quotation', async () => {
    const res = await GET(req('GET'), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { id: 'q1' } });
    expect(service.getById).toHaveBeenCalledWith('q1');
  });

  test('404 when it does not exist', async () => {
    service.getById.mockImplementation(async () => {
      throw new NotFoundError('Quotation', 'q1');
    });
    expect((await GET(req('GET'), params)).status).toBe(404);
  });
});

describe('PATCH /api/quotations/[id]', () => {
  test('edits a draft with the validated body', async () => {
    const res = await PATCH(req('PATCH', { items: [ITEM], discount: '1000', advanceAmount: 50000 }), params);
    expect(res.status).toBe(200);
    const [id, input] = service.update.mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe('q1');
    expect(input.discount).toBe(1000);
    expect(input.items).toHaveLength(1);
  });

  test('a client-sent total is dropped', async () => {
    await PATCH(req('PATCH', { items: [ITEM], total: 1 }), params);
    const [, input] = service.update.mock.calls[0] as [string, Record<string, unknown>];
    expect(input).not.toHaveProperty('total');
  });

  test('cannot move a quotation to another source — the source fields are not accepted', async () => {
    await PATCH(req('PATCH', { items: [ITEM], sourceType: 'LEAD', sourceId: 'other' }), params);
    const [, input] = service.update.mock.calls[0] as [string, Record<string, unknown>];
    expect(input).not.toHaveProperty('sourceId');
    expect(input).not.toHaveProperty('sourceType');
  });

  test('an invalid body is 400 with issues and nothing is saved', async () => {
    const res = await PATCH(req('PATCH', { items: [] }), params);
    expect(res.status).toBe(400);
    expect((await res.json()).issues.length).toBeGreaterThan(0);
    expect(service.update).not.toHaveBeenCalled();
  });

  test('editing a sent quotation is a 409 with the "create a revision" message', async () => {
    service.update.mockImplementation(async () => {
      throw new ConflictError('This quotation has been sent and cannot be edited — create a revision instead');
    });
    const res = await PATCH(req('PATCH', { items: [ITEM] }), params);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain('create a revision');
  });
});

describe('DELETE /api/quotations/[id]', () => {
  test('deletes a draft', async () => {
    const res = await DELETE(req('DELETE'), params);
    expect(res.status).toBe(200);
    expect(service.deleteDraft).toHaveBeenCalledWith('q1');
  });

  test('a sent quotation is kept: 409', async () => {
    service.deleteDraft.mockImplementation(async () => {
      throw new ConflictError('Only a draft quotation can be deleted — a sent quotation is kept as history');
    });
    expect((await DELETE(req('DELETE'), params)).status).toBe(409);
  });
});
