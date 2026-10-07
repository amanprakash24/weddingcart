/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { ConflictError, NotFoundError } from '@/lib/errors';

// "My sign-in": a member of Shaadi Shopping's own team registers their OWN mobile number. The rule under test: nobody's login code
// is replaced, and nobody's login is given more access, without proof from the person it belongs to. Everything is a fake passed
// in; only '@/lib/prisma' is stubbed because importing the service loads it.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createTeamLoginService } = await import('./teamLogin.service');

type U = { id: string; name: string | null; phone: string | null; passwordHash: string | null; loginCodeHash: string | null; roles: string[]; vendorName?: string };
type M = { businessId: string; userId: string; role: string; jobTitle: string | null; grants: string[]; denies: string[]; removedAt?: Date | null };

let users: U[];
let members: M[];
let attempts: { identifier: string; success: boolean }[];
let locked: Set<string>;
const issued: string[] = [];

const view = (u: U) => ({ ...u, roles: u.roles.map((role) => ({ role })), vendorProfile: u.vendorName ? { vendor: { name: u.vendorName } } : null });
const db = {
  user: {
    findUnique: mock(async (a: { where: { id?: string; phone?: string } }) => {
      const u = users.find((x) => (a.where.id ? x.id === a.where.id : x.phone === a.where.phone));
      return u ? view(u) : null;
    }),
    update: mock(async (a: { where: { id: string }; data: { phone: string } }) => Object.assign(users.find((u) => u.id === a.where.id)!, a.data)),
  },
  userRole: {
    upsert: mock(async (a: { create: { userId: string; role: string } }) => {
      const u = users.find((x) => x.id === a.create.userId)!;
      if (!u.roles.includes(a.create.role)) u.roles.push(a.create.role);
    }),
  },
  businessMember: {
    findUnique: mock(async (a: { where: { businessId_userId: { businessId: string; userId: string } } }) => members.find((m) => m.businessId === a.where.businessId_userId.businessId && m.userId === a.where.businessId_userId.userId) ?? null),
    upsert: mock(async (a: { where: { businessId_userId: { businessId: string; userId: string } }; create: M; update: Partial<M> }) => {
      const existing = members.find((m) => m.businessId === a.where.businessId_userId.businessId && m.userId === a.where.businessId_userId.userId);
      if (existing) Object.assign(existing, a.update);
      else members.push({ ...a.create });
    }),
  },
};

// The "hash" is a plain marker — h(secret) — for passwords and codes alike, so the tests can see what would match.
const service = createTeamLoginService({
  db: db as never,
  isLocked: async (id) => locked.has(id),
  record: async (identifier, success) => void attempts.push({ identifier, success }),
  compare: async (secret, hash) => hash === `h(${secret})`,
  issueCode: async (userId) => {
    issued.push(userId);
    const u = users.find((x) => x.id === userId)!;
    u.loginCodeHash = 'h(815204)';
    return { code: '815204', mobile: u.phone };
  },
});

const KUSH_CODE = '482913';

beforeEach(() => {
  users = [
    { id: 'founder', name: 'Founder', phone: null, passwordHash: 'h(secret)', loginCodeHash: null, roles: ['SUPER_ADMIN'] },
    { id: 'sales', name: 'Sales', phone: null, passwordHash: 'h(sales-pw)', loginCodeHash: null, roles: ['SALES'] },
    { id: 'kush', name: null, phone: '7070486987', passwordHash: null, loginCodeHash: `h(${KUSH_CODE})`, roles: ['VENDOR'], vendorName: 'Kush Travel' },
    // A couple who signed in by one-time code once: a login with a mobile number but no login code.
    { id: 'couple', name: 'Riya', phone: '9000011111', passwordHash: null, loginCodeHash: null, roles: ['CUSTOMER'] },
  ];
  members = [
    { businessId: 'shaadi-shopping', userId: 'founder', role: 'OWNER', jobTitle: null, grants: [], denies: [] },
    { businessId: 'shaadi-shopping', userId: 'sales', role: 'MANAGER', jobTitle: null, grants: ['view_financials', 'edit_financials'], denies: [] },
  ];
  attempts = [];
  locked = new Set();
  issued.length = 0;
  for (const m of [db.user.update, db.userRole.upsert, db.businessMember.upsert]) m.mockClear();
});

describe('what the card shows', () => {
  test('a team member with no mobile yet', async () => {
    expect(await service.status('founder')).toEqual({ mobile: null, hasCode: false, hasPassword: true });
  });

  test('the number is masked — the screen never needs the whole of it', async () => {
    users[0].phone = '9876543210';
    users[0].loginCodeHash = 'h(730518)';
    expect(await service.status('founder')).toEqual({ mobile: '98******10', hasCode: true, hasPassword: true });
  });

  test('someone who is not on the internal team has nothing here', async () => {
    await expect(service.status('kush')).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.linkMobile('couple', { mobile: '9876543210' })).rejects.toBeInstanceOf(NotFoundError);
    expect(issued).toEqual([]);
  });
});

describe('registering my own mobile number', () => {
  test('a new number becomes mine, on my own account, and I get my code once — my password still works', async () => {
    expect(await service.linkMobile('founder', { mobile: '+91 98765 43210', password: 'secret' })).toEqual({ code: '815204', mobile: '98******10' });
    expect(users[0]).toMatchObject({ phone: '9876543210', passwordHash: 'h(secret)', roles: ['SUPER_ADMIN'] });
    expect(issued).toEqual(['founder']);
  });

  test('my password is asked again; a wrong one changes nothing and is counted', async () => {
    expect(await service.linkMobile('founder', { mobile: '9876543210', password: 'guess' })).toEqual({ errors: { password: 'That is not your current password' } });
    expect(await service.linkMobile('founder', { mobile: '9876543210' })).toEqual({ errors: { password: expect.any(String) } });
    expect(users[0].phone).toBeNull();
    expect(issued).toEqual([]);
    expect(attempts).toEqual([{ identifier: 'team-login-link:founder', success: false }, { identifier: 'team-login-link:founder', success: false }]);
  });

  test('after too many wrong tries it is paused — even with the right password', async () => {
    locked.add('team-login-link:founder');
    await expect(service.linkMobile('founder', { mobile: '9876543210', password: 'secret' })).rejects.toBeInstanceOf(ConflictError);
    expect(users[0].phone).toBeNull();
  });

  test('something that is not a mobile number is explained before the password is even checked', async () => {
    expect(await service.linkMobile('founder', { mobile: '12345', password: 'secret' })).toEqual({ errors: { mobile: expect.any(String) } });
    expect(attempts).toEqual([]);
  });

  test('my own number again: just a fresh code', async () => {
    users[0].phone = '9876543210';
    expect(await service.linkMobile('founder', { mobile: '9876543210', password: 'secret' })).toMatchObject({ code: '815204' });
    expect(db.user.update).not.toHaveBeenCalled();
    expect(issued).toEqual(['founder']);
  });

  test('a team member with no password proves it with their OWN current code — a wrong one changes nothing', async () => {
    users[0] = { ...users[0], passwordHash: null, phone: '9876543210', loginCodeHash: 'h(730518)' };
    expect(await service.linkMobile('founder', { mobile: '9123456780', myCode: '000417' })).toEqual({ errors: { myCode: expect.any(String) } });
    expect(users[0].phone).toBe('9876543210');
    expect(await service.linkMobile('founder', { mobile: '9123456780', myCode: '730518' })).toEqual({ code: '815204', mobile: '91******80' });
    expect(users[0].phone).toBe('9123456780');
  });

  test('a login with neither a password nor a code cannot prove anything, so it cannot use this at all', async () => {
    users[0] = { ...users[0], passwordHash: null };
    await expect(service.linkMobile('founder', { mobile: '9876543210' })).rejects.toBeInstanceOf(ConflictError);
    expect(issued).toEqual([]);
  });
});

describe('a number that is already another login — it cannot be taken over', () => {
  const untouched = () => {
    expect(users[2]).toMatchObject({ roles: ['VENDOR'], loginCodeHash: `h(${KUSH_CODE})`, phone: '7070486987' });
    expect(issued).toEqual([]);
    expect(db.userRole.upsert).not.toHaveBeenCalled();
    expect(db.businessMember.upsert).not.toHaveBeenCalled();
  };

  test('knowing the number is not enough: it says whose it is and asks for THAT login’s code — nothing changes', async () => {
    expect(await service.linkMobile('founder', { mobile: '7070486987', password: 'secret' })).toEqual({ needsTheirCode: { mobile: '70******87', belongsTo: 'the login of Kush Travel' } });
    untouched();
  });

  test('a wrong code for that login changes nothing and is counted against me', async () => {
    expect(await service.linkMobile('founder', { mobile: '7070486987', password: 'secret', theirCode: '000417' })).toEqual({ errors: { theirCode: expect.any(String) } });
    untouched();
    expect(attempts).toEqual([{ identifier: 'team-login-link:founder', success: true }, { identifier: 'team-login-link:founder', success: false }]);
  });

  test('a “yes, I confirm” flag is not proof — the old way in is closed', async () => {
    const input = { mobile: '7070486987', password: 'secret', confirmExisting: true } as never;
    expect(await service.linkMobile('founder', input)).toEqual({ needsTheirCode: expect.any(Object) });
    untouched();
  });

  test('guessing that login’s code is paused after too many tries', async () => {
    locked.add('team-login-link:founder');
    await expect(service.linkMobile('founder', { mobile: '7070486987', password: 'secret', theirCode: KUSH_CODE })).rejects.toBeInstanceOf(ConflictError);
    untouched();
  });

  test('that login’s code does not replace my own password', async () => {
    expect(await service.linkMobile('founder', { mobile: '7070486987', password: 'wrong', theirCode: KUSH_CODE })).toEqual({ errors: { password: expect.any(String) } });
    untouched();
  });

  test('a login with no code has nothing to prove with — it cannot be linked, by anyone', async () => {
    await expect(service.linkMobile('founder', { mobile: '9000011111', password: 'secret' })).rejects.toBeInstanceOf(ConflictError);
    await expect(service.linkMobile('founder', { mobile: '9000011111', password: 'secret', theirCode: '123456' })).rejects.toBeInstanceOf(ConflictError);
    expect(users[3]).toMatchObject({ roles: ['CUSTOMER'], loginCodeHash: null });
    expect(issued).toEqual([]);
  });

  test('proven with its own code: it gets MY access and keeps what it had — and its code is NOT changed or shown', async () => {
    expect(await service.linkMobile('founder', { mobile: '7070486987', password: 'secret', theirCode: KUSH_CODE })).toEqual({ linked: true, mobile: '70******87' });
    expect(users[2].roles.sort()).toEqual(['SUPER_ADMIN', 'VENDOR']);
    expect(users[2].loginCodeHash).toBe(`h(${KUSH_CODE})`);
    expect(issued).toEqual([]);
    expect(members.find((m) => m.userId === 'kush')).toMatchObject({ businessId: 'shaadi-shopping', role: 'OWNER', grants: [], denies: [] });
    // My own email account is untouched — it is the fallback.
    expect(users[0]).toMatchObject({ phone: null, passwordHash: 'h(secret)', roles: ['SUPER_ADMIN'] });
  });

  test('never more than my own access: a sales member passes on sales access only', async () => {
    expect(await service.linkMobile('sales', { mobile: '7070486987', password: 'sales-pw', theirCode: KUSH_CODE })).toEqual({ linked: true, mobile: '70******87' });
    expect(users[2].roles.sort()).toEqual(['SALES', 'VENDOR']);
    expect(members.find((m) => m.userId === 'kush')).toMatchObject({ role: 'MANAGER', grants: ['view_financials', 'edit_financials'] });
  });
});
