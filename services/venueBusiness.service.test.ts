/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { PERMISSIONS } from '@/lib/auth/permissions';

// A person's memberships and the business they work in (Person → Membership → Role → Permissions). Fakes only.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createVenueBusinessService } = await import('./venueBusiness.service');

type Kind = 'VENDOR' | 'PLATFORM';
type MemberRow = { businessId: string; userId: string; role: 'OWNER' | 'MANAGER' | 'EMPLOYEE' | 'STAFF'; jobTitle?: string | null; grants?: string[]; denies?: string[]; removedAt?: Date | null; createdAt?: Date };

let profiles: Record<string, { vendorId: string; vendor: { name: string } }>;
let businesses: { id: string; vendorId: string | null; kind: Kind; name: string }[];
let members: MemberRow[];
let raceOnCreate = false;

const db = {
  vendorProfile: { findUnique: mock(async ({ where }: { where: { userId: string } }) => profiles[where.userId] ?? null) },
  business: {
    findUnique: mock(async ({ where }: { where: { vendorId: string } }) => businesses.find((b) => b.vendorId === where.vendorId) ?? null),
    create: mock(async ({ data }: { data: { vendorId: string; name: string } }) => {
      if (raceOnCreate) {
        raceOnCreate = false;
        businesses.push({ id: 'b-raced', vendorId: data.vendorId, kind: 'VENDOR', name: data.name }); // another request made it first
        throw Object.assign(new Error('unique'), { code: 'P2002' });
      }
      const b = { id: `b-${businesses.length + 1}`, vendorId: data.vendorId, kind: 'VENDOR' as const, name: data.name };
      businesses.push(b);
      return b;
    }),
  },
  businessMember: {
    findUnique: mock(async ({ where }: { where: { businessId_userId: { businessId: string; userId: string } } }) => members.find((m) => m.businessId === where.businessId_userId.businessId && m.userId === where.businessId_userId.userId) ?? null),
    create: mock(async ({ data }: { data: MemberRow }) => (members.push({ ...data, createdAt: new Date(members.length) }), data)),
    findMany: mock(async ({ where }: { where: { userId: string; removedAt: null } }) =>
      members
        .filter((m) => m.userId === where.userId && !m.removedAt)
        .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0))
        .map((m) => ({ role: m.role, jobTitle: m.jobTitle ?? null, grants: m.grants ?? [], denies: m.denies ?? [], business: businesses.find((b) => b.id === m.businessId)! }))
    ),
  },
};
const service = createVenueBusinessService({ db: db as never });

const add = (m: MemberRow) => members.push({ ...m, createdAt: new Date(members.length) });

beforeEach(() => {
  profiles = { 'u-kush': { vendorId: 'v-kush', vendor: { name: 'Kush Travel' } } };
  businesses = [
    { id: 'shaadi-shopping', vendorId: null, kind: 'PLATFORM', name: 'Shaadi Shopping' },
    { id: 'venue-a', vendorId: 'v-a', kind: 'VENDOR', name: 'Venue A' },
    { id: 'decor-b', vendorId: 'v-b', kind: 'VENDOR', name: 'Decorator B' },
  ];
  members = [];
  raceOnCreate = false;
  for (const m of [db.business.create, db.businessMember.create]) m.mockClear();
});

describe('a vendor’s owner — the link from before memberships still works', () => {
  test('first use: the vendor gets its business, named after it, with the login as Owner', async () => {
    expect(await service.scopeForVendorLogin('u-kush')).toEqual({ kind: 'BUSINESS', businessId: 'b-4', role: 'OWNER', permissions: [...PERMISSIONS], userId: 'u-kush' });
    expect((db.business.create.mock.calls[0] as unknown as [{ data: unknown }])[0].data).toEqual({ name: 'Kush Travel', kind: 'VENDOR', vendorId: 'v-kush' });
    expect(members).toMatchObject([{ businessId: 'b-4', userId: 'u-kush', role: 'OWNER' }]);
  });

  test('after that, the same business — nothing created twice', async () => {
    await service.scopeForVendorLogin('u-kush');
    await service.scopeForVendorLogin('u-kush');
    expect(db.business.create).toHaveBeenCalledTimes(1);
    expect(db.businessMember.create).toHaveBeenCalledTimes(1);
  });

  test('two first requests at once: the second uses the business the first made', async () => {
    raceOnCreate = true;
    expect((await service.scopeForVendorLogin('u-kush'))?.businessId).toBe('b-raced');
  });

  test('a person who belongs to no business gets no scope', async () => {
    expect(await service.scopeForVendorLogin('u-nobody')).toBeNull();
    expect(db.business.create).not.toHaveBeenCalled();
  });
});

describe('members — many people in one business', () => {
  test('a manager works in the business with a manager’s permissions: no money, no team, no settings', async () => {
    add({ businessId: 'venue-a', userId: 'rahul', role: 'MANAGER', jobTitle: 'Operations manager' });
    const scope = await service.scopeForVendorLogin('rahul');
    expect(scope).toMatchObject({ kind: 'BUSINESS', businessId: 'venue-a', role: 'MANAGER', userId: 'rahul' });
    expect(scope?.permissions).toEqual(['enquiries', 'quotations', 'weddings', 'tasks', 'catalog']);
  });

  test('what the owner changed for one person is what that person has', async () => {
    add({ businessId: 'venue-a', userId: 'rahul', role: 'MANAGER', grants: ['view_financials'], denies: ['catalog'] });
    add({ businessId: 'venue-a', userId: 'sita', role: 'MANAGER' });
    expect((await service.scopeForVendorLogin('rahul'))?.permissions).toEqual(['enquiries', 'quotations', 'weddings', 'tasks', 'view_financials']);
    expect((await service.scopeForVendorLogin('sita'))?.permissions).not.toContain('view_financials');
  });

  test('an employee is a member with nothing but their own work', async () => {
    add({ businessId: 'venue-a', userId: 'amit', role: 'EMPLOYEE', jobTitle: 'Event coordinator' });
    expect(await service.scopeForVendorLogin('amit')).toMatchObject({ businessId: 'venue-a', role: 'EMPLOYEE', permissions: [] });
  });

  test('someone removed from the team is no longer a member', async () => {
    add({ businessId: 'venue-a', userId: 'amit', role: 'EMPLOYEE', removedAt: new Date() });
    expect(await service.scopeForVendorLogin('amit')).toBeNull();
    expect(await service.workspaces('amit')).toEqual([]);
  });
});

describe('one person, several businesses — "Choose Workspace"', () => {
  beforeEach(() => {
    add({ businessId: 'venue-a', userId: 'rahul', role: 'MANAGER', jobTitle: 'Manager' });
    add({ businessId: 'decor-b', userId: 'rahul', role: 'EMPLOYEE', jobTitle: 'Coordinator' });
  });

  test('they are listed every business they belong to, each with its own role', async () => {
    expect((await service.workspaces('rahul')).map((w) => [w.name, w.role, w.jobTitle])).toEqual([['Venue A', 'MANAGER', 'Manager'], ['Decorator B', 'EMPLOYEE', 'Coordinator']]);
  });

  test('with no choice made there is no scope — they are asked to choose, never dropped into one', async () => {
    expect(await service.scopeForVendorLogin('rahul')).toBeNull();
    expect(await service.scopeForVendorLogin('rahul', null)).toBeNull();
  });

  test('the chosen workspace decides the business, the role and the permissions', async () => {
    expect(await service.scopeForVendorLogin('rahul', 'venue-a')).toMatchObject({ businessId: 'venue-a', role: 'MANAGER', permissions: ['enquiries', 'quotations', 'weddings', 'tasks', 'catalog'] });
    expect(await service.scopeForVendorLogin('rahul', 'decor-b')).toMatchObject({ businessId: 'decor-b', role: 'EMPLOYEE', permissions: [] });
  });

  test('a choice they are not a member of counts for nothing — a tampered cookie opens no business', async () => {
    add({ businessId: 'venue-a', userId: 'sita', role: 'OWNER' });
    expect(await service.scopeForVendorLogin('sita', 'decor-b')).toMatchObject({ businessId: 'venue-a' }); // falls back to her only business
    expect(await service.scopeForVendorLogin('rahul', 'somebody-elses')).toBeNull(); // several, and the choice is not one of them
    expect(await service.scopeForVendorLogin('rahul', 'shaadi-shopping')).toBeNull();
  });
});

describe('Shaadi Shopping’s own team', () => {
  test('the founder is the Owner of the Shaadi Shopping business — and it is never a vendor workspace', async () => {
    add({ businessId: 'shaadi-shopping', userId: 'founder', role: 'OWNER' });
    expect(await service.scopeForPlatform('founder')).toMatchObject({ businessId: 'shaadi-shopping', role: 'OWNER', permissions: [...PERMISSIONS] });
    expect(await service.scopeForVendorLogin('founder')).toBeNull();
    expect(await service.scopeForVendorLogin('founder', 'shaadi-shopping')).toBeNull();
  });

  test('a founder who also owns a vendor sees both, and each opens its own side', async () => {
    add({ businessId: 'shaadi-shopping', userId: 'founder', role: 'OWNER' });
    add({ businessId: 'venue-a', userId: 'founder', role: 'OWNER' });
    expect((await service.workspaces('founder')).map((w) => [w.name, w.kind])).toEqual([['Shaadi Shopping', 'PLATFORM'], ['Venue A', 'VENDOR']]);
    expect((await service.scopeForVendorLogin('founder'))?.businessId).toBe('venue-a'); // her only VENDOR business
  });

  test('someone who is not on the team has no platform scope', async () => {
    add({ businessId: 'venue-a', userId: 'rahul', role: 'MANAGER' });
    expect(await service.scopeForPlatform('rahul')).toBeNull();
  });
});
