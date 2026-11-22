/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Money access for a wedding that was made FROM A BOOKING (quotation → booking → 25 % paid → wedding). Such a wedding records only
// Wedding.sourceBookingId; its consultation's own `wedding` link stays empty. Found 22 Nov 2026 on WED-2026-0002: the salesperson
// the consultation was assigned to got 'none' on the wedding but 'full' on the same quotation. Both must follow the wedding's rules:
// coordinator 'full', the source's assignee 'read', anyone else 'none'.
dbDescribe('Money access: a wedding made from a booking (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let svc: typeof import('@/services/moneyAccess.service').moneyAccessService;
  const users: string[] = [];
  let seller = '';
  let other = '';

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    svc = (await import('@/services/moneyAccess.service')).moneyAccessService;
    for (const name of ['seller', 'other']) {
      const u = await app.prisma.user.create({ data: { name: `DBTEST ${name} ${fx.runId}`, roles: { create: [{ role: 'SALES' }] } } });
      users.push(u.id);
    }
    [seller, other] = users;
  });
  afterAll(async () => {
    if (fx) await fx.purge();
    if (app && users.length) {
      await app.prisma.userRole.deleteMany({ where: { userId: { in: users } } });
      await app.prisma.user.deleteMany({ where: { id: { in: users } } });
    }
  });

  test('assignee reads, coordinator changes, everyone else sees nothing — on the wedding AND on its quotation', async () => {
    const [{ id: vendorId }] = await fx.vendors(1);
    const c = await fx.consultation({ name: 'DBTEST money access booking', weddingDate: '2027-03-15', guestCount: 300 });
    await app.prisma.consultation.update({ where: { id: c.id }, data: { assignedToId: seller } });
    const q = await fx.acceptedQuote(c.id, { items: [fx.line('Decoration package', 85500, 1, vendorId, 'Decorators')], advance: 5000 });
    const booking = await app.quotationService.createBooking(q.id, {}, null);
    await app.commercialFlow.recordPaymentForQuotation(q.id, { amount: 21375, method: 'UPI' }, null);
    const wedding = await app.prisma.wedding.findFirstOrThrow({ where: { sourceBookingId: booking.id } });
    expect(wedding.sourceConsultationId).toBeNull(); // the shape that hid the assignee

    const as = (userId: string) => ({ userId, roles: ['SALES'] as never[] });
    expect(await svc.forWedding(as(seller), wedding.id)).toBe('read');
    expect(await svc.forQuotation(as(seller), q.id)).toBe('read'); // once the wedding exists, its rules apply to the quote too
    expect(await svc.forWedding(as(other), wedding.id)).toBe('none');
    expect(await svc.forQuotation(as(other), q.id)).toBe('none');

    await app.prisma.wedding.update({ where: { id: wedding.id }, data: { coordinatorId: seller } });
    expect(await svc.forWedding(as(seller), wedding.id)).toBe('full');
    expect(await svc.forQuotation(as(seller), q.id)).toBe('full');
    expect(await svc.forWedding(as(other), wedding.id)).toBe('none');
  });
});
