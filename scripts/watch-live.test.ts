/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { CHECKS, evaluate, runCheck } from './watch-live.mjs';

const db = CHECKS.find((c) => c.path === '/api/health/db')!;
const home = CHECKS.find((c) => c.path === '/')!;
const gate = CHECKS.find((c) => c.path === '/api/vendor-os/enquiries')!;

describe('evaluate', () => {
  test('the expected answer passes', () => {
    expect(evaluate(db, { status: 200, body: '{"status":"ok"}' })).toBeNull();
    expect(evaluate(home, { status: 200, body: '<title>Shaadi Shopping</title>' })).toBeNull();
    expect(evaluate(gate, { status: 401, body: '{"success":false}' })).toBeNull();
  });

  test('the database being down fails, whatever the page says', () => {
    expect(evaluate(db, { status: 503, body: '{"status":"down"}' })).toBe('answered 503, expected 200');
    expect(evaluate(db, { status: 200, body: '{"status":"down"}' })).toBe('"status" was not "ok"');
    expect(evaluate(db, { status: 200, body: '<html>error</html>' })).toBe('did not answer with JSON');
  });

  test('a page that opens but is not ours fails', () => {
    expect(evaluate(home, { status: 200, body: '<h1>Deployment not found</h1>' })).toBe('the page did not contain "Shaadi"');
  });

  test('Vendor OS answering a signed-out request with anything but 401 fails — broken (500) or open (200)', () => {
    expect(evaluate(gate, { status: 500, body: '' })).toBe('answered 500, expected 401');
    expect(evaluate(gate, { status: 200, body: '{"success":true,"data":[]}' })).toBe('answered 200, expected 401');
  });

  test('the reason never repeats the body', () => {
    expect(evaluate(db, { status: 500, body: 'password authentication failed' })).not.toContain('password');
  });
});

describe('runCheck', () => {
  const answer = (status: number, body: string) => ({ status, text: async () => body }) as Response;

  test('passes first time', async () => {
    const out = await runCheck('https://x', db, { fetchFn: (async () => answer(200, '{"status":"ok"}')) as unknown as typeof fetch, gapMs: 0 });
    expect(out).toEqual({ name: db.name, ok: true, why: null, tries: 1 });
  });

  test('one bad answer is not an alarm: it is tried again', async () => {
    let n = 0;
    const out = await runCheck('https://x', db, { fetchFn: (async () => (++n === 1 ? answer(503, '{"status":"down"}') : answer(200, '{"status":"ok"}'))) as unknown as typeof fetch, gapMs: 0 });
    expect(out).toMatchObject({ ok: true, tries: 2 });
  });

  test('bad every time: fails with the last reason', async () => {
    const out = await runCheck('https://x', db, { fetchFn: (async () => answer(503, '{"status":"down"}')) as unknown as typeof fetch, gapMs: 0, tries: 3 });
    expect(out).toEqual({ name: db.name, ok: false, why: 'answered 503, expected 200', tries: 3 });
  });

  test('cannot connect: fails without the error text', async () => {
    const out = await runCheck('https://x', db, { fetchFn: (async () => { throw new Error('getaddrinfo ENOTFOUND secret-host'); }) as unknown as typeof fetch, gapMs: 0, tries: 2 });
    expect(out).toMatchObject({ ok: false, why: 'could not connect' });
  });

  test('asks the address it was given, signed out and without following redirects', async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    await runCheck('https://x', gate, { fetchFn: (async (url: string, init: RequestInit) => { seen = { url, init }; return answer(401, '{}'); }) as unknown as typeof fetch, gapMs: 0 });
    expect(seen!.url).toBe('https://x/api/vendor-os/enquiries');
    expect(seen!.init.redirect).toBe('manual');
    expect(JSON.stringify(seen!.init.headers)).not.toMatch(/cookie|authorization/i);
  });
});

describe('the list of checks', () => {
  test('never opens a couple’s link (that page records each visit) and never a signed-in address', () => {
    for (const c of CHECKS) expect(c.path.startsWith('/proposal')).toBe(false);
  });
});
