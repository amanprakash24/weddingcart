/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// The vendor login code, on a real database, through the real service and the real 5-wrong-tries lock: an admin issues a code for
// a vendor login, the vendor signs in with mobile + code, changes it, and a guesser is locked out. Only a hash is ever stored.
dbDescribe('vendor login code (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let codes: typeof import('@/services/vendorLoginCode.service').vendorLoginCodeService;
  let userId = '';
  let vendorId = '';
  let phone = '';
  let code = '';

  const outcome = (p: Promise<unknown>) => p.then(() => null, (e: Error) => e);
  const person = () => app.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const identifiers = () => [`vendor-code:${phone}`, `vendor-code-change:${userId}`];

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    codes = (await import('@/services/vendorLoginCode.service')).vendorLoginCodeService;
    // A vendor and a login of the test's own — never an existing vendor's row or number.
    const [{ id: anyVendorId }] = await fx.vendors(1);
    const { categoryId } = await app.prisma.vendor.findUniqueOrThrow({ where: { id: anyVendorId }, select: { categoryId: true } });
    const v = await app.prisma.vendor.create({ data: { slug: `dbtest-code-${fx.runId}`, name: `DBTEST Code Vendor ${fx.runId}`, categoryId, city: 'Patna', priceMin: 1, priceMax: 2, image: 'x', description: 'x' } });
    vendorId = v.id;
    phone = `93000${fx.runId.replace(/\D/g, '').padEnd(5, '0').slice(0, 5)}`;
    const u = await app.prisma.user.create({ data: { phone, roles: { create: { role: 'VENDOR' } } } });
    userId = u.id;
    await app.prisma.vendorProfile.create({ data: { userId, vendorId } });
  });

  afterAll(async () => {
    if (!app) return;
    await app.prisma.loginAttempt.deleteMany({ where: { identifier: { in: identifiers() } } });
    await app.prisma.vendorProfile.deleteMany({ where: { userId } });
    await app.prisma.user.deleteMany({ where: { id: userId } });
    await app.prisma.vendor.deleteMany({ where: { id: vendorId } });
    if (fx) await fx.purge();
  });

  test('a login with no code cannot sign in with one, and has nothing to be reminded about', async () => {
    expect(await codes.verify(phone, '482913')).toBeNull();
    expect(await codes.status(userId)).toEqual({ hasCode: false, setAt: null, reminder: false });
    await app.prisma.loginAttempt.deleteMany({ where: { identifier: { in: identifiers() } } });
  });

  test('an admin issues a code: it comes back once, only its hash is stored, and other devices are signed out', async () => {
    const before = await app.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { sessionVersion: true } });
    const issued = await codes.issue(vendorId);
    code = issued.code;
    expect(code).toMatch(/^\d{6}$/);
    expect(issued.mobile).toBe(phone);
    const row = await person();
    expect(row.loginCodeHash).toMatch(/^\$2[aby]\$/);
    expect(row.loginCodeHash).not.toContain(code);
    expect(row.loginCodeSetAt).toBeInstanceOf(Date);
    expect((await app.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { sessionVersion: true } })).sessionVersion).toBe(before.sessionVersion + 1);
  });

  test('the vendor signs in with the registered mobile number + the code — however the number is typed', async () => {
    const login = await codes.verify(`+91 ${phone.slice(0, 5)} ${phone.slice(5)}`, code);
    expect(login).toMatchObject({ id: userId, vendorId, roles: ['VENDOR'] });
    expect(await codes.status(userId)).toMatchObject({ hasCode: true, reminder: false });
  });

  test('the vendor changes the code: the old one stops working, the new one works, and they are not signed out', async () => {
    const wrong = code === '000417' ? '000418' : '000417';
    expect(await codes.change(userId, { current: wrong, next: '730518', confirm: '730518' })).toEqual({ errors: { current: 'That is not your current code' } });
    const next = code === '730518' ? '815204' : '730518';
    const before = await app.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { sessionVersion: true } });
    expect(await codes.change(userId, { current: code, next, confirm: next })).toEqual({ changed: true });
    expect(await codes.verify(phone, code)).toBeNull();
    code = next;
    expect((await codes.verify(phone, code))?.vendorId).toBe(vendorId);
    expect((await app.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { sessionVersion: true } })).sessionVersion).toBe(before.sessionVersion);
  });

  test('a code 30 days old brings the reminder', async () => {
    await app.prisma.user.update({ where: { id: userId }, data: { loginCodeSetAt: new Date(Date.now() - 31 * 86_400_000) } });
    expect((await codes.status(userId)).reminder).toBe(true);
  });

  test('five wrong codes lock the number for a while — after that even the right code is refused', async () => {
    await app.prisma.loginAttempt.deleteMany({ where: { identifier: { in: identifiers() } } });
    const wrong = code === '000417' ? '000418' : '000417';
    for (let i = 0; i < 5; i++) expect(await codes.verify(phone, wrong)).toBeNull();
    expect(await codes.verify(phone, code)).toBeNull();
    // An admin's new code does not lift the lock by itself; clearing the count (time passing) does.
    await app.prisma.loginAttempt.deleteMany({ where: { identifier: { in: identifiers() } } });
    expect((await codes.verify(phone, code))?.vendorId).toBe(vendorId);
  });

  test('a vendor with no login cannot be given a code', async () => {
    expect((await outcome(codes.issue('00000000-0000-0000-0000-000000000000')))?.name).toBe('NotFoundError');
  });
});
