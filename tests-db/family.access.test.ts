/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Client OS → Family (23 Nov 2026) on a real database, on a paid Shaadi Shopping wedding shaped like WED-2026-0002.
// The couple adds family with a role; every couple route checks the role on the server; what a role may not see never leaves the server.
dbDescribe('Family access and permissions (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let family: typeof import('@/services/family.service').familyService;
  let asCouple: typeof import('@/lib/customer/coupleEntry').asCoupleWedding;
  let guests: typeof import('@/services/guest.service').guestService;
  const users: string[] = [];
  const phones: string[] = [];
  let couple = '';
  let staff = '';
  let weddingId = '';
  const member: Record<'FULL' | 'PLANNING' | 'VIEW', { userId: string; memberId: string }> = {} as never;

  const phone = (n: number) => {
    const p = `9${String(Date.now()).slice(-7)}${n}${Math.floor(Math.random() * 10)}`;
    phones.push(p);
    return p;
  };
  const errorOf = async (p: Promise<unknown>) => (await p.then(() => null, (e: Error) => e)) as Error | null;

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    family = (await import('@/services/family.service')).familyService;
    asCouple = (await import('@/lib/customer/coupleEntry')).asCoupleWedding;
    guests = (await import('@/services/guest.service')).guestService;
    couple = (await app.prisma.user.create({ data: { name: `DBTEST couple ${fx.runId}`, phone: phone(0), roles: { create: { role: 'CUSTOMER' } } } })).id;
    staff = (await app.prisma.user.create({ data: { name: `DBTEST staff ${fx.runId}`, phone: phone(1), roles: { create: { role: 'SALES' } } } })).id;
    users.push(couple, staff);
    const c = await fx.consultation({ name: 'DBTEST family', weddingDate: '2027-01-20', guestCount: 200 });
    const q = await fx.acceptedQuote(c.id, { items: [fx.line('Decoration package', 85500, 1, undefined, 'Decorators')], advance: 5000 });
    const booking = await app.quotationService.createBooking(q.id, {}, null);
    await app.commercialFlow.recordPaymentForQuotation(q.id, { amount: 21375, method: 'UPI' }, null);
    weddingId = (await app.prisma.wedding.findFirstOrThrow({ where: { sourceBookingId: booking.id } })).id;
    await app.prisma.wedding.update({ where: { id: weddingId }, data: { customerId: couple } });
    await app.prisma.guest.create({ data: { weddingId, name: 'Mausi ji', phone: '9811111111', email: 'mausi@example.com' } });
  });
  afterAll(async () => {
    if (fx) await fx.purge(); // the wedding goes, and its members with it (cascade)
    if (app) await app.prisma.user.deleteMany({ where: { OR: [{ id: { in: users } }, { phone: { in: phones } }] } });
  });

  test('the couple adds family: a new number gets a code once, which signs in; the change is in the history', async () => {
    for (const [i, role] of (['FULL', 'PLANNING', 'VIEW'] as const).entries()) {
      const mobile = phone(2 + i);
      const r = await asCouple(weddingId, couple, () => family.add(weddingId, { name: `DBTEST ${role}`, mobile, relation: 'Cousin', role }, couple), 'family');
      expect(r.code).toMatch(/^\d{6}$/);
      expect(r.member).toMatchObject({ role, relation: 'Cousin', mobile, signedInBefore: false });
      const u = await app.prisma.user.findUniqueOrThrow({ where: { phone: mobile }, select: { id: true, loginCodeHash: true, loginCodeGiven: true, roles: { select: { role: true } } } });
      expect(u.loginCodeGiven).toBe(true);
      expect(u.roles.map((x) => x.role)).toEqual(['CUSTOMER']);
      expect(await (await import('bcryptjs')).compare(r.code!, u.loginCodeHash!)).toBe(true);
      member[role] = { userId: u.id, memberId: r.member.id };
    }
    const log = await app.prisma.activityLog.findFirst({ where: { weddingId, summary: { contains: 'DBTEST VIEW' } } });
    expect(log?.performedById).toBe(couple);
    expect((await family.list(weddingId)).length).toBe(3);
  });

  test('adding: own number, a business sign-in, a duplicate and a bad role are refused; an existing couple login keeps its code', async () => {
    const own = await app.prisma.user.findUniqueOrThrow({ where: { id: couple }, select: { phone: true } });
    expect((await errorOf(family.add(weddingId, { name: 'Me', mobile: own.phone!, role: 'VIEW' }, couple)))?.message).toContain('your own number');
    const staffPhone = (await app.prisma.user.findUniqueOrThrow({ where: { id: staff }, select: { phone: true } })).phone!;
    expect((await errorOf(family.add(weddingId, { name: 'Staff', mobile: staffPhone, role: 'VIEW' }, couple)))?.message).toContain('business sign-in');
    const fullPhone = (await app.prisma.user.findUniqueOrThrow({ where: { id: member.FULL.userId }, select: { phone: true } })).phone!;
    expect((await errorOf(family.add(weddingId, { name: 'Again', mobile: fullPhone, role: 'VIEW' }, couple)))?.message).toContain('already in your family list');
    expect((await errorOf(family.add(weddingId, { name: 'Bad', mobile: phone(9), role: 'OWNER' }, couple)))?.name).toBe('ValidationError');
    // the staff user is unchanged (no customer role was added)
    expect((await app.prisma.userRole.findMany({ where: { userId: staff } })).map((r) => r.role)).toEqual(['SALES']);
    // a number with its own couple sign-in: linked, no new code, its code untouched
    const mobile = phone(8);
    const other = await app.prisma.user.create({ data: { name: 'DBTEST other couple', phone: mobile, loginCodeHash: 'kept-hash', roles: { create: { role: 'CUSTOMER' } } } });
    const r = await family.add(weddingId, { name: 'Other couple', mobile, role: 'VIEW' }, couple);
    expect(r.code).toBeNull();
    expect((await app.prisma.user.findUniqueOrThrow({ where: { id: other.id } })).loginCodeHash).toBe('kept-hash');
    await family.remove(weddingId, r.member.id, couple);
  });

  test('the permission matrix on the server: plan, money and family are checked per role', async () => {
    const run = (userId: string, need: 'view' | 'plan' | 'money' | 'family') => errorOf(asCouple(weddingId, userId, async () => 'ok', need));
    const name = async (userId: string, need: 'view' | 'plan' | 'money' | 'family') => (await run(userId, need))?.name ?? 'allowed';
    expect([await name(couple, 'view'), await name(couple, 'plan'), await name(couple, 'money'), await name(couple, 'family')]).toEqual(['allowed', 'allowed', 'allowed', 'allowed']);
    expect([await name(member.FULL.userId, 'view'), await name(member.FULL.userId, 'plan'), await name(member.FULL.userId, 'money'), await name(member.FULL.userId, 'family')]).toEqual(['allowed', 'allowed', 'allowed', 'ForbiddenError']);
    expect([await name(member.PLANNING.userId, 'view'), await name(member.PLANNING.userId, 'plan'), await name(member.PLANNING.userId, 'money'), await name(member.PLANNING.userId, 'family')]).toEqual(['allowed', 'allowed', 'ForbiddenError', 'ForbiddenError']);
    expect([await name(member.VIEW.userId, 'view'), await name(member.VIEW.userId, 'plan'), await name(member.VIEW.userId, 'money'), await name(member.VIEW.userId, 'family')]).toEqual(['allowed', 'ForbiddenError', 'ForbiddenError', 'ForbiddenError']);
    // no permission given = the couple only
    expect((await errorOf(asCouple(weddingId, member.FULL.userId, async () => 'ok')))?.name).toBe('ForbiddenError');
    // a stranger still gets "not found", never a hint the wedding exists
    expect((await run(staff, 'view'))?.name).toBe('NotFoundError');
  });

  test('what each role receives: money only with full access; guest contacts hidden from view-only', async () => {
    const eventOf = async (userId: string) => (await app.clientPortalService.getEventsForClient(userId)).find((e) => e.id === weddingId)!;
    const own = await eventOf(couple);
    expect(own.access).toMatchObject({ role: 'OWNER', canMoney: true, canFamily: true });
    expect(own.money.received).toBe(21375);

    const full = await eventOf(member.FULL.userId);
    expect(full.access).toMatchObject({ role: 'FULL', relation: 'Cousin', canMoney: true, canPlan: true, canFamily: false });
    expect(full.money.received).toBe(21375);
    expect(full.quotation).not.toBeNull();

    const planning = await eventOf(member.PLANNING.userId);
    expect(planning.access).toMatchObject({ role: 'PLANNING', canMoney: false, canPlan: true });
    expect(planning.money).toMatchObject({ agreed: 0, received: 0, receipts: [], claims: [] });
    expect([planning.quotation, planning.budget, planning.finance.invoices.length, planning.finance.payments.length, planning.documents.length, planning.approvals.length]).toEqual([null, null, 0, 0, 0, 0]);
    expect(JSON.stringify(planning)).not.toContain('21375');
    expect(planning.guests[0]).toMatchObject({ name: 'Mausi ji', phone: '9811111111' });

    const view = await eventOf(member.VIEW.userId);
    expect(view.access).toMatchObject({ role: 'VIEW', canMoney: false, canPlan: false });
    expect(view.guests[0]).toMatchObject({ name: 'Mausi ji', phone: null, email: null, rsvpToken: '' });
    expect(JSON.stringify(view)).not.toContain('9811111111');
    expect(JSON.stringify(view)).not.toContain('21375');

    // the guest list itself works for family (listForClient used to accept only the couple)
    expect((await guests.listForClient(weddingId, member.VIEW.userId)).length).toBe(1);
    expect((await errorOf(guests.listForClient(weddingId, staff)))?.name).toBe('NotFoundError');
  });

  test('changing a role takes effect at once; removing ends access but keeps their sign-in', async () => {
    await family.changeRole(weddingId, member.PLANNING.memberId, 'VIEW', couple);
    expect((await errorOf(asCouple(weddingId, member.PLANNING.userId, async () => 'ok', 'plan')))?.name).toBe('ForbiddenError');
    expect((await errorOf(family.changeRole(weddingId, member.PLANNING.memberId, 'OWNER', couple)))?.name).toBe('ValidationError');
    await family.remove(weddingId, member.VIEW.memberId, couple);
    expect((await errorOf(asCouple(weddingId, member.VIEW.userId, async () => 'ok', 'view')))?.name).toBe('NotFoundError');
    expect(await app.clientPortalService.getEventsForClient(member.VIEW.userId)).toEqual([]);
    expect(await app.prisma.user.count({ where: { id: member.VIEW.userId } })).toBe(1);
    expect((await app.prisma.activityLog.findFirst({ where: { weddingId, summary: { contains: 'removed DBTEST VIEW' } } }))?.performedById).toBe(couple);
    // a member of another wedding's family list cannot be changed through this wedding
    expect((await errorOf(family.remove('00000000-0000-0000-0000-000000000000', member.FULL.memberId, couple)))?.name).toBe('NotFoundError');
  });
});
