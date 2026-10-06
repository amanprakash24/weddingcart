/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { ConflictError, NotFoundError } from '@/lib/errors';

// Every dependency is passed in as a fake (createVendorLoginCodeService) — nothing shared is mocked except '@/lib/prisma', which
// importing the service would otherwise load for real. The "hash" here is a plain marker so the tests can see what was stored.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createVendorLoginCodeService } = await import('./vendorLoginCode.service');

const NOW = new Date('2026-10-06T10:00:00Z');
const hash = async (code: string) => `hash(${code})`;
const compare = async (code: string, stored: string) => stored === `hash(${code})`;

type Profile = { id: string; userId: string; vendorId: string; loginCodeHash: string | null; loginCodeSetAt: Date | null };
type UserRow = { id: string; name: string | null; phone: string; sessionVersion: number; roles: { role: string }[] };

let users: UserRow[];
let profiles: Profile[];
let attempts: { identifier: string; success: boolean }[];
let lockedIds: Set<string>;
let nextCode: string;

const profileOf = (where: { vendorId?: string; userId?: string; id?: string }) => profiles.find((p) => (where.vendorId ? p.vendorId === where.vendorId : where.userId ? p.userId === where.userId : p.id === where.id)) ?? null;

const db = {
  user: {
    findUnique: mock(async (a: { where: { phone: string } }) => {
      const u = users.find((x) => x.phone === a.where.phone);
      return u ? { ...u, vendorProfile: profileOf({ userId: u.id }) } : null;
    }),
    update: mock((a: { where: { id: string }; data: { sessionVersion: { increment: number } } }) => ({ kind: 'user', a })),
  },
  vendorProfile: {
    findUnique: mock(async (a: { where: { vendorId?: string; userId?: string } }) => {
      const p = profileOf(a.where);
      const u = p && users.find((x) => x.id === p.userId);
      return p ? { ...p, user: { phone: u?.phone ?? null } } : null;
    }),
    update: mock((a: { where: { id: string }; data: Partial<Profile> }) => ({ kind: 'profile', a })),
  },
  // Applies the two writes together, as the real transaction does.
  $transaction: mock(async (ops: unknown[]) => Promise.all(ops.map((op) => apply(op as Op)))),
};
type Op = { kind: 'user'; a: { where: { id: string }; data: { sessionVersion: { increment: number } } } } | { kind: 'profile'; a: { where: { id: string }; data: Partial<Profile> } };
async function apply(op: Op) {
  if (op.kind === 'user') users.find((u) => u.id === op.a.where.id)!.sessionVersion += op.a.data.sessionVersion.increment;
  else Object.assign(profileOf({ id: op.a.where.id })!, op.a.data);
}

const service = createVendorLoginCodeService({
  db: db as never,
  isLocked: async (id) => lockedIds.has(id),
  record: async (identifier, success) => void attempts.push({ identifier, success }),
  hash,
  compare,
  newCode: () => nextCode,
  now: () => NOW,
});

beforeEach(() => {
  users = [
    { id: 'u1', name: 'Kush', phone: '9876543210', sessionVersion: 3, roles: [{ role: 'VENDOR' }] },
    { id: 'u2', name: null, phone: '9000000002', sessionVersion: 0, roles: [{ role: 'VENDOR' }] }, // a login from before codes existed
    { id: 'u3', name: 'A customer', phone: '9111111111', sessionVersion: 0, roles: [{ role: 'CUSTOMER' }] }, // no vendor profile
  ];
  profiles = [
    { id: 'p1', userId: 'u1', vendorId: 'v1', loginCodeHash: 'hash(482913)', loginCodeSetAt: new Date('2026-10-01T00:00:00Z') },
    { id: 'p2', userId: 'u2', vendorId: 'v2', loginCodeHash: null, loginCodeSetAt: null },
  ];
  attempts = [];
  lockedIds = new Set();
  nextCode = '730518';
  for (const m of [db.user.findUnique, db.user.update, db.vendorProfile.findUnique, db.vendorProfile.update, db.$transaction]) m.mockClear();
  // update() inside change() is awaited directly, not through $transaction — make that path apply the write too.
  db.vendorProfile.update.mockImplementation((a) => {
    const op = { kind: 'profile' as const, a };
    return Object.assign(apply(op).then(() => op), op);
  });
});

describe('verify — signing in', () => {
  test('the registered mobile number + the right code signs in as that vendor', async () => {
    expect(await service.verify('+91 98765 43210', '482913')).toEqual({ id: 'u1', name: 'Kush', roles: ['VENDOR'], vendorId: 'v1', sessionVersion: 3 });
    expect(attempts).toEqual([{ identifier: 'vendor-code:9876543210', success: true }]);
  });

  test('a wrong code is "no", and is counted against that number', async () => {
    expect(await service.verify('9876543210', '482914')).toBeNull();
    expect(attempts).toEqual([{ identifier: 'vendor-code:9876543210', success: false }]);
  });

  test('every other kind of "no" looks the same: unknown number, a login with no code, a customer’s number', async () => {
    expect(await service.verify('9222222222', '482913')).toBeNull();
    expect(await service.verify('9000000002', '482913')).toBeNull();
    expect(await service.verify('9111111111', '482913')).toBeNull();
    expect(attempts.map((a) => a.success)).toEqual([false, false, false]);
  });

  test('a locked number is refused before anything is looked up — even with the right code', async () => {
    lockedIds.add('vendor-code:9876543210');
    expect(await service.verify('9876543210', '482913')).toBeNull();
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(attempts).toEqual([]);
  });

  test('a malformed number or code never reaches the database or the counter', async () => {
    expect(await service.verify('12345', '482913')).toBeNull();
    expect(await service.verify('9876543210', '48291')).toBeNull();
    expect(await service.verify(undefined, undefined)).toBeNull();
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(attempts).toEqual([]);
  });
});

describe('issue — an admin makes a new code', () => {
  test('returns the code once, stores only its hash, and signs the vendor out everywhere', async () => {
    expect(await service.issue('v1')).toEqual({ code: '730518', mobile: '9876543210' });
    expect(profiles[0]).toMatchObject({ loginCodeHash: 'hash(730518)', loginCodeSetAt: NOW });
    expect(JSON.stringify(profiles)).not.toContain('"730518"');
    expect(users[0].sessionVersion).toBe(4);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  test('the old code stops working; the new one works', async () => {
    await service.issue('v1');
    expect(await service.verify('9876543210', '482913')).toBeNull();
    expect((await service.verify('9876543210', '730518'))?.vendorId).toBe('v1');
  });

  test('a vendor from before codes existed gets their first one', async () => {
    await service.issue('v2');
    expect((await service.verify('9000000002', '730518'))?.vendorId).toBe('v2');
  });

  test('a vendor with no login at all cannot be given a code', async () => {
    await expect(service.issue('v-none')).rejects.toBeInstanceOf(NotFoundError);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe('change — the vendor changes their own code', () => {
  const input = { current: '482913', next: '730518', confirm: '730518' };

  test('with the right current code: the new hash is stored, the date moves, and they stay signed in', async () => {
    expect(await service.change('u1', input)).toEqual({ changed: true });
    expect(profiles[0]).toMatchObject({ loginCodeHash: 'hash(730518)', loginCodeSetAt: NOW });
    expect(users[0].sessionVersion).toBe(3);
    expect(attempts).toEqual([{ identifier: 'vendor-code-change:u1', success: true }]);
  });

  test('a wrong current code changes nothing and is counted', async () => {
    expect(await service.change('u1', { ...input, current: '000417' })).toEqual({ errors: { current: 'That is not your current code' } });
    expect(profiles[0].loginCodeHash).toBe('hash(482913)');
    expect(attempts).toEqual([{ identifier: 'vendor-code-change:u1', success: false }]);
  });

  test('a badly formed request is explained before anything is read or counted', async () => {
    expect(await service.change('u1', { current: '482913', next: '111111', confirm: '111111' })).toEqual({ errors: { next: expect.any(String) } });
    expect(db.vendorProfile.findUnique).not.toHaveBeenCalled();
    expect(attempts).toEqual([]);
  });

  test('after too many wrong tries it is paused — even with the right current code', async () => {
    lockedIds.add('vendor-code-change:u1');
    await expect(service.change('u1', input)).rejects.toBeInstanceOf(ConflictError);
    expect(profiles[0].loginCodeHash).toBe('hash(482913)');
  });

  test('a login with no code cannot "change" one into existence', async () => {
    expect(await service.change('u2', input)).toEqual({ errors: { current: 'That is not your current code' } });
    expect(profiles[1].loginCodeHash).toBeNull();
  });

  test('someone who is not a vendor login is not found', async () => {
    await expect(service.change('u3', input)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('status — for the dashboard', () => {
  test('a recent code: no reminder', async () => {
    expect(await service.status('u1')).toEqual({ hasCode: true, setAt: new Date('2026-10-01T00:00:00Z'), reminder: false });
  });

  test('a code 30 days old: reminder', async () => {
    profiles[0].loginCodeSetAt = new Date('2026-09-01T00:00:00Z');
    expect((await service.status('u1')).reminder).toBe(true);
  });

  test('no code: nothing to remind about', async () => {
    expect(await service.status('u2')).toEqual({ hasCode: false, setAt: null, reminder: false });
    expect(await service.status('u3')).toEqual({ hasCode: false, setAt: null, reminder: false });
  });
});
