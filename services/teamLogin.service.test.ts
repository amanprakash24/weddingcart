/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { ConflictError, NotFoundError } from '@/lib/errors';

// "My sign-in": a member of Shaadi Shopping's own team registers their OWN mobile number and gets their own code. Everything is a
// fake passed in; only '@/lib/prisma' is stubbed because importing the service loads it.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createTeamLoginService } = await import('./teamLogin.service');

type U = { id: string; name: string | null; phone: string | null; passwordHash: string | null; loginCodeSetAt: Date | null; roles: string[]; vendorName?: string };
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

const service = createTeamLoginService({
  db: db as never,
  isLocked: async (id) => locked.has(id),
  record: async (identifier, success) => void attempts.push({ identifier, success }),
  comparePassword: async (password, hash) => hash === `pw(${password})`,
  issueCode: async (userId) => {
    issued.push(userId);
    const u = users.find((x) => x.id === userId)!;
    u.loginCodeSetAt = new Date();
    return { code: '815204', mobile: u.phone };
  },
});

beforeEach(() => {
  users = [
    { id: 'founder', name: 'Founder', phone: null, passwordHash: 'pw(secret)', loginCodeSetAt: null, roles: ['SUPER_ADMIN'] },
    { id: 'sales', name: 'Sales', phone: null, passwordHash: 'pw(sales-pw)', loginCodeSetAt: null, roles: ['SALES'] },
    { id: 'kush', name: null, phone: '7070486987', passwordHash: null, loginCodeSetAt: new Date(), roles: ['VENDOR'], vendorName: 'Kush Travel' },
    { id: 'couple', name: 'Riya', phone: '9000011111', passwordHash: null, loginCodeSetAt: null, roles: ['CUSTOMER'] },
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
    users[0].loginCodeSetAt = new Date();
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
    expect(users[0]).toMatchObject({ phone: '9876543210', passwordHash: 'pw(secret)', roles: ['SUPER_ADMIN'] });
    expect(issued).toEqual(['founder']);
  });

  test('my password is asked again; a wrong one changes nothing and is counted', async () => {
    expect(await service.linkMobile('founder', { mobile: '9876543210', password: 'guess' })).toEqual({ errors: { password: 'That is not your current password' } });
    expect(await service.linkMobile('founder', { mobile: '9876543210' })).toEqual({ errors: { password: expect.any(String) } });
    expect(users[0].phone).toBeNull();
    expect(issued).toEqual([]);
    expect(attempts).toEqual([{ identifier: 'team-login-link:founder', success: false }, { identifier: 'team-login-link:founder', success: false }]);
  });

  test('after too many wrong passwords it is paused — even with the right one', async () => {
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
});

describe('a number that already belongs to another login', () => {
  test('first it says whose it is and asks — nothing is given or issued yet', async () => {
    expect(await service.linkMobile('founder', { mobile: '7070486987', password: 'secret' })).toEqual({ confirm: { mobile: '70******87', belongsTo: 'the login of Kush Travel' } });
    expect(users[2].roles).toEqual(['VENDOR']);
    expect(issued).toEqual([]);
    expect(db.businessMember.upsert).not.toHaveBeenCalled();
  });

  test('confirmed: that person gets MY access — the same roles and the same place in Shaadi Shopping — and keeps what they had', async () => {
    expect(await service.linkMobile('founder', { mobile: '7070486987', password: 'secret', confirmExisting: true })).toEqual({ code: '815204', mobile: '70******87' });
    expect(users[2].roles.sort()).toEqual(['SUPER_ADMIN', 'VENDOR']);
    expect(members.find((m) => m.userId === 'kush')).toMatchObject({ businessId: 'shaadi-shopping', role: 'OWNER', grants: [], denies: [] });
    // My own email account is untouched — it is the fallback.
    expect(users[0]).toMatchObject({ phone: null, passwordHash: 'pw(secret)', roles: ['SUPER_ADMIN'] });
  });

  test('a new code is always issued for that number — whatever code it had before stops working', async () => {
    await service.linkMobile('founder', { mobile: '7070486987', password: 'secret', confirmExisting: true });
    expect(issued).toEqual(['kush']);
  });

  test('never more than my own access: a sales member linking their number passes on sales access only', async () => {
    await service.linkMobile('sales', { mobile: '9000011111', password: 'sales-pw', confirmExisting: true });
    expect(users[3].roles.sort()).toEqual(['CUSTOMER', 'SALES']);
    expect(users[3].roles).not.toContain('SUPER_ADMIN');
    expect(members.find((m) => m.userId === 'couple')).toMatchObject({ role: 'MANAGER', grants: ['view_financials', 'edit_financials'] });
  });

  test('the confirmation does not skip the password', async () => {
    expect(await service.linkMobile('founder', { mobile: '7070486987', password: 'wrong', confirmExisting: true })).toEqual({ errors: { password: expect.any(String) } });
    expect(users[2].roles).toEqual(['VENDOR']);
  });
});
