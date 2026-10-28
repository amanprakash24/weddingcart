/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';

// The couple's My Wedding sign-in (services/coupleLogin.service.ts). A fake database; nothing real is touched.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createCoupleLoginService } = await import('./coupleLogin.service');

type Login = { id: string; loginCodeHash: string | null; roles: { role: string }[]; _count: { businessMemberships: number } };
const couple = (over: Partial<Login> = {}): Login => ({ id: 'u-couple', loginCodeHash: 'hash', roles: [{ role: 'CUSTOMER' }], _count: { businessMemberships: 0 }, ...over });

function setup(opts: { wedding?: { customerId?: string | null; customerPhone?: string | null; bookingPhone?: string | null } | null; login?: Login | null } = {}) {
  const w = opts.wedding === null ? null : { id: 'w1', customerId: opts.wedding?.customerId ?? null, customerPhone: opts.wedding?.customerPhone === undefined ? '9876543210' : opts.wedding.customerPhone, sourceBooking: { name: 'Priya Sharma', phone: opts.wedding?.bookingPhone ?? null } };
  const db = {
    wedding: {
      findFirst: mock(async () => w),
      updateMany: mock(async ({ where }: { where: { OR: { customerId: string | null }[] } }) => ({ count: !w?.customerId || where.OR.some((o) => o.customerId === w.customerId) ? 1 : 0 })),
    },
    user: {
      findUnique: mock(async () => opts.login ?? null),
      create: mock(async () => ({ id: 'u-new' })),
    },
    userRole: { upsert: mock(async () => ({})) },
    $transaction: mock(async (fn: (tx: unknown) => unknown) => fn(db)),
  };
  const issueForUser = mock(async () => ({ code: '482916', mobile: '9876543210' }));
  const service = createCoupleLoginService({ db: db as never, hash: async (c) => `hash:${c}`, newCode: () => '715302', issueForUser, now: () => new Date('2026-10-28T10:00:00Z') });
  return { db, service, issueForUser };
}

describe('giving the couple My Wedding', () => {
  test('a number with no login: a new couple login with a new code, and this wedding linked to it', async () => {
    const { db, service } = setup();
    expect(await service.give('w1')).toEqual({ kind: 'NEW_CODE', mobile: '9876543210', code: '715302' });
    const created = (db.user.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(created).toMatchObject({ phone: '9876543210', name: 'Priya Sharma', loginCodeHash: 'hash:715302', roles: { create: { role: 'CUSTOMER' } } });
    expect((db.wedding.updateMany.mock.calls[0] as unknown as [{ data: unknown }])[0].data).toEqual({ customerId: 'u-new', customerPhone: '9876543210' });
  });

  test('a number that already has a login: linked only — its code is never replaced and no code is shown', async () => {
    const { db, service, issueForUser } = setup({ login: couple({ id: 'u-vendor', roles: [{ role: 'VENDOR' }], _count: { businessMemberships: 1 } }) });
    expect(await service.give('w1')).toEqual({ kind: 'LINKED', mobile: '9876543210', hasCode: true });
    expect(db.user.create).not.toHaveBeenCalled();
    expect(issueForUser).not.toHaveBeenCalled();
    expect(db.userRole.upsert).toHaveBeenCalled(); // the couple door is added; their own code still signs them in
  });

  test('a wedding already linked to someone else is never moved', async () => {
    const { service } = setup({ wedding: { customerId: 'u-other' }, login: couple() });
    await expect(service.give('w1')).rejects.toThrow('already linked to another sign-in');
  });

  test('no mobile on the wedding: refused', async () => {
    const { service } = setup({ wedding: { customerPhone: null } });
    await expect(service.give('w1')).rejects.toThrow('mobile number');
  });

  test('another business’s wedding (the scope hides it) is not found', async () => {
    const { service } = setup({ wedding: null });
    await expect(service.give('w1')).rejects.toThrow();
  });
});

describe('replacing a code (the founder only — checked by the route)', () => {
  test('a couple-only login: a new code, and the wedding linked', async () => {
    const { service, issueForUser } = setup({ login: couple() });
    expect(await service.replace('w1')).toEqual({ mobile: '9876543210', code: '482916' });
    expect(issueForUser).toHaveBeenCalledWith('u-couple');
  });

  test('never for a login that is also a vendor or a team member', async () => {
    for (const login of [couple({ roles: [{ role: 'CUSTOMER' }, { role: 'VENDOR' }] }), couple({ roles: [{ role: 'CUSTOMER' }, { role: 'SUPER_ADMIN' }] }), couple({ _count: { businessMemberships: 1 } })]) {
      const { service, issueForUser } = setup({ login });
      await expect(service.replace('w1')).rejects.toThrow('Only that person can change its code');
      expect(issueForUser).not.toHaveBeenCalled();
    }
  });
});

describe('status', () => {
  test('each state the wedding page shows', async () => {
    expect(await setup({ wedding: { customerPhone: null } }).service.status('w1')).toEqual({ state: 'NO_MOBILE' });
    expect(await setup().service.status('w1')).toEqual({ state: 'NOT_SET_UP', mobile: '9876543210' });
    expect(await setup({ wedding: { customerId: 'u-couple' }, login: couple() }).service.status('w1', true)).toEqual({ state: 'HAS_LOGIN', mobile: '9876543210', hasCode: true, linked: true, canReplace: true });
    expect(await setup({ login: couple() }).service.status('w1')).toEqual({ state: 'HAS_LOGIN', mobile: '9876543210', hasCode: true, linked: false, canReplace: false });
    expect(await setup({ wedding: { customerId: 'u-other' }, login: couple() }).service.status('w1', true)).toEqual({ state: 'OTHER_LOGIN', mobile: '9876543210' });
  });

  test('falls back to the booking’s phone when the wedding has none stored', async () => {
    expect(await setup({ wedding: { customerPhone: null, bookingPhone: '+91 91234 56789' } }).service.status('w1')).toEqual({ state: 'NOT_SET_UP', mobile: '9123456789' });
  });
});
