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

describe('POST /api/otp/send — WhatsApp authentication template', () => {
  const WA_ENV = ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_OTP_TEMPLATE', 'WHATSAPP_OTP_TEMPLATE_LANGUAGE'] as const;

  async function withWhatsAppEnv(
    env: Partial<Record<(typeof WA_ENV)[number], string>>,
    fetchImpl: () => Promise<Response>,
    run: (calls: { url: string; init: RequestInit }[]) => Promise<void>
  ) {
    const saved = Object.fromEntries(WA_ENV.map((k) => [k, process.env[k]]));
    const savedFetch = globalThis.fetch;
    const calls: { url: string; init: RequestInit }[] = [];
    WA_ENV.forEach((k) => delete process.env[k]);
    Object.assign(process.env, env);
    globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return fetchImpl();
    }) as unknown as typeof fetch;
    try {
      await run(calls);
    } finally {
      globalThis.fetch = savedFetch;
      WA_ENV.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])));
    }
  }

  const configured = { WHATSAPP_PHONE_NUMBER_ID: 'phone-id', WHATSAPP_ACCESS_TOKEN: 'token', WHATSAPP_OTP_TEMPLATE: 'otp_login' };
  const ok = async () => new Response(JSON.stringify({ messages: [{ id: 'wamid.1' }] }), { status: 200 });

  test('sends the code as an authentication template — in the body and the copy-code button — never as free-form text', async () => {
    const { POST } = await loadRouteWith(makeLoginAttemptStore(), mock(async () => ({ code: '482913' })));
    await withWhatsAppEnv(configured, ok, async (calls) => {
      const res = await POST(postRequest({ phone: '9876543210' }, '5.5.5.1'));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });

      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe('https://graph.facebook.com/v22.0/phone-id/messages');
      expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer token');
      expect(JSON.parse(String(calls[0].init.body))).toEqual({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '919876543210',
        type: 'template',
        template: {
          name: 'otp_login',
          language: { code: 'en_US' },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: '482913' }] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: '482913' }] },
          ],
        },
      });
    });
  });

  test('uses WHATSAPP_OTP_TEMPLATE_LANGUAGE when set', async () => {
    const { POST } = await loadRouteWith(makeLoginAttemptStore());
    await withWhatsAppEnv({ ...configured, WHATSAPP_OTP_TEMPLATE_LANGUAGE: 'en' }, ok, async (calls) => {
      await POST(postRequest({ phone: '9876543210' }, '5.5.5.2'));
      expect(JSON.parse(String(calls[0].init.body)).template.language).toEqual({ code: 'en' });
    });
  });

  test('without a template name it does not call WhatsApp (no free-form fallback)', async () => {
    const { POST } = await loadRouteWith(makeLoginAttemptStore());
    const noTemplate = { WHATSAPP_PHONE_NUMBER_ID: 'phone-id', WHATSAPP_ACCESS_TOKEN: 'token' };
    await withWhatsAppEnv(noTemplate, ok, async (calls) => {
      const res = await POST(postRequest({ phone: '9876543210' }, '5.5.5.3'));
      // Under `bun test` NODE_ENV is not production, so this is the dev branch; production returns 500 instead.
      expect(res.status).toBe(200);
      expect(calls).toHaveLength(0);
    });
  });

  test('a Meta API error is passed back as a 500 with Meta\'s message', async () => {
    const { POST } = await loadRouteWith(makeLoginAttemptStore());
    const metaError = async () =>
      new Response(JSON.stringify({ error: { message: 'Template name does not exist in the translation' } }), { status: 404 });
    await withWhatsAppEnv(configured, metaError, async () => {
      const res = await POST(postRequest({ phone: '9876543210' }, '5.5.5.4'));
      expect(res.status).toBe(500);
      expect((await res.json()).message).toBe('Template name does not exist in the translation');
    });
  });
});

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
