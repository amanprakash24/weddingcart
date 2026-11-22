/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { Role } from '@/lib/auth/roles';

// Founder-only company financials (21 Nov 2026): every internal role still opens Today, but only the founder's request asks
// the service for revenue, commission and the finance block. Session and service are mocked; the service's own
// includeFinancials behaviour is covered in services/commandCenter.service.test.ts.
type Session = { user: { id: string; roles: Role[] } } | null;
const session = { current: null as Session };
const requireRole = mock(async (allowed: Role[]) =>
  session.current && session.current.user.roles.some((r) => allowed.includes(r)) ? session.current : null
);
const getDashboard = mock(async (_date: Date, opts: { includeFinancials: boolean }) => ({
  revenue: opts.includeFinancials ? { totalCollected: 1 } : null,
}));
mock.module('@/lib/auth/session', () => ({ requireRole, getSession: mock(async () => session.current) }));
mock.module('@/services/founderDashboard.service', () => ({ founderDashboardService: { getDashboard } }));
const { GET } = await import('./route');

const get = () => GET(new NextRequest('http://localhost/api/crm/founder-dashboard'));
const as = (...roles: Role[]) => {
  session.current = { user: { id: 'u1', roles } };
};

beforeEach(() => {
  session.current = null;
  getDashboard.mockClear();
});

describe('GET /api/crm/founder-dashboard', () => {
  test('not signed in → 401, nothing read', async () => {
    const res = await get();
    expect(res.status).toBe(401);
    expect(getDashboard).not.toHaveBeenCalled();
  });

  test('founder → company financials included', async () => {
    as(Role.SUPER_ADMIN);
    const res = await get();
    expect(res.status).toBe(200);
    expect(getDashboard.mock.calls[0][1]).toEqual({ includeFinancials: true });
    expect((await res.json()).data.revenue).not.toBeNull();
  });

  test.each([[Role.SALES], [Role.OPERATIONS]])('%s → Today opens, company financials left out', async (role) => {
    as(role);
    const res = await get();
    expect(res.status).toBe(200);
    expect(getDashboard.mock.calls[0][1]).toEqual({ includeFinancials: false });
    expect((await res.json()).data.revenue).toBeNull();
  });

  test('Sales + Operations together still get no company financials', async () => {
    as(Role.SALES, Role.OPERATIONS);
    await get();
    expect(getDashboard.mock.calls[0][1]).toEqual({ includeFinancials: false });
  });
});
