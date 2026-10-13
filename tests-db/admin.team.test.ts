/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// "Our team" on a real database (13 Oct 2026): the founder adds Shaadi Shopping's own people. A new person's code really signs in
// with their role; a number that is already somebody's login is never handed the Command Center; a founder's sign-in is not
// touched from here; removing someone ends their access and signs them out. Only a founder may do any of it.
dbDescribe('Our team (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let team: ReturnType<typeof import('@/services/adminTeam.service').createAdminTeamService>;
  let codes: typeof import('@/services/vendorLoginCode.service').vendorLoginCodeService;
  let founderId = '';
  let secondFounderId = '';
  const phone = (n: number) => `96${fx.runId.replace(/\D/g, '').padEnd(6, '0').slice(0, 6)}${String(n).padStart(2, '0')}`;
  const outcome = (p: Promise<unknown>) => p.then(() => null, (e: Error) => e);
  const person = (mobile: string) => app.prisma.user.findUniqueOrThrow({ where: { phone: mobile }, include: { roles: true, businessMemberships: true } });

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    const svc = await import('@/services/adminTeam.service');
    const { hashLoginCode } = await import('@/services/vendorLoginCode.service');
    let n = 0;
    team = svc.createAdminTeamService({ db: app.prisma, hash: hashLoginCode, newCode: () => `57310${n++ % 10}`, now: () => new Date() });
    codes = (await import('@/services/vendorLoginCode.service')).vendorLoginCodeService;
    founderId = (await app.prisma.user.create({ data: { phone: phone(0), roles: { create: { role: 'SUPER_ADMIN' } } } })).id;
    secondFounderId = (await app.prisma.user.create({ data: { phone: phone(1), name: 'DBTEST Second Founder', loginCodeHash: 'kept-hash', roles: { create: { role: 'SUPER_ADMIN' } } } })).id;
  });

  afterAll(async () => {
    if (!app) return;
    const all = await app.prisma.user.findMany({ where: { phone: { startsWith: phone(0).slice(0, 8) } }, select: { id: true, phone: true } });
    await app.prisma.loginAttempt.deleteMany({ where: { identifier: { in: all.map((u) => `vendor-code:${u.phone}`) } } });
    await app.prisma.user.deleteMany({ where: { id: { in: all.map((u) => u.id) } } }); // roles and memberships go with them
  });

  test('the founder adds a person: a login is made, its code really signs in with the role, and they are in the Shaadi Shopping business', async () => {
    expect(await team.add(founderId, { name: 'x', mobile: '123', role: 'SUPER_ADMIN' })).toEqual({ errors: { name: expect.any(String), mobile: expect.any(String), role: expect.any(String) } });
    const r = await team.add(founderId, { name: '  DBTEST   Meera ', mobile: phone(10), role: 'SALES' });
    if ('errors' in r) throw new Error(JSON.stringify(r));
    expect(r.code).toMatch(/^\d{6}$/);
    expect(r.member).toMatchObject({ name: 'DBTEST Meera', mobile: phone(10), role: 'SALES', hasCode: true, hasPassword: false, isYou: false, canManage: true });
    const login = await codes.verify(phone(10), r.code);
    expect(login?.roles).toEqual(['SALES']);
    const row = await person(phone(10));
    expect(row.loginCodeHash).not.toContain(r.code);
    expect(row.businessMemberships).toMatchObject([{ businessId: 'shaadi-shopping', role: 'MANAGER', removedAt: null }]);
    expect(await outcome(team.add(founderId, { name: 'Again', mobile: phone(10), role: 'SALES' }))).toMatchObject({ name: 'ConflictError' });
  });

  test('a number that is already somebody’s login is never given the Command Center', async () => {
    const vendor = await app.prisma.user.create({ data: { phone: phone(11), loginCodeHash: 'vendor-hash', roles: { create: { role: 'VENDOR' } } } });
    const couple = await app.prisma.user.create({ data: { phone: phone(12), roles: { create: { role: 'CUSTOMER' } } } });
    for (const u of [vendor, couple]) {
      expect(await outcome(team.add(founderId, { name: 'DBTEST Taken', mobile: u.phone, role: 'OPERATIONS' }))).toMatchObject({ name: 'ConflictError' });
      const after = await app.prisma.user.findUniqueOrThrow({ where: { id: u.id }, include: { roles: true, businessMemberships: true } });
      expect(after).toMatchObject({ name: null, loginCodeHash: u.loginCodeHash });
      expect(after.roles).toHaveLength(1);
      expect(after.businessMemberships).toEqual([]);
    }
  });

  test('the list: founders first, yourself marked; a name for anyone — the founder’s own included', async () => {
    const list = (await team.list(founderId)).filter((m) => m.mobile?.startsWith(phone(0).slice(0, 8)));
    expect(list.map((m) => m.role)).toEqual(['SUPER_ADMIN', 'SUPER_ADMIN', 'SALES']);
    expect(list.find((m) => m.isYou)).toMatchObject({ id: founderId, name: null, canManage: false });
    expect(await team.rename(founderId, founderId, ' ')).toEqual({ errors: { name: expect.any(String) } });
    expect(await team.rename(founderId, founderId, ' Gaurav   Sudhanshu ')).toMatchObject({ name: 'Gaurav Sudhanshu', isYou: true });
    const meera = await person(phone(10));
    expect(await team.rename(founderId, meera.id, 'Meera Singh')).toMatchObject({ name: 'Meera Singh', role: 'SALES' });
    // Someone who is not on the team cannot be named from here.
    const vendor = await person(phone(11));
    expect((await outcome(team.rename(founderId, vendor.id, 'Renamed')))?.name).toBe('NotFoundError');
    expect((await person(phone(11))).name).toBeNull();
  });

  test('role, a corrected mobile number and a new code — each signs the person out; the old code stops working', async () => {
    const meera = await person(phone(10));
    expect(await team.setRole(founderId, meera.id, 'SUPER_ADMIN')).toEqual({ errors: { role: expect.any(String) } });
    expect(await team.setRole(founderId, meera.id, 'OPERATIONS')).toMatchObject({ role: 'OPERATIONS' });
    expect((await person(phone(10))).roles.map((r) => r.role)).toEqual(['OPERATIONS']);

    expect(await team.issueCode(founderId, meera.id, phone(11))).toEqual({ errors: { mobile: expect.any(String) } }); // somebody's login
    expect(await team.issueCode(founderId, meera.id, '12')).toEqual({ errors: { mobile: expect.any(String) } });
    const before = await person(phone(10));
    const moved = await team.issueCode(founderId, meera.id, phone(13));
    if ('errors' in moved) throw new Error(JSON.stringify(moved));
    expect(moved.member).toMatchObject({ mobile: phone(13), role: 'OPERATIONS' });
    const after = await person(phone(13));
    expect(after.id).toBe(meera.id);
    expect(after.sessionVersion).toBeGreaterThan(before.sessionVersion);
    expect((await codes.verify(phone(13), moved.code))?.roles).toEqual(['OPERATIONS']);
    expect(await app.prisma.user.findUnique({ where: { phone: phone(10) } })).toBeNull();

    // The same number again: only a new code.
    const again = await team.issueCode(founderId, meera.id);
    if ('errors' in again) throw new Error(JSON.stringify(again));
    expect(again.code).not.toBe(moved.code);
    expect(await codes.verify(phone(13), moved.code)).toBeNull();
    expect(await codes.verify(phone(13), again.code)).not.toBeNull();
  });

  test('a founder’s sign-in is not touched from here — not another founder’s, not your own', async () => {
    for (const id of [secondFounderId, founderId]) {
      expect((await outcome(team.issueCode(founderId, id, phone(14))))?.name).toBe('ConflictError');
      expect((await outcome(team.setRole(founderId, id, 'SALES')))?.name).toBe('ConflictError');
      expect((await outcome(team.remove(founderId, id)))?.name).toBe('ConflictError');
    }
    const second = await app.prisma.user.findUniqueOrThrow({ where: { id: secondFounderId }, include: { roles: true } });
    expect(second).toMatchObject({ phone: phone(1), loginCodeHash: 'kept-hash' });
    expect(second.roles.map((r) => r.role)).toEqual(['SUPER_ADMIN']);
  });

  test('only a founder: Sales, a vendor and nobody at all are refused everything', async () => {
    const meera = await person(phone(13));
    const vendor = await person(phone(11));
    for (const actor of [meera.id, vendor.id, '00000000-0000-4000-8000-000000000000']) {
      expect((await outcome(team.list(actor)))?.name).toBe('NotFoundError');
      expect((await outcome(team.add(actor, { name: 'DBTEST Nope', mobile: phone(15), role: 'SALES' })))?.name).toBe('NotFoundError');
      expect((await outcome(team.rename(actor, meera.id, 'Nope')))?.name).toBe('NotFoundError');
      expect((await outcome(team.issueCode(actor, meera.id)))?.name).toBe('NotFoundError');
      expect((await outcome(team.remove(actor, meera.id)))?.name).toBe('NotFoundError');
    }
    expect(await app.prisma.user.findUnique({ where: { phone: phone(15) } })).toBeNull();
  });

  test('removed: no team role, membership closed, signed out — and adding them again brings them back with a new code', async () => {
    const before = await person(phone(13));
    expect(await team.remove(founderId, before.id)).toEqual({ removed: true });
    const gone = await person(phone(13));
    expect(gone.roles).toEqual([]);
    expect(gone.businessMemberships[0].removedAt).not.toBeNull();
    expect(gone.sessionVersion).toBeGreaterThan(before.sessionVersion);
    expect((await team.list(founderId)).some((m) => m.id === before.id)).toBe(false);
    expect((await outcome(team.rename(founderId, before.id, 'Still here')))?.name).toBe('NotFoundError');

    const back = await team.add(founderId, { name: 'DBTEST Meera Again', mobile: phone(13), role: 'SALES' });
    if ('errors' in back) throw new Error(JSON.stringify(back));
    expect(back.member).toMatchObject({ id: before.id, name: 'DBTEST Meera Again', role: 'SALES' });
    expect((await codes.verify(phone(13), back.code))?.roles).toEqual(['SALES']);
    expect((await person(phone(13))).businessMemberships[0].removedAt).toBeNull();
  });
});
