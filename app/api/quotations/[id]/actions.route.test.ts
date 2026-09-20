/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';

// Covers the four lifecycle routes (send / revise / accept / reject) with the same isolation technique
// as ../route.test.ts: session and service are mocked; the business rules themselves are covered by
// lib/quotation/rules.test.ts and by the staging verification of the real service.
const session = { current: { user: { id: 'staff-1' } } as { user: { id: string } } | null };
type AnyFn = (...args: unknown[]) => Promise<unknown>;
const requireRole = mock<(roles: unknown) => Promise<typeof session.current>>(async () => session.current);
const service = {
  listForSource: mock<AnyFn>(async () => []),
  create: mock<AnyFn>(async () => ({})),
  getById: mock<AnyFn>(async () => ({})),
  update: mock<AnyFn>(async () => ({})),
  deleteDraft: mock<AnyFn>(async () => undefined),
  send: mock<AnyFn>(async () => ({ quotation: { id: 'q1', status: 'SENT' }, stageAdvanced: false })),
  revise: mock<AnyFn>(async () => ({ id: 'q2', revision: 2 })),
  accept: mock<AnyFn>(async () => ({ id: 'q1', status: 'ACCEPTED' })),
  reject: mock<AnyFn>(async () => ({ id: 'q1', status: 'REJECTED' })),
};
mock.module('@/lib/auth/session', () => ({ requireRole, getSession: mock(async () => session.current) }));
mock.module('@/services/quotation.service', () => ({ quotationService: service }));
const { POST: send } = await import('./send/route');
const { POST: revise } = await import('./revise/route');
const { POST: accept } = await import('./accept/route');
const { POST: reject } = await import('./reject/route');

const params = { params: Promise.resolve({ id: 'q1' }) };
const post = (body?: unknown) =>
  new NextRequest('http://localhost/api/quotations/q1/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeEach(() => {
  session.current = { user: { id: 'staff-1' } };
  requireRole.mockClear();
  for (const fn of Object.values(service)) fn.mockClear();
});

describe('every lifecycle route is staff-only', () => {
  test.each([
    ['send', () => send(post(), params)],
    ['revise', () => revise(post(), params)],
    ['accept', () => accept(post({ channel: 'PHONE' }), params)],
    ['reject', () => reject(post({ reason: 'too expensive' }), params)],
  ])('%s returns 401 without a session and never reaches the service', async (_name, call) => {
    session.current = null;
    expect((await call()).status).toBe(401);
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
  });

  test('they require the internal team roles', async () => {
    await send(post(), params);
    expect(requireRole).toHaveBeenCalledWith(ADMIN_ROLES);
  });
});

describe('POST /api/quotations/[id]/send', () => {
  test('sends, passes the acting staff member, and reports whether the CRM stage moved', async () => {
    service.send.mockImplementation(async () => ({ quotation: { id: 'q1', status: 'SENT' }, stageAdvanced: true }));
    const res = await send(post(), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { id: 'q1', status: 'SENT' }, stageAdvanced: true });
    expect(service.send).toHaveBeenCalledWith('q1', 'staff-1');
  });

  test.each([
    [new ValidationError('Set a "valid until" date before sending'), 400],
    [new ConflictError('Only a draft quotation can be sent'), 409],
    [new NotFoundError('Quotation', 'q1'), 404],
  ])('maps %p to HTTP %p', async (error, status) => {
    service.send.mockImplementation(async () => {
      throw error;
    });
    expect((await send(post(), params)).status).toBe(status);
  });
});

describe('POST /api/quotations/[id]/revise', () => {
  test('creates the revision draft: 201', async () => {
    const res = await revise(post(), params);
    expect(res.status).toBe(201);
    expect((await res.json()).data).toEqual({ id: 'q2', revision: 2 });
    expect(service.revise).toHaveBeenCalledWith('q1', 'staff-1');
  });

  test('an accepted quotation cannot be revised: 409', async () => {
    service.revise.mockImplementation(async () => {
      throw new ConflictError('An accepted quotation cannot be revised');
    });
    expect((await revise(post(), params)).status).toBe(409);
  });
});

describe('POST /api/quotations/[id]/accept', () => {
  test('records how the customer accepted, with the acting staff member', async () => {
    const res = await accept(post({ channel: 'WHATSAPP', note: 'confirmed on chat' }), params);
    expect(res.status).toBe(200);
    expect(service.accept).toHaveBeenCalledWith('q1', { channel: 'WHATSAPP', note: 'confirmed on chat' }, 'staff-1');
  });

  test.each([[{}], [{ channel: 'EMAIL' }], [{ channel: 'phone' }]])('an invalid channel %p is 400 with issues and records nothing', async (body) => {
    const res = await accept(post(body), params);
    expect(res.status).toBe(400);
    expect((await res.json()).issues.length).toBeGreaterThan(0);
    expect(service.accept).not.toHaveBeenCalled();
  });

  test('accepting an expired or unsent quotation is a 409 with the server\'s message', async () => {
    service.accept.mockImplementation(async () => {
      throw new ConflictError('This quotation has expired — revise it to offer it again');
    });
    const res = await accept(post({ channel: 'PHONE' }), params);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain('expired');
  });
});

describe('POST /api/quotations/[id]/reject', () => {
  test('records the decline with its reason', async () => {
    const res = await reject(post({ reason: 'chose another venue' }), params);
    expect(res.status).toBe(200);
    expect(service.reject).toHaveBeenCalledWith('q1', { reason: 'chose another venue' }, 'staff-1');
  });

  test.each([[{}], [{ reason: '   ' }]])('a missing or blank reason %p is 400 and records nothing', async (body) => {
    expect((await reject(post(body), params)).status).toBe(400);
    expect(service.reject).not.toHaveBeenCalled();
  });
});
