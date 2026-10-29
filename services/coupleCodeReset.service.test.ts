/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';

// "Forgot your code?" for couples (services/coupleCodeReset.service.ts). A fake database and a fake WhatsApp; nothing real is touched.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createCoupleCodeResetService } = await import('./coupleCodeReset.service');

type Login = { id: string; loginCodeHash: string | null; roles: { role: string }[]; _count: { businessMemberships: number } };
const couple = (over: Partial<Login> = {}): Login => ({ id: 'u-couple', loginCodeHash: 'hash:old', roles: [{ role: 'CUSTOMER' }], _count: { businessMemberships: 0 }, ...over });
const MOBILE = '9876543210';
const NOW = new Date('2026-10-29T10:00:00Z');

function setup(opts: { login?: Login | null; otpOk?: boolean; waiting?: boolean; sendOk?: boolean; devCode?: string; locked?: boolean } = {}) {
  const updates: unknown[] = [];
  const attempts: { identifier: string; success: boolean }[] = [];
  const db = {
    user: {
      findUnique: mock(async () => (opts.login === undefined ? couple() : opts.login)),
      update: mock(async (args: unknown) => { updates.push(args); return {}; }),
    },
  };
  const send = mock(async () => (opts.sendOk === false ? { ok: false as const, status: 500, message: 'down' } : { ok: true as const, ...(opts.devCode ? { devCode: opts.devCode } : {}) }));
  const service = createCoupleCodeResetService({
    db: db as never,
    requestCode: mock(async () => (opts.waiting ? { waitSeconds: 40 } : { code: '305917' })),
    verifyCode: mock(async () => opts.otpOk ?? true),
    send,
    isLocked: mock(async () => !!opts.locked),
    record: mock(async (identifier: string, success: boolean) => { attempts.push({ identifier, success }); }) as never,
    hash: async (c) => `hash:${c}`,
    now: () => NOW,
  });
  return { service, db, send, updates, attempts };
}

describe('step 1 — the WhatsApp code', () => {
  test('a couple sign-in gets the code on WhatsApp', async () => {
    const { service, send } = setup();
    expect(await service.send('+91 98765 43210')).toEqual({ sent: true });
    expect(send).toHaveBeenCalledWith(MOBILE, '305917');
  });

  test('a number with no sign-in gets the same answer, and no WhatsApp message (it costs money)', async () => {
    const { service, send } = setup({ login: null });
    expect(await service.send(MOBILE)).toEqual({ sent: true });
    expect(send).not.toHaveBeenCalled();
  });

  test('a vendor or team sign-in is never reset here — same answer, nothing sent', async () => {
    for (const login of [couple({ roles: [{ role: 'CUSTOMER' }, { role: 'VENDOR' }] }), couple({ _count: { businessMemberships: 1 } }), couple({ roles: [] })]) {
      const { service, send } = setup({ login });
      expect(await service.send(MOBILE)).toEqual({ sent: true });
      expect(send).not.toHaveBeenCalled();
    }
  });

  test('within a minute of the last code, nothing new is sent (the first code still works)', async () => {
    const { service, send } = setup({ waiting: true });
    expect(await service.send(MOBILE)).toEqual({ sent: true });
    expect(send).not.toHaveBeenCalled();
  });

  test('a bad number is explained; on a computer without WhatsApp the code comes back for testing', async () => {
    expect(await setup().service.send('12345')).toEqual({ errors: { mobile: expect.any(String) } });
    expect(await setup({ devCode: '305917' }).service.send(MOBILE)).toEqual({ sent: true, devCode: '305917' });
  });

  test('WhatsApp failing is an error, not a silent "sent"', async () => {
    await expect(setup({ sendOk: false }).service.send(MOBILE)).rejects.toThrow();
  });
});

describe('step 2 — the new code', () => {
  const input = { mobile: MOBILE, otp: '305917', next: '730519', confirm: '730519' };

  test('the right WhatsApp code saves the new code: signed out everywhere, reminder gone', async () => {
    const { service, updates, attempts } = setup();
    expect(await service.confirm(input)).toEqual({ done: true });
    expect(updates).toEqual([{ where: { id: 'u-couple' }, data: { loginCodeHash: 'hash:730519', loginCodeSetAt: NOW, loginCodeGiven: false, sessionVersion: { increment: 1 } } }]);
    expect(attempts).toEqual([{ identifier: `couple-reset:${MOBILE}`, success: true }]);
  });

  test('a wrong or expired WhatsApp code changes nothing and is counted', async () => {
    const { service, updates, attempts } = setup({ otpOk: false });
    expect(await service.confirm(input)).toEqual({ errors: { otp: expect.any(String) } });
    expect(updates).toEqual([]);
    expect(attempts).toEqual([{ identifier: `couple-reset:${MOBILE}`, success: false }]);
  });

  test('a number with no couple sign-in looks exactly like a wrong code', async () => {
    const { service, updates } = setup({ login: null });
    expect(await service.confirm(input)).toEqual({ errors: { otp: expect.any(String) } });
    expect(updates).toEqual([]);
  });

  test('after 5 wrong tries it is paused — even with the right code', async () => {
    const { service, updates } = setup({ locked: true });
    await expect(service.confirm(input)).rejects.toThrow();
    expect(updates).toEqual([]);
  });

  test('a guessable, short or mismatched new code is explained before anything is checked', async () => {
    const { service, db, attempts } = setup();
    expect(await service.confirm({ ...input, next: '123456', confirm: '123456' })).toEqual({ errors: { next: expect.any(String) } });
    expect(await service.confirm({ ...input, next: '7305', confirm: '7305' })).toEqual({ errors: { next: expect.any(String) } });
    expect(await service.confirm({ ...input, confirm: '730518' })).toEqual({ errors: { confirm: expect.any(String) } });
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(attempts).toEqual([]);
  });
});
