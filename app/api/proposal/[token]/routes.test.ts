/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';

// Public proposal routes. The service is faked (its own tests cover the logic); the REAL rate limiter runs against an
// in-memory login_attempts table — the same pattern as app/api/otp/send/route.test.ts. Nothing touches a database.
const rows: { identifier: string; success: boolean; createdAt: Date }[] = [];
mock.module('@/lib/prisma', () => ({
  prisma: {
    // The proposal entry asks whose quotation a token is (lib/quotation/proposalEntry.ts); none here → runs as Shaadi Shopping.
    quotation: { findFirst: mock(async () => null) },
    loginAttempt: {
      count: mock(async (a: { where: { identifier: string; createdAt: { gt: Date } } }) =>
        rows.filter((r) => r.identifier === a.where.identifier && r.createdAt > a.where.createdAt.gt).length),
      create: mock(async (a: { data: { identifier: string; success: boolean } }) => rows.push({ ...a.data, createdAt: new Date() })),
    },
  },
}));
const accept = mock(async () => ({ state: 'ACCEPTED' as const, bookingCreated: true, alreadyAccepted: false }));
const requestChanges = mock(async () => ({ recorded: true as const }));
mock.module('@/services/proposal.service', () => ({ proposalService: { accept, requestChanges } }));

const { POST: acceptRoute } = await import('./accept/route');
const { POST: changesRoute } = await import('./request-changes/route');

const TOKEN = 'A'.repeat(43);
const ctx = { params: Promise.resolve({ token: TOKEN }) };
let ip = 0;
const post = (body: unknown, fixedIp?: string) =>
  new NextRequest(`https://www.shaadishopping.com/api/proposal/${TOKEN}/x`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': fixedIp ?? `10.0.0.${++ip}` },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  rows.length = 0;
  accept.mockClear();
  requestChanges.mockClear();
  accept.mockImplementation(async () => ({ state: 'ACCEPTED' as const, bookingCreated: true, alreadyAccepted: false }));
  requestChanges.mockImplementation(async () => ({ recorded: true as const }));
});

describe('POST /api/proposal/[token]/accept', () => {
  test('requires the terms checkbox', async () => {
    const res = await acceptRoute(post({}), ctx);
    expect(res.status).toBe(400);
    expect(accept).not.toHaveBeenCalled();
  });

  test('accepts, and never tells the couple internal details (booking status)', async () => {
    const res = await acceptRoute(post({ agreeToTerms: true }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { state: 'ACCEPTED' } });
    expect(accept).toHaveBeenCalledWith(TOKEN);
  });

  test('responses are never cached or indexed', async () => {
    const res = await acceptRoute(post({ agreeToTerms: true }), ctx);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  test('any invalid link → the same generic 404, never saying why', async () => {
    accept.mockImplementation(async () => { throw new NotFoundError('Proposal', 'link'); });
    const res = await acceptRoute(post({ agreeToTerms: true }), ctx);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ success: false, error: 'This link is no longer valid' });
  });

  test('expired → 409 with the reason', async () => {
    accept.mockImplementation(async () => { throw new ConflictError('This proposal has expired'); });
    const res = await acceptRoute(post({ agreeToTerms: true }), ctx);
    expect(res.status).toBe(409);
  });

  test('an unexpected failure is a generic 500 (no internal message leaked)', async () => {
    accept.mockImplementation(async () => { throw new Error('connection to db-host refused'); });
    const res = await acceptRoute(post({ agreeToTerms: true }), ctx);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('db-host');
  });

  test('rate-limited per IP (10 per 15 minutes), checked before the link is looked at', async () => {
    for (let i = 0; i < 10; i++) expect((await acceptRoute(post({ agreeToTerms: true }, '9.9.9.9'), ctx)).status).toBe(200);
    const blocked = await acceptRoute(post({ agreeToTerms: true }, '9.9.9.9'), ctx);
    expect(blocked.status).toBe(429);
    expect(accept).toHaveBeenCalledTimes(10);
    expect((await acceptRoute(post({ agreeToTerms: true }, '8.8.8.8'), ctx)).status).toBe(200); // another IP unaffected
  });
});

describe('POST /api/proposal/[token]/request-changes', () => {
  test('passes the note to the service', async () => {
    const res = await changesRoute(post({ note: 'Reduce decoration' }), ctx);
    expect(res.status).toBe(200);
    expect(requestChanges).toHaveBeenCalledWith(TOKEN, 'Reduce decoration');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  test('a bad note → 400 with the service message', async () => {
    requestChanges.mockImplementation(async () => { throw new ValidationError('Tell us what you would like to change'); });
    const res = await changesRoute(post({ note: '' }), ctx);
    expect(res.status).toBe(400);
  });

  test('invalid link → generic 404', async () => {
    requestChanges.mockImplementation(async () => { throw new NotFoundError('Proposal', 'link'); });
    const res = await changesRoute(post({ note: 'x' }), ctx);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('This link is no longer valid');
  });

  test('shares the same per-IP limit as accept', async () => {
    for (let i = 0; i < 10; i++) await changesRoute(post({ note: 'x' }, '7.7.7.7'), ctx);
    expect((await changesRoute(post({ note: 'x' }, '7.7.7.7'), ctx)).status).toBe(429);
  });
});
