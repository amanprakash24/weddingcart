/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { ConflictError, NotFoundError } from '@/lib/errors';

// Every dependency is passed in as a fake (createVendorLoginCodeService) — nothing shared is mocked except '@/lib/prisma', which
// importing the service would otherwise load for real. The "hash" here is a plain marker so the tests can see what was stored.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createVendorLoginCodeService } = await import('./vendorLoginCode.service');

const NOW = new Date('2026-10-07T10:00:00Z');
const hash = async (code: string) => `hash(${code})`;
const compare = async (code: string, stored: string) => stored === `hash(${code})`;

type UserRow = { id: string; name: string | null; phone: string | null; sessionVersion: number; loginCodeHash: string | null; loginCodeSetAt: Date | null; roles: { role: string }[] };
type Profile = { userId: string; vendorId: string };

let users: UserRow[];
let profiles: Profile[];
let attempts: { identifier: string; success: boolean }[];
let lockedIds: Set<string>;
let nextCode: string;

const db = {
  user: {
    findUnique: mock(async (a: { where: { phone?: string; id?: string } }) => {
      const u = users.find((x) => (a.where.id ? x.id === a.where.id : x.phone === a.where.phone));
      return u ? { ...u, vendorProfile: profiles.find((p) => p.userId === u.id) ?? null } : null;
    }),
    update: mock(async (a: { where: { id: string }; data: { loginCodeHash?: string; loginCodeSetAt?: Date; sessionVersion?: { increment: number } } }) => {
      const u = users.find((x) => x.id === a.where.id)!;
      const { sessionVersion, ...rest } = a.data;
      Object.assign(u, rest);
      if (sessionVersion) u.sessionVersion += sessionVersion.increment;
      return u;
    }),
  },
  vendorProfile: { findUnique: mock(async (a: { where: { vendorId: string } }) => profiles.find((p) => p.vendorId === a.where.vendorId) ?? null) },
};

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
    // A vendor's owner, with a code.
    { id: 'u1', name: 'Kush', phone: '9876543210', sessionVersion: 3, loginCodeHash: 'hash(482913)', loginCodeSetAt: new Date('2026-10-01T00:00:00Z'), roles: [{ role: 'VENDOR' }] },
    // A vendor's owner from before codes existed.
    { id: 'u2', name: null, phone: '9000000002', sessionVersion: 0, loginCodeHash: null, loginCodeSetAt: null, roles: [{ role: 'VENDOR' }] },
    // The founder: no vendor at all — the code is the person's, not a vendor's.
    { id: 'u3', name: 'Founder', phone: '9111111111', sessionVersion: 1, loginCodeHash: 'hash(730518)', loginCodeSetAt: new Date('2026-10-05T00:00:00Z'), roles: [{ role: 'SUPER_ADMIN' }] },
    // An internal account with an email only — no mobile number yet.
    { id: 'u4', name: 'Sales', phone: null, sessionVersion: 0, loginCodeHash: null, loginCodeSetAt: null, roles: [{ role: 'SALES' }] },
  ];
  profiles = [{ userId: 'u1', vendorId: 'v1' }, { userId: 'u2', vendorId: 'v2' }];
  attempts = [];
  lockedIds = new Set();
  nextCode = '815204';
  for (const m of [db.user.findUnique, db.user.update, db.vendorProfile.findUnique]) m.mockClear();
});

describe('verify — signing in with mobile number + code', () => {
  test('a vendor’s owner signs in as themselves; the session still knows the vendor they own', async () => {
    expect(await service.verify('+91 98765 43210', '482913')).toEqual({ id: 'u1', name: 'Kush', roles: ['VENDOR'], vendorId: 'v1', sessionVersion: 3 });
    expect(attempts).toEqual([{ identifier: 'vendor-code:9876543210', success: true }]);
  });

  test('a person with no vendor at all signs in the same way — the founder, a manager, an employee', async () => {
    expect(await service.verify('9111111111', '730518')).toEqual({ id: 'u3', name: 'Founder', roles: ['SUPER_ADMIN'], vendorId: undefined, sessionVersion: 1 });
  });

  test('a wrong code is "no", and is counted against that number', async () => {
    expect(await service.verify('9876543210', '482914')).toBeNull();
    expect(attempts).toEqual([{ identifier: 'vendor-code:9876543210', success: false }]);
  });

  test('one person’s code does not open another person’s account', async () => {
    expect(await service.verify('9876543210', '730518')).toBeNull(); // the founder's code with the vendor owner's number
    expect(await service.verify('9111111111', '482913')).toBeNull();
  });

  test('every other kind of "no" looks the same: an unknown number, a person with no code', async () => {
    expect(await service.verify('9222222222', '482913')).toBeNull();
    expect(await service.verify('9000000002', '482913')).toBeNull();
    expect(attempts.map((a) => a.success)).toEqual([false, false]);
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

describe('issuing a code', () => {
  test('for a person: returned once, only its hash stored, and they are signed out everywhere', async () => {
    expect(await service.issueForUser('u3')).toEqual({ code: '815204', mobile: '9111111111' });
    expect(users[2]).toMatchObject({ loginCodeHash: 'hash(815204)', loginCodeSetAt: NOW, sessionVersion: 2 });
    expect(JSON.stringify(users)).not.toContain('"815204"');
    expect(await service.verify('9111111111', '730518')).toBeNull(); // the old code is dead
    expect((await service.verify('9111111111', '815204'))?.id).toBe('u3');
  });

  test('for a vendor’s owner, by vendor — the admin’s "New login code"', async () => {
    expect(await service.issue('v2')).toEqual({ code: '815204', mobile: '9000000002' });
    expect((await service.verify('9000000002', '815204'))?.vendorId).toBe('v2');
  });

  test('a person with no mobile number cannot be given a code — the code is only half of the sign-in', async () => {
    await expect(service.issueForUser('u4')).rejects.toBeInstanceOf(ConflictError);
    expect(users[3].loginCodeHash).toBeNull();
  });

  test('someone who does not exist, or a vendor with no login, is not found', async () => {
    await expect(service.issueForUser('nobody')).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.issue('v-none')).rejects.toBeInstanceOf(NotFoundError);
    expect(db.user.update).not.toHaveBeenCalled();
  });
});

describe('change — a person changes their own code', () => {
  const input = { current: '482913', next: '730519', confirm: '730519' };

  test('with the right current code: the new hash is stored, the date moves, and they stay signed in', async () => {
    expect(await service.change('u1', input)).toEqual({ changed: true });
    expect(users[0]).toMatchObject({ loginCodeHash: 'hash(730519)', loginCodeSetAt: NOW, sessionVersion: 3 });
    expect(attempts).toEqual([{ identifier: 'vendor-code-change:u1', success: true }]);
  });

  test('a wrong current code changes nothing and is counted', async () => {
    expect(await service.change('u1', { ...input, current: '000417' })).toEqual({ errors: { current: 'That is not your current code' } });
    expect(users[0].loginCodeHash).toBe('hash(482913)');
    expect(attempts).toEqual([{ identifier: 'vendor-code-change:u1', success: false }]);
  });

  test('a badly formed request is explained before anything is read or counted', async () => {
    expect(await service.change('u1', { current: '482913', next: '111111', confirm: '111111' })).toEqual({ errors: { next: expect.any(String) } });
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(attempts).toEqual([]);
  });

  test('after too many wrong tries it is paused — even with the right current code', async () => {
    lockedIds.add('vendor-code-change:u1');
    await expect(service.change('u1', input)).rejects.toBeInstanceOf(ConflictError);
    expect(users[0].loginCodeHash).toBe('hash(482913)');
  });

  test('a person with no code cannot "change" one into existence', async () => {
    expect(await service.change('u2', input)).toEqual({ errors: { current: 'That is not your current code' } });
    expect(users[1].loginCodeHash).toBeNull();
  });

  test('someone who does not exist is not found', async () => {
    await expect(service.change('nobody', input)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('status — for the dashboard', () => {
  test('a recent code: no reminder', async () => {
    expect(await service.status('u1')).toEqual({ hasCode: true, setAt: new Date('2026-10-01T00:00:00Z'), reminder: false });
  });

  test('a code 30 days old: reminder', async () => {
    users[0].loginCodeSetAt = new Date('2026-09-01T00:00:00Z');
    expect((await service.status('u1')).reminder).toBe(true);
  });

  test('no code: nothing to remind about', async () => {
    expect(await service.status('u2')).toEqual({ hasCode: false, setAt: null, reminder: false });
    expect(await service.status('nobody')).toEqual({ hasCode: false, setAt: null, reminder: false });
  });
});
