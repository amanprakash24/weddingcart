/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { NextRequest } from 'next/server';

// Production-readiness audit (2026-09-17) — POST /api/otp/send is public,
// unauthenticated, and the only trigger for a real, billable WhatsApp
// Business API send, with no IP-based throttle before this fix (only a
// 60s-per-phone cooldown, which does nothing to stop one IP from iterating
// across many different phone numbers). Mirrors app/api/consultations
// /route.test.ts's exact rate-limit test pattern: mocks `@/lib/prisma`'s
// loginAttempt model (letting the real isRequestRateLimited/recordRequest
// run against it) and `@/services/otp.service` (so this exercises the
// route's own gating logic without touching a DB or sending a real WhatsApp
// message — WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_ACCESS_TOKEN aren't loaded
// under `bun test`, so the route naturally takes its dev-mode branch).
function makeLoginAttemptStore() {
  const rows: { identifier: string; success: boolean; createdAt: Date }[] = [];
  return {
    count: mock(async (args: { where: { identifier: string; createdAt: { gt: Date } } }) => {
      const { identifier, createdAt } = args.where;
      return rows.filter((r) => r.identifier === identifier && r.createdAt.getTime() > createdAt.gt.getTime()).length;
    }),
    create: mock(async (args: { data: { identifier: string; success: boolean } }) => {
      const row = { ...args.data, createdAt: new Date() };
      rows.push(row);
      return row;
    }),
  };
}

function postRequest(body: unknown, ip: string) {
  return new NextRequest('http://localhost/api/otp/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

async function loadRouteWith(
  loginAttemptStore: ReturnType<typeof makeLoginAttemptStore>,
  requestCode: ReturnType<typeof mock> = mock(async () => ({ code: '123456' }))
) {
  mock.module('@/lib/prisma', () => ({ prisma: { loginAttempt: loginAttemptStore } }));
  mock.module('@/services/otp.service', () => ({ otpService: { requestCode } }));
  return import('./route');
}

describe('POST /api/otp/send — rate limiting (production-integrity fix)', () => {
  test('allows requests under the threshold, then rejects with 429 once exceeded', async () => {
    const store = makeLoginAttemptStore();
    const { POST } = await loadRouteWith(store);

    for (let i = 0; i < 5; i++) {
      const res = await POST(postRequest({ phone: '9876543210' }, '1.2.3.4'));
      expect(res.status).toBe(200);
    }
    const blocked = await POST(postRequest({ phone: '9876543210' }, '1.2.3.4'));
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.success).toBe(false);
  });

  test('does not let one IP exhaust the limit for another IP', async () => {
    const store = makeLoginAttemptStore();
    const { POST } = await loadRouteWith(store);

    for (let i = 0; i < 5; i++) {
      await POST(postRequest({ phone: '9876543210' }, '1.2.3.4'));
    }
    expect((await POST(postRequest({ phone: '9876543210' }, '1.2.3.4'))).status).toBe(429);
    expect((await POST(postRequest({ phone: '1112223334' }, '9.9.9.9'))).status).toBe(200);
  });

  test('one IP is throttled the same way regardless of which phone number it targets — the actual abuse scenario this closes', async () => {
    const store = makeLoginAttemptStore();
    const requestCode = mock(async () => ({ code: '123456' }));
    const { POST } = await loadRouteWith(store, requestCode);

    // Five requests from the same IP, each a different phone number — the
    // old per-phone-only cooldown would have let every one of these through.
    for (let i = 0; i < 5; i++) {
      const res = await POST(postRequest({ phone: `98765${String(i).padStart(5, '0')}` }, '1.2.3.4'));
      expect(res.status).toBe(200);
    }
    const sixth = await POST(postRequest({ phone: '9876500005' }, '1.2.3.4'));
    expect(sixth.status).toBe(429);
    expect(requestCode).toHaveBeenCalledTimes(5);
  });

  test('an invalid phone number still consumes a rate-limit slot (checked before validation) — matches the sibling routes convention', async () => {
    const store = makeLoginAttemptStore();
    const requestCode = mock(async () => ({ code: '123456' }));
    const { POST } = await loadRouteWith(store, requestCode);

    const res = await POST(postRequest({ phone: 'not-a-phone' }, '1.2.3.4'));
    expect(res.status).toBe(400);
    expect(requestCode).not.toHaveBeenCalled();

    // The rate limiter still recorded this attempt, per the route's ordering.
    for (let i = 0; i < 4; i++) {
      await POST(postRequest({ phone: '9876543210' }, '1.2.3.4'));
    }
    expect((await POST(postRequest({ phone: '9876543210' }, '1.2.3.4'))).status).toBe(429);
  });
});
