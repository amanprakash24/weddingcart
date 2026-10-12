/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runInScope, type Scope } from '@/lib/ownership/scope';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// The Team screen on a real database (12 Oct 2026): a venue's owner adds people. A NEW number gets a login and a code that really
// signs in; a number that already has a code keeps it; an account with NO code is never given one by the owner (that would hand the
// owner a way into someone else's account). Changing and removing take effect on the very next request.
dbDescribe('the Team screen (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let team: ReturnType<typeof import('@/services/venueTeam.service').createVenueTeamService>;
  let businessSvc: typeof import('@/services/venueBusiness.service').venueBusinessService;
  let codes: typeof import('@/services/vendorLoginCode.service').vendorLoginCodeService;
  const users: string[] = [];
  const vendorIds: string[] = [];
  const businessIds: string[] = [];
  let owner: Extract<Scope, { kind: 'BUSINESS' }>;
  let otherOwner: Extract<Scope, { kind: 'BUSINESS' }>;
  const phone = (n: number) => `97${fx.runId.replace(/\D/g, '').padEnd(6, '0').slice(0, 6)}${String(n).padStart(2, '0')}`;
  const asOwner = <T>(fn: () => Promise<T>) => runInScope(owner, fn);
  const outcome = (p: Promise<unknown>) => p.then(() => null, (e: Error) => e);

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    const svc = await import('@/services/venueTeam.service');
    const { hashLoginCode } = await import('@/services/vendorLoginCode.service');
    let n = 0;
    team = svc.createVenueTeamService({ db: app.prisma, hash: hashLoginCode, newCode: () => `48291${n++ % 10}`, now: () => new Date() });
    businessSvc = (await import('@/services/venueBusiness.service')).venueBusinessService;
    codes = (await import('@/services/vendorLoginCode.service')).vendorLoginCodeService;
    const [{ id: anyVendorId }] = await fx.vendors(1);
    const { categoryId } = await app.prisma.vendor.findUniqueOrThrow({ where: { id: anyVendorId }, select: { categoryId: true } });
    for (const [i, label] of ['A', 'B'].entries()) {
      const v = await app.prisma.vendor.create({ data: { slug: `dbtest-team-${label.toLowerCase()}-${fx.runId}`, name: `DBTEST Team Venue ${label} ${fx.runId}`, categoryId, city: 'Patna', priceMin: 1, priceMax: 2, image: 'x', description: 'x' } });
      vendorIds.push(v.id);
      const u = await app.prisma.user.create({ data: { phone: phone(i), roles: { create: { role: 'VENDOR' } } } });
      users.push(u.id);
      await app.prisma.vendorProfile.create({ data: { userId: u.id, vendorId: v.id } });
      const s = (await businessSvc.scopeForVendorLogin(u.id))!;
      businessIds.push(s.businessId);
      if (i === 0) owner = s;
      else otherOwner = s;
    }
  });

  afterAll(async () => {
    if (!app) return;
    await app.prisma.businessMember.deleteMany({ where: { businessId: { in: businessIds } } });
    await app.prisma.business.deleteMany({ where: { id: { in: businessIds } } });
    await app.prisma.vendorProfile.deleteMany({ where: { userId: { in: users } } });
    const all = await app.prisma.user.findMany({ where: { phone: { startsWith: phone(0).slice(0, 8) } }, select: { id: true, phone: true } });
    await app.prisma.loginAttempt.deleteMany({ where: { identifier: { in: all.map((u) => `vendor-code:${u.phone}`) } } });
    await app.prisma.user.deleteMany({ where: { id: { in: all.map((u) => u.id) } } });
    await app.prisma.vendor.deleteMany({ where: { id: { in: vendorIds } } });
    if (fx) await fx.purge();
  });

  test('a new number: a login is made, its code really signs in, and the person works in this business as a manager without money', async () => {
    const r = await asOwner(() => team.add({ name: 'DBTEST Rahul', mobile: phone(10), role: 'MANAGER', jobTitle: 'Operations', seesMoney: false }));
    if ('errors' in r || r.kind !== 'NEW_LOGIN') throw new Error(`expected a new login, got ${JSON.stringify(r)}`);
    expect(r.code).toMatch(/^\d{6}$/);
    const login = await codes.verify(phone(10), r.code);
    expect(login?.roles).toContain('VENDOR');
    const scope = await businessSvc.scopeForVendorLogin(login!.id);
    expect(scope).toMatchObject({ businessId: owner.businessId, role: 'MANAGER' });
    expect(scope?.permissions).not.toContain('view_financials');
    expect(r.member).toMatchObject({ name: 'DBTEST Rahul', mobile: phone(10), role: 'MANAGER', jobTitle: 'Operations', seesMoney: false, canChange: true });
    // Once is enough: the same number again is refused.
    expect(await outcome(asOwner(() => team.add({ name: 'Again', mobile: phone(10), role: 'MANAGER' })))).toMatchObject({ name: 'ConflictError' });
  });

  test('a number that already signs in keeps its own code; an account with no code is NOT given one', async () => {
    const coded = await app.prisma.user.create({ data: { phone: phone(11), loginCodeHash: 'kept-hash', roles: { create: { role: 'VENDOR' } } } });
    const couple = await app.prisma.user.create({ data: { phone: phone(12), roles: { create: { role: 'CUSTOMER' } } } });
    expect(await asOwner(() => team.add({ name: 'Has a code', mobile: phone(11), role: 'EMPLOYEE' }))).toMatchObject({ kind: 'EXISTING_LOGIN' });
    expect((await app.prisma.user.findUniqueOrThrow({ where: { id: coded.id } })).loginCodeHash).toBe('kept-hash');
    const r = await asOwner(() => team.add({ name: 'A couple', mobile: phone(12), role: 'EMPLOYEE' }));
    expect(r).toMatchObject({ kind: 'NEEDS_CODE' });
    expect(r).not.toHaveProperty('code');
    const after = await app.prisma.user.findUniqueOrThrow({ where: { id: couple.id }, include: { roles: true } });
    expect(after.loginCodeHash).toBeNull();
    expect(after.name).toBeNull(); // the owner never renames someone else's account
    expect(after.roles.map((x) => x.role).sort()).toEqual(['CUSTOMER', 'VENDOR']);
  });

  test('change: role, job title and money; never an owner, never yourself, never another business’s member', async () => {
    const list = await asOwner(() => team.list());
    expect(list.members[0]).toMatchObject({ role: 'OWNER', isYou: true, canChange: false });
    const rahul = list.members.find((m) => m.name === 'DBTEST Rahul')!;
    const changed = await asOwner(() => team.change(rahul.id, { role: 'EMPLOYEE', jobTitle: 'Coordinator', seesMoney: true }));
    expect(changed).toMatchObject({ role: 'EMPLOYEE', jobTitle: 'Coordinator', seesMoney: true });
    const login = await app.prisma.user.findUniqueOrThrow({ where: { phone: phone(10) } });
    expect((await businessSvc.scopeForVendorLogin(login.id))?.permissions).toEqual(['view_financials']);
    expect(await outcome(asOwner(() => team.change(list.members[0].id, { role: 'MANAGER' })))).toMatchObject({ name: 'ConflictError' });
    expect(await outcome(runInScope(otherOwner, () => team.change(rahul.id, { role: 'MANAGER' })))).toMatchObject({ name: 'NotFoundError' });
  });

  test('someone without the team permission has no team; a manager given it cannot hand out money they do not have', async () => {
    const manager = { kind: 'BUSINESS' as const, businessId: owner.businessId, role: 'MANAGER' as const, permissions: ['enquiries', 'weddings'] as const, userId: users[0] };
    expect(await outcome(runInScope({ ...manager, permissions: [...manager.permissions] }, () => team.list()))).toMatchObject({ name: 'NotFoundError' });
    const withTeam = { ...manager, permissions: ['enquiries', 'weddings', 'team'] as ('enquiries' | 'weddings' | 'team')[], userId: 'someone-else' };
    expect(await runInScope(withTeam, () => team.add({ name: 'Money please', mobile: phone(13), role: 'EMPLOYEE', seesMoney: true }))).toEqual({ errors: { seesMoney: expect.any(String) } });
  });

  test('removed: their access to this business ends at once; adding them again brings them back', async () => {
    const login = await app.prisma.user.findUniqueOrThrow({ where: { phone: phone(10) } });
    const before = (await asOwner(() => team.list())).members;
    const rahul = before.find((m) => m.mobile === phone(10))!;
    expect(await outcome(asOwner(() => team.remove(before[0].id)))).toMatchObject({ name: 'ConflictError' }); // the owner themselves
    await asOwner(() => team.remove(rahul.id));
    expect(await businessSvc.scopeForVendorLogin(login.id)).toBeNull();
    expect((await asOwner(() => team.list())).members.some((m) => m.mobile === phone(10))).toBe(false);
    expect(await asOwner(() => team.add({ name: 'DBTEST Rahul', mobile: phone(10), role: 'MANAGER' }))).toMatchObject({ kind: 'EXISTING_LOGIN', member: { role: 'MANAGER' } });
    expect((await businessSvc.scopeForVendorLogin(login.id))?.role).toBe('MANAGER');
  });
  // 13 Oct 2026 — what Shaadi Shopping shares with a vendor (Today, Weddings, Services, Payments) is read for the vendor a person
  // is WORKING in, not the one they own.
  test('the vendor a person works in: a manager gets the owner’s vendor; an owner of another vendor gets the one they chose', async () => {
    const { PLATFORM_SCOPE } = await import('@/lib/ownership/scope');
    const { venuePortalService } = await import('@/services/venuePortal.service');
    const rahul = await app.prisma.user.findUniqueOrThrow({ where: { phone: phone(10) } });
    const asManager = await businessSvc.working(rahul.id);
    expect(asManager).toMatchObject({ businessId: businessIds[0], vendorId: vendorIds[0], role: 'MANAGER' });
    expect(asManager?.permissions).toContain('weddings');
    expect(asManager?.permissions).not.toContain('view_financials');

    // The owner of venue B also works in venue A.
    expect(await asOwner(() => team.add({ name: 'Owner of B', mobile: phone(1), role: 'EMPLOYEE' }))).toMatchObject({ kind: 'NEEDS_CODE' });
    expect(await businessSvc.working(users[1])).toBeNull(); // two businesses, none chosen
    expect(await businessSvc.working(users[1], businessIds[0])).toMatchObject({ vendorId: vendorIds[0], role: 'EMPLOYEE', permissions: [] });
    expect(await businessSvc.working(users[1], businessIds[1])).toMatchObject({ vendorId: vendorIds[1], role: 'OWNER' });
    expect(await businessSvc.working(users[1], 'not-a-business-of-theirs')).toBeNull();

    // The shared records are read by that vendor's id; without money nothing about payouts is read.
    const shared = await runInScope(PLATFORM_SCOPE, () => venuePortalService.getDashboard(vendorIds[0], { seesMoney: false }));
    expect(shared.vendor.id).toBe(vendorIds[0]);
    expect(shared).toMatchObject({ bookings: [], payouts: [] });
  });
});
