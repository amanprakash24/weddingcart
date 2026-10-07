/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { ConflictError } from '@/lib/errors';

// The vendor's own login-code routes and the admin's "new code" route. The service is faked (its own tests cover the rules);
// what is checked here is who may call, that the user always comes from the session, and what leaves the server.
let session: { user: { id: string } } | null = { user: { id: 'u1' } };
// Who is signed in to the Command Center, for the "new code" route: the founder by default.
let adminRoles: string[] | null = ['SUPER_ADMIN'];
const status = mock(async () => ({ hasCode: true, setAt: new Date('2026-09-01T00:00:00Z'), reminder: true }));
const change = mock(async (): Promise<{ changed: true } | { errors: Record<string, string> }> => ({ changed: true }));
const issue = mock(async () => ({ code: '730518', mobile: '9876543210' }));

mock.module('@/lib/prisma', () => ({ prisma: {} }));
mock.module('@/lib/auth/session', () => ({
  requireRole: mock(async () => session),
  getSession: mock(async () => (adminRoles ? { user: { id: 'admin-1', roles: adminRoles } } : null)),
}));
// The real wrapper resolves the vendor's business from the database; here it only passes the call through.
mock.module('@/lib/ownership/venueEntry', () => ({ MEMBER: 'member', venueScoped: <A extends unknown[], R>(fn: (...args: A) => Promise<R>) => fn }));
mock.module('@/services/vendorLoginCode.service', () => ({ vendorLoginCodeService: { status, change, issue } }));

const { GET, POST } = await import('./route');
const { POST: issueRoute } = await import('../../vendors/[id]/login-code/route');

const post = (body: unknown) => new NextRequest('https://www.shaadishopping.com/api/vendor-os/login-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => {
  session = { user: { id: 'u1' } };
  adminRoles = ['SUPER_ADMIN'];
  for (const m of [status, change, issue]) m.mockClear();
  change.mockImplementation(async () => ({ changed: true }));
});

describe('GET /api/vendor-os/login-code', () => {
  test('answers for the logged-in vendor only, never cached, and never includes a code or a hash', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { hasCode: true, setAt: '2026-09-01T00:00:00.000Z', reminder: true } });
    expect(status).toHaveBeenCalledWith('u1');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  test('not logged in as a vendor → 401, and nothing is read', async () => {
    session = null;
    expect((await GET()).status).toBe(401);
    expect(status).not.toHaveBeenCalled();
  });
});

describe('POST /api/vendor-os/login-code', () => {
  test('changes the code of the session’s user — an id in the request is ignored', async () => {
    const res = await POST(post({ current: '482913', next: '730518', confirm: '730518', userId: 'someone-else' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(change).toHaveBeenCalledWith('u1', { current: '482913', next: '730518', confirm: '730518' });
  });

  test('a refused change → 400 with a sentence per box', async () => {
    change.mockImplementation(async () => ({ errors: { current: 'That is not your current code' } }));
    const res = await POST(post({ current: '000417', next: '730518', confirm: '730518' }));
    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors).toEqual({ current: 'That is not your current code' });
  });

  test('paused after too many wrong tries → 409 with the reason', async () => {
    change.mockImplementation(async () => { throw new ConflictError('Too many wrong tries — please wait 15 minutes and try again'); });
    const res = await POST(post({ current: '482913', next: '730518', confirm: '730518' }));
    expect(res.status).toBe(409);
  });

  test('not logged in as a vendor → 401, and nothing is changed', async () => {
    session = null;
    expect((await POST(post({ current: '482913', next: '730518', confirm: '730518' }))).status).toBe(401);
    expect(change).not.toHaveBeenCalled();
  });
});

describe('POST /api/vendors/[id]/login-code — the founder makes a new code', () => {
  const ctx = { params: Promise.resolve({ id: 'v1' }) };
  const req = () => new NextRequest('https://www.shaadishopping.com/api/vendors/v1/login-code', { method: 'POST' });

  test('the founder gets the code once, never cached', async () => {
    const res = await issueRoute(req(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, loginCode: '730518', mobile: '9876543210' });
    expect(issue).toHaveBeenCalledWith('v1');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  test('not signed in → 401, and no code is made', async () => {
    adminRoles = null;
    expect((await issueRoute(req(), ctx)).status).toBe(401);
    expect(issue).not.toHaveBeenCalled();
  });

  // A new code is a way to sign in AS that vendor — so the rest of the team, and of course vendors themselves, may not make one.
  test('sales, operations, a vendor → 403, and no code is made', async () => {
    for (const roles of [['SALES'], ['OPERATIONS'], ['SALES', 'OPERATIONS'], ['VENDOR'], ['CUSTOMER'], []]) {
      adminRoles = roles;
      expect((await issueRoute(req(), ctx)).status).toBe(403);
    }
    expect(issue).not.toHaveBeenCalled();
  });

  test('a login that is also on the internal team is refused by the service → 409, no code leaves', async () => {
    issue.mockImplementationOnce(async () => { throw new ConflictError('This login also belongs to a member of the Shaadi Shopping team.'); });
    const res = await issueRoute(req(), ctx);
    expect(res.status).toBe(409);
    expect(JSON.stringify(await res.json())).not.toContain('730518');
  });
});
