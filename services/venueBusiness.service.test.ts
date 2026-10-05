/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';

// The venue's own business (Phase C). Fakes only.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createVenueBusinessService } = await import('./venueBusiness.service');

let profiles: Record<string, { vendorId: string; vendor: { name: string } }>;
let businesses: { id: string; vendorId: string; kind: 'VENDOR' | 'PLATFORM' }[];
let members: { businessId: string; userId: string; role: 'OWNER' | 'STAFF' }[];
let raceOnCreate = false;

const db = {
  vendorProfile: { findUnique: mock(async ({ where }: { where: { userId: string } }) => profiles[where.userId] ?? null) },
  business: {
    findUnique: mock(async ({ where }: { where: { vendorId: string } }) => businesses.find((b) => b.vendorId === where.vendorId) ?? null),
    create: mock(async ({ data }: { data: { vendorId: string; name: string } }) => {
      if (raceOnCreate) {
        raceOnCreate = false;
        businesses.push({ id: 'b-raced', vendorId: data.vendorId, kind: 'VENDOR' }); // another request made it first
        throw Object.assign(new Error('unique'), { code: 'P2002' });
      }
      const b = { id: `b-${businesses.length + 1}`, vendorId: data.vendorId, kind: 'VENDOR' as const };
      businesses.push(b);
      return b;
    }),
  },
  businessMember: {
    findUnique: mock(async ({ where }: { where: { businessId_userId: { businessId: string; userId: string } } }) => members.find((m) => m.businessId === where.businessId_userId.businessId && m.userId === where.businessId_userId.userId) ?? null),
    create: mock(async ({ data }: { data: { businessId: string; userId: string; role: 'OWNER' } }) => (members.push(data), data)),
  },
};
const service = createVenueBusinessService({ db: db as never });

beforeEach(() => {
  profiles = { 'u-kush': { vendorId: 'v-kush', vendor: { name: 'Kush Travel' } } };
  businesses = [];
  members = [];
  for (const m of [db.business.create, db.businessMember.create]) m.mockClear();
});

describe('a vendor login’s own business', () => {
  test('first use: the vendor gets its business, named after it, with the login as Owner', async () => {
    expect(await service.scopeForVendorLogin('u-kush')).toEqual({ kind: 'BUSINESS', businessId: 'b-1', role: 'OWNER' });
    expect((db.business.create.mock.calls[0] as unknown as [{ data: unknown }])[0].data).toEqual({ name: 'Kush Travel', kind: 'VENDOR', vendorId: 'v-kush' });
    expect(members).toEqual([{ businessId: 'b-1', userId: 'u-kush', role: 'OWNER' }]);
  });

  test('after that, the same business — nothing created twice', async () => {
    await service.scopeForVendorLogin('u-kush');
    await service.scopeForVendorLogin('u-kush');
    expect(db.business.create).toHaveBeenCalledTimes(1);
    expect(db.businessMember.create).toHaveBeenCalledTimes(1);
  });

  test('two first requests at once: the second uses the business the first made', async () => {
    raceOnCreate = true;
    expect(await service.scopeForVendorLogin('u-kush')).toEqual({ kind: 'BUSINESS', businessId: 'b-raced', role: 'OWNER' });
  });

  test('a login with no vendor gets no business', async () => {
    expect(await service.scopeForVendorLogin('u-nobody')).toBeNull();
    expect(db.business.create).not.toHaveBeenCalled();
  });

  test('a business that is not a vendor’s (the platform) is never used as a venue scope', async () => {
    businesses.push({ id: 'shaadi-shopping', vendorId: 'v-kush', kind: 'PLATFORM' });
    expect(await service.scopeForVendorLogin('u-kush')).toBeNull();
  });
});
