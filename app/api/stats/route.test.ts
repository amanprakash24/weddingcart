/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { Role } from '@/lib/auth/roles';

// /api/stats feeds the old admin dashboard. Its total booking revenue is company-wide money: only the founder's request asks
// for it (21 Nov 2026). Counts stay for every internal role. Session and service are mocked.
type Session = { user: { id: string; roles: Role[] } } | null;
const session = { current: null as Session };
const get = mock(async (opts: { includeRevenue: boolean }) => ({ leads: 3, revenue: opts.includeRevenue ? 100 : null }));
mock.module('@/lib/auth/session', () => ({ getSession: mock(async () => session.current), requireRole: mock(async () => session.current) }));
mock.module('@/services/stats.service', () => ({ statsService: { get } }));
const { GET } = await import('./route');

const call = () => (GET as unknown as (...a: unknown[]) => Promise<Response>)();
const as = (...roles: Role[]) => {
  session.current = { user: { id: 'u1', roles } };
};

beforeEach(() => {
  session.current = null;
  get.mockClear();
});

describe('GET /api/stats', () => {
  test('not signed in → 401', async () => {
    expect((await call()).status).toBe(401);
    expect(get).not.toHaveBeenCalled();
  });

  test('founder → revenue included', async () => {
    as(Role.SUPER_ADMIN);
    const res = await call();
    expect(get.mock.calls[0][0]).toEqual({ includeRevenue: true });
    expect((await res.json()).data.revenue).toBe(100);
  });

  test.each([[Role.SALES], [Role.OPERATIONS]])('%s → counts only, revenue null', async (role) => {
    as(role);
    const res = await call();
    expect(get.mock.calls[0][0]).toEqual({ includeRevenue: false });
    const { data } = await res.json();
    expect(data.revenue).toBeNull();
    expect(data.leads).toBe(3);
  });
});
