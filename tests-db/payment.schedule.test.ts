/// <reference types="bun-types" />
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { runAsSystem, runInScope, type Scope } from '@/lib/ownership/scope';
import { dbDescribe, loadApp, tally, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Payment schedule (22 Nov 2026) against a real database. The shape of WED-2026-0002: ₹85,500 accepted, 25 % = ₹21,375 confirms the
// booking, the balance of ₹64,125 is split into dated instalments.
// Integration: a payment recorded by staff must show up against the right instalment for staff (schedule view) AND the couple (My
// Wedding), and the two must agree with the agreement's own outstanding balance.
dbDescribe('Payment schedule (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let vendorId = '';
  let staffId = '';
  let venueBusinessId = '';
  let customerId = '';

  const errorOf = async (p: Promise<unknown>) => (await p.then(() => null, (e: Error) => e)) as Error | null;
  const PLAN = [
    { label: 'Before the wedding', amount: 40000, dueDate: '2027-03-10' },
    { label: 'On the wedding day', amount: 24125, dueDate: '2027-03-15' },
  ];

  async function booked(name: string) {
    const c = await fx.consultation({ name: `DBTEST ${name}`, weddingDate: '2027-03-15', guestCount: 300 });
    const q = await fx.acceptedQuote(c.id, { items: [fx.line('Decoration package', 85500, 1, vendorId, 'Decorators')], advance: 5000 });
    const booking = await app.quotationService.createBooking(q.id, {}, null);
    return { consultation: c, quotation: q, booking };
  }

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    [{ id: vendorId }] = await fx.vendors(1);
    const staff = await app.prisma.user.findFirst({ where: { roles: { some: { role: { in: ['SUPER_ADMIN', 'SALES', 'OPERATIONS'] } } } }, select: { id: true } });
    if (!staff) throw new Error('the test database needs at least one staff user');
    staffId = staff.id;
  });
  afterAll(async () => {
    if (!app) return;
    if (venueBusinessId) await app.prisma.business.deleteMany({ where: { id: venueBusinessId } });
    if (fx) await fx.purge();
    if (customerId) await app.prisma.user.deleteMany({ where: { id: customerId } });
  });

  describe('saving', () => {
    test('instalments that add up to the balance exactly are saved, in order, with the version bumped and the change in the history', async () => {
      const { quotation, consultation } = await booked('Schedule A');
      const before = await app.paymentScheduleService.get(quotation.id);
      expect(before).toMatchObject({ exists: true, version: 0, agreementTotal: 85500, confirmationAmount: 21375, balance: 64125, instalments: [] });

      const after = await app.paymentScheduleService.set(quotation.id, { instalments: PLAN, expectedVersion: 0 }, staffId);
      expect(after.version).toBe(1);
      expect(after.instalments).toEqual(PLAN);
      const rows = await app.prisma.paymentInstalment.findMany({ where: { agreement: { quotationId: quotation.id } }, orderBy: { sortOrder: 'asc' } });
      expect(rows.map((r) => [r.sortOrder, r.amount, r.dueDate.toISOString().slice(0, 10), r.createdById])).toEqual([
        [1, 40000, '2027-03-10', staffId],
        [2, 24125, '2027-03-15', staffId],
      ]);
      // reconciles: booking amount + instalments = the accepted total
      expect(after.confirmationAmount + rows.reduce((s, r) => s + r.amount, 0)).toBe(85500);
      const log = await app.prisma.activityLog.findFirst({ where: { consultationId: consultation.id, summary: { startsWith: 'Payment schedule set' } } });
      expect(log?.performedById).toBe(staffId);
      expect(log?.summary).toContain('Before the wedding ₹40,000');
    });

    test('₹1 short or ₹1 over is refused and nothing changes', async () => {
      const { quotation } = await booked('Schedule B');
      await app.paymentScheduleService.set(quotation.id, { instalments: PLAN, expectedVersion: 0 }, staffId);
      for (const last of [24124, 24126]) {
        const err = await errorOf(app.paymentScheduleService.set(quotation.id, { instalments: [PLAN[0], { ...PLAN[1], amount: last }], expectedVersion: 1 }, staffId));
        expect(err?.name).toBe('ValidationError');
      }
      const now = await app.paymentScheduleService.get(quotation.id);
      expect(now.version).toBe(1);
      expect(now.instalments).toEqual(PLAN);
    });

    test('bad dates, zero amounts and out-of-order dates are refused by the server, not only the screen', async () => {
      const { quotation } = await booked('Schedule C');
      const bad = [
        [{ label: 'X', amount: 64125, dueDate: '2027-02-30' }],
        [{ label: 'X', amount: 0, dueDate: '2027-03-01' }, { label: 'Y', amount: 64125, dueDate: '2027-03-02' }],
        [{ label: 'X', amount: 40000, dueDate: '2027-03-15' }, { label: 'Y', amount: 24125, dueDate: '2027-03-10' }],
        [{ label: ' ', amount: 64125, dueDate: '2027-03-01' }],
      ];
      for (const instalments of bad) expect((await errorOf(app.paymentScheduleService.set(quotation.id, { instalments, expectedVersion: 0 }, staffId)))?.name).toBe('ValidationError');
      expect(await app.prisma.paymentInstalment.count({ where: { agreement: { quotationId: quotation.id } } })).toBe(0);
    });

    test('a save from an out-of-date screen is refused (409) and the newer schedule is kept', async () => {
      const { quotation } = await booked('Schedule D');
      await app.paymentScheduleService.set(quotation.id, { instalments: PLAN, expectedVersion: 0 }, staffId);
      const err = await errorOf(app.paymentScheduleService.set(quotation.id, { instalments: [{ label: 'All at once', amount: 64125, dueDate: '2027-03-01' }], expectedVersion: 0 }, staffId));
      expect(err?.name).toBe('ConflictError');
      expect((await app.paymentScheduleService.get(quotation.id)).instalments).toEqual(PLAN);
    });

    test('two people saving at the same moment: exactly one wins, the other is told to reload — never a mixed schedule', async () => {
      const { quotation } = await booked('Schedule E');
      const a = [{ label: 'A1', amount: 30000, dueDate: '2027-03-01' }, { label: 'A2', amount: 34125, dueDate: '2027-03-10' }];
      const b = [{ label: 'B1', amount: 64125, dueDate: '2027-03-05' }];
      const results = await Promise.allSettled([
        app.paymentScheduleService.set(quotation.id, { instalments: a, expectedVersion: 0 }, staffId),
        app.paymentScheduleService.set(quotation.id, { instalments: b, expectedVersion: 0 }, staffId),
      ]);
      const t = tally(results);
      expect(t).toMatchObject({ ok: 1, conflicts: 1, other: [] });
      const now = await app.paymentScheduleService.get(quotation.id);
      expect(now.version).toBe(1);
      expect([JSON.stringify(a), JSON.stringify(b)]).toContain(JSON.stringify(now.instalments));
    });

    test('clearing the schedule is allowed (no dates set yet)', async () => {
      const { quotation } = await booked('Schedule F');
      await app.paymentScheduleService.set(quotation.id, { instalments: PLAN, expectedVersion: 0 }, staffId);
      const cleared = await app.paymentScheduleService.set(quotation.id, { instalments: [], expectedVersion: 1 }, staffId);
      expect(cleared).toMatchObject({ version: 2, instalments: [] });
    });

    test('no agreement yet (quotation only sent): nothing can be scheduled', async () => {
      const c = await fx.consultation({ name: 'DBTEST Schedule G', weddingDate: '2027-03-15', guestCount: 100 });
      const q = await fx.sentQuote(c.id, { items: [fx.line('Hall', 50000, 1, vendorId, 'Venue')], advance: 5000 });
      expect((await app.paymentScheduleService.get(q.id)).exists).toBe(false);
      expect((await errorOf(app.paymentScheduleService.set(q.id, { instalments: [], expectedVersion: 0 }, staffId)))?.name).toBe('ConflictError');
    });
  });

  describe('connected to payments, the staff money card and the couple', () => {
    test('payments fill the booking amount first, then the instalments; staff view, couple view and the agreement all agree', async () => {
      const { quotation, booking } = await booked('Schedule H');
      await app.paymentScheduleService.set(quotation.id, { instalments: PLAN, expectedVersion: 0 }, staffId);

      // ₹21,375 confirms the booking (the wedding is created), then ₹30,000 more
      await app.commercialFlow.recordPaymentForQuotation(quotation.id, { amount: 21375, method: 'UPI' }, staffId);
      await app.commercialFlow.recordPaymentForQuotation(quotation.id, { amount: 30000, method: 'CASH' }, staffId);

      const staff = await app.paymentScheduleService.get(quotation.id);
      expect(staff.received).toBe(51375);
      expect(staff.steps.map((s) => [s.label, s.amount, s.paid, s.remaining])).toEqual([
        ['Booking amount', 21375, 21375, 0],
        ['Before the wedding', 40000, 30000, 10000],
        ['On the wedding day', 24125, 0, 24125],
      ]);
      const money = await app.agreement.loadAgreementMoney(quotation.id);
      expect(staff.steps.reduce((s, x) => s + x.remaining, 0)).toBe(money.outstanding);

      // The couple's My Wedding: link a customer to the wedding and read it as they would
      const wedding = await app.prisma.wedding.findFirstOrThrow({ where: { sourceBookingId: booking.id } });
      customerId = (await app.prisma.user.create({ data: { name: 'DBTEST couple', phone: `98${String(Date.now()).slice(-8)}` } })).id;
      await app.prisma.wedding.update({ where: { id: wedding.id }, data: { customerId } });
      const [event] = await app.clientPortalService.getEventsForClient(customerId);
      expect(event.money.plan.scheduled).toBe(true);
      expect(event.money.plan.steps.map((s) => [s.amount, s.paid, s.dueDate])).toEqual([
        [21375, 21375, null],
        [40000, 30000, '2027-03-10'],
        [24125, 0, '2027-03-15'],
      ]);
      expect(event.money.plan.next).toEqual({ amount: 10000, label: 'Before the wedding', dueDate: '2027-03-10' });
      expect(event.money.due).toBe(money.outstanding);
      expect(event.money.receipts.map((r) => r.amount)).toEqual([21375, 30000]);
    });
  });

  test('ownership: a venue cannot read or change Shaadi Shopping’s schedule', async () => {
    const { quotation } = await booked('Schedule I');
    await app.paymentScheduleService.set(quotation.id, { instalments: PLAN, expectedVersion: 0 }, staffId);
    venueBusinessId = (await app.prisma.business.create({ data: { name: `DBTEST Venue ${fx.runId}`, kind: 'VENDOR', commercialStatus: 'SAAS' } })).id;
    const venue: Scope = { kind: 'BUSINESS', businessId: venueBusinessId, role: 'OWNER' };
    await runInScope(venue, async () => {
      expect((await errorOf(app.paymentScheduleService.get(quotation.id)))?.name).toBe('NotFoundError');
      expect(await app.prisma.paymentInstalment.count({ where: { agreement: { quotationId: quotation.id } } })).toBe(0);
      const err = await errorOf(app.paymentScheduleService.set(quotation.id, { instalments: [{ label: 'Hijack', amount: 64125, dueDate: '2027-03-01' }], expectedVersion: 1 }, null));
      expect(err).not.toBeNull();
    });
    const still = await runAsSystem('test check', () => app.paymentScheduleService.get(quotation.id));
    expect(still.instalments).toEqual(PLAN);
  });
});
