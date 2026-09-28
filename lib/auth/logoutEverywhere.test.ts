/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';

// End-to-end over the real session modules: login tokens on two "devices", logout on one,
// then every protected check (getSession for APIs, proxy for pages) must reject both.
const users = new Map<string, number>();
let fail = false;
mock.module('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mock(async ({ where }: { where: { id: string } }) =>
        users.has(where.id) ? { sessionVersion: users.get(where.id)! } : null
      ),
      updateMany: mock(async ({ where }: { where: { id: string } }) => {
        if (fail) throw new Error('db down');
        if (!users.has(where.id)) return { count: 0 };
        users.set(where.id, users.get(where.id)! + 1);
        return { count: 1 };
      }),
    },
  },
}));

// The token each "request" carries (what the browser cookie decodes to).
let currentToken: { sub?: string; sv?: number; roles: string[] } | null = null;
mock.module('next-auth/jwt', () => ({ getToken: mock(async () => currentToken) }));
mock.module('next-auth', () => ({
  getServerSession: mock(async () =>
    currentToken ? { user: { id: currentToken.sub, roles: currentToken.roles, sessionVersion: currentToken.sv } } : null
  ),
}));
mock.module('@/lib/auth/auth', () => ({ authOptions: {} }));

const { getSession, requireRole } = await import('./session');
const { logoutEverywhere } = await import('./logout');
const { proxy } = await import('../../proxy');

const laptop = { sub: 'admin-1', sv: 0, roles: ['SUPER_ADMIN'] };
const phone = { sub: 'admin-1', sv: 0, roles: ['SUPER_ADMIN'] };
const otherAdmin = { sub: 'admin-2', sv: 0, roles: ['SUPER_ADMIN'] };
const req = (path: string) => new NextRequest(`https://www.shaadishopping.com${path}`, { method: path.startsWith('/api') ? 'POST' : 'GET' });
const proxyAllows = async (token: typeof laptop) => {
  currentToken = token;
  return (await proxy(req('/admin/crm'))).headers.get('location') === null;
};

beforeEach(() => {
  users.clear();
  users.set('admin-1', 0);
  users.set('admin-2', 0);
  fail = false;
  currentToken = null;
});

describe('logout on one device logs the user out everywhere', () => {
  test('before logout, both devices are signed in (APIs and pages)', async () => {
    currentToken = laptop;
    expect(await getSession()).not.toBeNull();
    currentToken = phone;
    expect(await requireRole(['SUPER_ADMIN'] as never)).not.toBeNull();
    expect(await proxyAllows(laptop)).toBe(true);
  });

  test('logging out on the laptop ends the phone session too — API calls and admin pages', async () => {
    currentToken = laptop;
    const res = await logoutEverywhere(req('/api/admin/logout'));
    expect(await res.json()).toEqual({ success: true, everywhere: true });

    currentToken = phone;
    expect(await getSession()).toBeNull();
    expect(await requireRole(['SUPER_ADMIN'] as never)).toBeNull();
    expect(await proxyAllows(phone)).toBe(false);
    expect(await proxyAllows(laptop)).toBe(false);
  });

  test('only that user is logged out — another admin stays signed in', async () => {
    currentToken = laptop;
    await logoutEverywhere(req('/api/admin/logout'));
    currentToken = otherAdmin;
    expect(await getSession()).not.toBeNull();
    expect(await proxyAllows(otherAdmin)).toBe(true);
  });

  test('logout always clears this browser\'s cookie, even if ending other sessions fails', async () => {
    fail = true;
    currentToken = laptop;
    const res = await logoutEverywhere(req('/api/admin/logout'));
    expect(await res.json()).toEqual({ success: true, everywhere: false });
    const cleared = res.headers.getSetCookie().join('\n');
    expect(cleared).toContain('next-auth.session-token=;');
    expect(cleared).toContain('__Secure-next-auth.session-token=;');
  });

  test('logout without a session still succeeds (just clears the cookie)', async () => {
    const res = await logoutEverywhere(req('/api/admin/logout'));
    expect(await res.json()).toEqual({ success: true, everywhere: false });
  });
});

describe('stale tokens are rejected', () => {
  test('a token whose user no longer exists (the "ActivityLog not found" case) is treated as logged out', async () => {
    const ghost = { sub: 'user-from-deleted-db', sv: 0, roles: ['SUPER_ADMIN'] };
    currentToken = ghost;
    expect(await getSession()).toBeNull();
    expect(await proxyAllows(ghost)).toBe(false);
  });

  test('a token issued before versions existed (no sv) must log in again', async () => {
    const old = { sub: 'admin-1', roles: ['SUPER_ADMIN'] } as unknown as typeof laptop;
    currentToken = old;
    expect(await getSession()).toBeNull();
    expect(await proxyAllows(old)).toBe(false);
  });

  test('public pages are never affected', async () => {
    currentToken = null;
    expect((await proxy(req('/cities/patna'))).headers.get('location')).toBeNull();
  });
});

describe('Vendor OS pages (incl. the Vendor Proposal View) only let vendors in', () => {
  const vendorPath = '/vendor/proposals/00000000-0000-4000-8000-000000000001';
  const redirectOf = async (token: { sub?: string; sv?: number; roles: string[] } | null) => {
    currentToken = token;
    return (await proxy(req(vendorPath))).headers.get('location');
  };

  test('logged out → vendor login', async () => {
    expect(await redirectOf(null)).toBe('https://www.shaadishopping.com/vendor/login');
  });

  test('an admin or a customer is not a vendor → vendor login', async () => {
    expect(await redirectOf(laptop)).toBe('https://www.shaadishopping.com/vendor/login');
    users.set('customer-1', 0);
    expect(await redirectOf({ sub: 'customer-1', sv: 0, roles: ['CUSTOMER'] })).toBe('https://www.shaadishopping.com/vendor/login');
  });

  test('a signed-in vendor gets through (the page itself then checks their vendor profile)', async () => {
    users.set('vendor-user-1', 0);
    expect(await redirectOf({ sub: 'vendor-user-1', sv: 0, roles: ['VENDOR'] })).toBeNull();
  });
});
