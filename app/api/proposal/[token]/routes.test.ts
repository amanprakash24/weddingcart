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
const requestEvent = mock(async () => ({ recorded: true as const }));
const submitPayment = mock(async (token: string, raw: unknown, proof: unknown) => (void token, void raw, void proof, { submitted: true as const, payments: { received: 0 } }));
const submitReview = mock(async (token: string, bookingId: unknown, raw: unknown) => (void token, void bookingId, void raw, { submitted: true as const, reviews: { items: [] } }));
mock.module('@/services/proposal.service', () => ({ proposalService: { accept, requestChanges, requestEvent, submitPayment, submitReview } }));

const { POST: acceptRoute } = await import('./accept/route');
const { POST: changesRoute } = await import('./request-changes/route');
const { POST: addEventRoute } = await import('./add-event/route');
const { POST: paymentsRoute } = await import('./payments/route');
const { POST: reviewsRoute } = await import('./reviews/route');

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
  requestEvent.mockClear();
  requestEvent.mockImplementation(async () => ({ recorded: true as const }));
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

describe('POST /api/proposal/[token]/payments (Roadmap 1.3)', () => {
  const form = (fields: Record<string, string | Blob>, fixedIp?: string) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    return new NextRequest(`https://www.shaadishopping.com/api/proposal/${TOKEN}/payments`, { method: 'POST', headers: { 'x-forwarded-for': fixedIp ?? `10.1.0.${++ip}` }, body: fd });
  };

  test('passes the claim and the screenshot to the service; answers with the fresh payments view', async () => {
    const res = await paymentsRoute(form({ amount: '50000', utr: '412345678901', paidOn: '2026-10-02', proof: new File([new Uint8Array([1, 2, 3])], 'p.jpg', { type: 'image/jpeg' }) }), ctx);
    expect(res.status).toBe(201);
    expect((await res.json()).data).toEqual({ payments: { received: 0 } });
    const [token, raw, proof] = submitPayment.mock.calls.at(-1) as unknown as [string, Record<string, unknown>, { type: string; size: number; bytes: Buffer }];
    expect(token).toBe(TOKEN);
    expect(raw).toEqual({ amount: '50000', utr: '412345678901', paidOn: '2026-10-02', note: undefined });
    expect(proof).toMatchObject({ type: 'image/jpeg', size: 3 });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  test('no screenshot is fine', async () => {
    await paymentsRoute(form({ amount: '1000', utr: '412345678901' }), ctx);
    expect((submitPayment.mock.calls.at(-1) as unknown as unknown[])[2]).toBeNull();
  });

  test('service refusals keep their message; invalid links get the generic 404', async () => {
    submitPayment.mockImplementationOnce(async () => { throw new ValidationError('Enter the UTR'); });
    expect((await paymentsRoute(form({ amount: '1', utr: '' }), ctx)).status).toBe(400);
    submitPayment.mockImplementationOnce(async () => { throw new ConflictError('Please accept the quotation before paying'); });
    expect((await paymentsRoute(form({ amount: '1', utr: 'x' }), ctx)).status).toBe(409);
    submitPayment.mockImplementationOnce(async () => { throw new NotFoundError('Proposal', 'link'); });
    const res = await paymentsRoute(form({ amount: '1', utr: 'x' }), ctx);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('This link is no longer valid');
  });

  test('an oversized body is refused before it is read', async () => {
    const req = form({ amount: '1', utr: 'x' });
    req.headers.set('content-length', String(10 * 1024 * 1024));
    expect((await paymentsRoute(req, ctx)).status).toBe(413);
  });

  test('shares the per-IP limit with the other proposal actions', async () => {
    for (let i = 0; i < 10; i++) await paymentsRoute(form({ amount: '1', utr: 'x' }, '10.9.9.9'), ctx);
    expect((await paymentsRoute(form({ amount: '1', utr: 'x' }, '10.9.9.9'), ctx)).status).toBe(429);
  });
});

describe('POST /api/proposal/[token]/reviews (Roadmap 1.4)', () => {
  test('passes the booking and the review to the service; answers with the fresh reviews view', async () => {
    const res = await reviewsRoute(post({ bookingId: 'vb1', rating: 5, comment: 'Lovely', authorName: 'Riya', extra: 'ignored' }), ctx);
    expect(res.status).toBe(201);
    expect((await res.json()).data).toEqual({ reviews: { items: [] } });
    expect(submitReview).toHaveBeenLastCalledWith(TOKEN, 'vb1', { rating: 5, comment: 'Lovely', authorName: 'Riya' });
  });

  test('refusals keep their message; invalid links get the generic 404', async () => {
    submitReview.mockImplementationOnce(async () => { throw new ConflictError('Reviews open once your wedding is completed'); });
    const res = await reviewsRoute(post({ bookingId: 'vb1', rating: 5 }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('Reviews open once your wedding is completed');
    submitReview.mockImplementationOnce(async () => { throw new NotFoundError('Vendor booking', 'vb9'); });
    const nf = await reviewsRoute(post({ bookingId: 'vb9', rating: 5 }), ctx);
    expect(nf.status).toBe(404);
    expect((await nf.json()).error).toBe('This link is no longer valid');
  });

  test('shares the per-IP limit', async () => {
    for (let i = 0; i < 10; i++) await reviewsRoute(post({ bookingId: 'vb1', rating: 5 }, '10.8.8.8'), ctx);
    expect((await reviewsRoute(post({ bookingId: 'vb1', rating: 5 }, '10.8.8.8'), ctx)).status).toBe(429);
  });
});

describe('POST /api/proposal/[token]/add-event', () => {
  test('hands the token and the body to the service; the answer is never cached or indexed', async () => {
    const body = { function: 'HALDI', offeringIds: ['o1'], note: 'About 150 guests' };
    const res = await addEventRoute(post(body), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(requestEvent).toHaveBeenCalledWith(TOKEN, body);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-robots-tag')).toContain('noindex');
  });

  test('a refused request → 400 with its sentence; a dead link → the one generic 404; a closed proposal → 409', async () => {
    requestEvent.mockImplementation(async () => { throw new ValidationError('Choose the function you would like to add'); });
    const bad = await addEventRoute(post({}), ctx);
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe('Choose the function you would like to add');
    requestEvent.mockImplementation(async () => { throw new NotFoundError('Proposal', 'link'); });
    const gone = await addEventRoute(post({ function: 'HALDI' }), ctx);
    expect(gone.status).toBe(404);
    expect((await gone.json()).error).toBe('This link is no longer valid');
    requestEvent.mockImplementation(async () => { throw new ConflictError('This proposal has expired'); });
    expect((await addEventRoute(post({ function: 'HALDI' }), ctx)).status).toBe(409);
  });

  test('shares the same per-IP limit, checked before the service is called', async () => {
    for (let i = 0; i < 10; i++) await addEventRoute(post({ function: 'HALDI' }, '8.8.4.4'), ctx);
    requestEvent.mockClear();
    expect((await addEventRoute(post({ function: 'HALDI' }, '8.8.4.4'), ctx)).status).toBe(429);
    expect(requestEvent).not.toHaveBeenCalled();
  });
});
