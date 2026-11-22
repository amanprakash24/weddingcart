/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { Role } from '@/lib/auth/roles';

// The Invoices screen lists every invoice in the company with its amounts — company financials, founder only
// (21 Nov 2026). Every handler (list, create, read, edit, delete) refuses Sales and Operations with 403 and the signed-out
// with 401, before any invoice is read or changed. Session and services are mocked.
type Session = { user: { id: string; roles: Role[] } } | null;
const session = { current: null as Session };
type AnyFn = (...args: unknown[]) => Promise<unknown>;
const invoice = {
  id: 'inv-1', status: 'SENT', invoiceNumber: 'INV-1', weddingId: null, payments: [], paymentLinks: [],
};
const invoiceService = {
  list: mock<AnyFn>(async () => ({ data: [invoice] })),
  create: mock<AnyFn>(async () => invoice),
  getById: mock<AnyFn>(async () => invoice),
  update: mock<AnyFn>(async () => invoice),
  delete: mock<AnyFn>(async () => undefined),
};
mock.module('@/lib/auth/session', () => ({
  getSession: mock(async () => session.current),
  requireRole: mock(async () => session.current),
}));
mock.module('@/services/invoice.service', () => ({ invoiceService }));
mock.module('@/services/invoiceWorkflow.service', () => ({
  findWeddingsForClientPhone: mock(async () => []),
  standaloneInvoiceWarning: () => '',
}));
const list = await import('./route');
const one = await import('./[id]/route');

const ctx = { params: Promise.resolve({ id: 'inv-1' }) };
const req = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/invoices', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const as = (...roles: Role[]) => {
  session.current = { user: { id: 'u1', roles } };
};

const calls: [string, () => Promise<Response>][] = [
  ['GET list', () => list.GET()],
  ['POST create', () => list.POST(req('POST', { clientName: 'A', clientPhone: '9876543210', confirmStandalone: true, items: [] }))],
  ['GET one', () => one.GET(req('GET'), ctx as never)],
  ['PUT edit', () => one.PUT(req('PUT', { status: 'paid' }), ctx as never)],
  ['DELETE', () => one.DELETE(req('DELETE'), ctx as never)],
];

beforeEach(() => {
  session.current = null;
  for (const fn of Object.values(invoiceService)) fn.mockClear();
});

const touched = () => Object.values(invoiceService).some((fn) => fn.mock.calls.length > 0);

describe('Invoices API is founder-only', () => {
  test.each(calls)('%s — signed out → 401, nothing touched', async (_name, call) => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(touched()).toBe(false);
  });

  test.each(calls)('%s — Sales → 403, nothing touched', async (_name, call) => {
    as(Role.SALES);
    const res = await call();
    expect(res.status).toBe(403);
    expect(touched()).toBe(false);
  });

  test.each(calls)('%s — Operations → 403, nothing touched', async (_name, call) => {
    as(Role.OPERATIONS);
    const res = await call();
    expect(res.status).toBe(403);
    expect(touched()).toBe(false);
  });

  test.each(calls)('%s — a vendor or couple → 401', async (_name, call) => {
    as(Role.VENDOR, Role.CUSTOMER);
    const res = await call();
    expect(res.status).toBe(401);
  });

  test.each(calls)('%s — founder → allowed', async (_name, call) => {
    as(Role.SUPER_ADMIN);
    const res = await call();
    expect(res.status).toBeLessThan(300);
    expect(touched()).toBe(true);
  });
});
