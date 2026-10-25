/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { NextRequest } from 'next/server';
import { makeListSiteErrors, makeReportBrowserError, makeSetSiteErrorFixed, type StaffDeps } from './handlers';
import type { CleanSiteError } from './normalize';

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest('https://www.shaadishopping.com/api/site-errors', {
    method: 'POST',
    headers: { host: 'www.shaadishopping.com', 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

function browserDeps(limited = false) {
  const saved: CleanSiteError[] = [];
  return {
    saved,
    deps: {
      isLimited: mock(async () => limited),
      recordRequest: mock(async () => {}),
      save: mock(async (e: CleanSiteError) => { saved.push(e); }),
    },
  };
}

describe('POST /api/site-errors (browser reports)', () => {
  test('a real error is cleaned and saved; the answer is 204', async () => {
    const { deps, saved } = browserDeps();
    const res = await makeReportBrowserError(deps)(post({ message: "TypeError: Cannot read properties of undefined (reading 'price')", location: '/proposal/AbCd1234EfGh5678', detail: 'at x (https://www.shaadishopping.com/_next/a.js?dpl=1:1:1)' }, { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile Safari/604.1' }));
    expect(res.status).toBe(204);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ source: 'BROWSER', location: '/proposal/:id', browser: 'Safari · iPhone' });
    expect(saved[0].detail).not.toContain('dpl=1');
    expect(deps.recordRequest).toHaveBeenCalledWith('site-error:1.2.3.4');
  });

  test('another website is refused', async () => {
    const { deps, saved } = browserDeps();
    const res = await makeReportBrowserError(deps)(post({ message: 'x', location: '/' }, { origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
    expect(saved).toHaveLength(0);
  });

  test('over the limit: 429, nothing saved', async () => {
    const { deps, saved } = browserDeps(true);
    const res = await makeReportBrowserError(deps)(post({ message: 'x', location: '/' }));
    expect(res.status).toBe(429);
    expect(saved).toHaveLength(0);
  });

  test('noise, junk or oversized bodies are dropped quietly (204)', async () => {
    const { deps, saved } = browserDeps();
    const handler = makeReportBrowserError(deps);
    expect((await handler(post({ message: 'TypeError: Failed to fetch', location: '/' }))).status).toBe(204);
    expect((await handler(post('not json'))).status).toBe(204);
    expect((await handler(post({ message: 'x'.repeat(3000), location: '/' }))).status).toBe(204);
    expect(saved).toHaveLength(0);
  });

  test('a failure to save never reaches the visitor', async () => {
    const { deps } = browserDeps();
    deps.save.mockImplementation(async () => { throw new Error('db down'); });
    const res = await makeReportBrowserError(deps)(post({ message: 'real problem', location: '/' }));
    expect(res.status).toBe(204);
  });
});

function staffDeps(signedIn: boolean): StaffDeps {
  return {
    requireAdmin: mock(async () => (signedIn ? { user: { id: 'u1' } } : null)),
    list: mock(async (status: 'open' | 'fixed') => [{ id: 'e1', status }]),
    countRecentOpen: mock(async () => 3),
    setFixed: mock(async (id: string, fixed: boolean) => ({ id, fixed })),
  };
}
const get = (q: string) => new NextRequest(`https://www.shaadishopping.com/api/admin/site-errors${q}`);

describe('staff endpoints', () => {
  test('signed-out or non-staff: 401, nothing read or changed', async () => {
    const deps = staffDeps(false);
    expect((await makeListSiteErrors(deps)(get(''))).status).toBe(401);
    const patch = new NextRequest('https://x/api/admin/site-errors/e1', { method: 'PATCH', body: JSON.stringify({ fixed: true }) });
    expect((await makeSetSiteErrorFixed(deps)(patch, { params: Promise.resolve({ id: 'e1' }) })).status).toBe(401);
    expect(deps.list).not.toHaveBeenCalled();
    expect(deps.setFixed).not.toHaveBeenCalled();
  });

  test('list open (default), fixed, and the Today number', async () => {
    const deps = staffDeps(true);
    const open = await (await makeListSiteErrors(deps)(get(''))).json();
    expect(open.data).toMatchObject({ status: 'open', recentOpen: 3 });
    const fixed = await (await makeListSiteErrors(deps)(get('?status=fixed'))).json();
    expect(fixed.data.status).toBe('fixed');
    const summary = await (await makeListSiteErrors(deps)(get('?summary=1'))).json();
    expect(summary.data).toEqual({ recentOpen: 3 });
  });

  test('mark fixed / open again; a bad body is a 400', async () => {
    const deps = staffDeps(true);
    const ok = await makeSetSiteErrorFixed(deps)(new NextRequest('https://x/a', { method: 'PATCH', body: JSON.stringify({ fixed: true }) }), { params: Promise.resolve({ id: 'e1' }) });
    expect(ok.status).toBe(200);
    expect(deps.setFixed).toHaveBeenCalledWith('e1', true);
    const bad = await makeSetSiteErrorFixed(deps)(new NextRequest('https://x/a', { method: 'PATCH', body: JSON.stringify({ fixed: 'yes' }) }), { params: Promise.resolve({ id: 'e1' }) });
    expect(bad.status).toBe(400);
  });
});
