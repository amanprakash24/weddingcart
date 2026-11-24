/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Client OS → Checklist & Budget (25 Nov 2026) on a real database, on a paid Shaadi Shopping wedding shaped like WED-2026-0002.
dbDescribe('Couple checklist and budget (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let list: typeof import('@/services/coupleChecklistBudget.service').coupleChecklistService;
  let budget: typeof import('@/services/coupleChecklistBudget.service').coupleBudgetService;
  let asCouple: typeof import('@/lib/customer/coupleEntry').asCoupleWedding;
  let family: typeof import('@/services/family.service').familyService;
  const phones: string[] = [];
  let couple = '';
  let weddingId = '';
  const phone = (n: number) => { const p = `9${String(Date.now()).slice(-7)}${n}${Math.floor(Math.random() * 10)}`; phones.push(p); return p; };
  const errorOf = async (p: Promise<unknown>) => (await p.then(() => null, (e: Error) => e)) as Error | null;

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    const svc = await import('@/services/coupleChecklistBudget.service');
    list = svc.coupleChecklistService;
    budget = svc.coupleBudgetService;
    asCouple = (await import('@/lib/customer/coupleEntry')).asCoupleWedding;
    family = (await import('@/services/family.service')).familyService;
    couple = (await app.prisma.user.create({ data: { name: `DBTEST couple ${fx.runId}`, phone: phone(0), roles: { create: { role: 'CUSTOMER' } } } })).id;
    const c = await fx.consultation({ name: 'DBTEST checklist', weddingDate: '2027-03-20', guestCount: 200 });
    const q = await fx.acceptedQuote(c.id, { items: [fx.line('Decoration package', 85500, 1, undefined, 'Decorators')], advance: 5000 });
    const booking = await app.quotationService.createBooking(q.id, {}, null);
    await app.commercialFlow.recordPaymentForQuotation(q.id, { amount: 21375, method: 'UPI' }, null);
    weddingId = (await app.prisma.wedding.findFirstOrThrow({ where: { sourceBookingId: booking.id } })).id;
    await app.prisma.wedding.update({ where: { id: weddingId }, data: { customerId: couple } });
  });
  afterAll(async () => {
    if (fx) await fx.purge();
    if (app) await app.prisma.user.deleteMany({ where: { phone: { in: phones } } });
  });

  test('the ready-made list is added once; a removed item stays removed; ticking works', async () => {
    const first = await asCouple(weddingId, couple, () => list.list(weddingId), 'view');
    expect(first.length).toBeGreaterThan(15);
    expect(first.every((i) => i.ready)).toBe(true);
    const again = await list.list(weddingId);
    expect(again.length).toBe(first.length); // no duplicates on a second read
    const venue = first.find((i) => i.title.startsWith('Book the venue'))!;
    await asCouple(weddingId, couple, () => list.remove(weddingId, venue.id), 'plan');
    const after = await list.list(weddingId);
    expect(after.some((i) => i.id === venue.id)).toBe(false);
    expect(after.length).toBe(first.length - 1); // not added back
    const ticked = await asCouple(weddingId, couple, () => list.setDone(weddingId, after[0].id, true, couple), 'plan');
    expect(ticked).toMatchObject({ done: true });
    expect(ticked.doneAt).not.toBeNull();
    const own = await asCouple(weddingId, couple, () => list.add(weddingId, { title: 'DBTEST buy the sehra', dueDate: '2027-03-10' }, couple), 'plan');
    expect(own).toMatchObject({ ready: false, dueDate: '2027-03-10' });
    await list.remove(weddingId, own.id);
    expect(await app.prisma.coupleChecklistItem.count({ where: { id: own.id } })).toBe(0); // the couple's own item is deleted
    const other = await app.prisma.weddingEvent.findFirst({ where: { weddingId: { not: weddingId } }, select: { id: true } });
    if (other) expect((await errorOf(list.add(weddingId, { title: 'x', weddingEventId: other.id }, couple)))?.message).toContain('your functions');
  });

  test('budget: their own total, plan and expenses, against what is booked and paid with us', async () => {
    await asCouple(weddingId, couple, () => budget.setTotal(weddingId, '5,00,000', couple), 'money');
    await budget.setPlanned(weddingId, 'OUTFITS', 150000);
    await budget.addExpense(weddingId, { category: 'OUTFITS', title: 'DBTEST lehenga', amount: 85000, paid: 20000 }, couple);
    expect((await errorOf(budget.addExpense(weddingId, { category: 'OUTFITS', title: 'x', amount: 100, paid: 200 }, couple)))?.name).toBe('ValidationError');
    const [event] = await app.clientPortalService.getEventsForClient(couple);
    expect(event.coupleBudget?.summary).toMatchObject({ total: 500000, committed: 85500 + 85000, paid: 21375 + 20000, left: 500000 - 170500 });
    expect(event.coupleBudget?.summary.categories).toEqual([{ category: 'OUTFITS', label: 'Outfits', planned: 150000, spent: 85000 }]);
    // nothing of ours changed
    expect(event.money.received).toBe(21375);
    expect(event.money.agreed).toBe(85500);
    await budget.setPlanned(weddingId, 'OUTFITS', '');
    expect(await app.prisma.coupleBudgetCategory.count({ where: { weddingId } })).toBe(0);
  });

  test('family: view-only sees the checklist but cannot change it; without payments there is no budget at all', async () => {
    const view = await family.add(weddingId, { name: 'DBTEST viewer', mobile: phone(1), role: 'VIEW' }, couple);
    const planner = await family.add(weddingId, { name: 'DBTEST planner', mobile: phone(2), role: 'PLANNING' }, couple);
    const viewer = (await app.prisma.weddingMember.findUniqueOrThrow({ where: { id: view.member.id } })).userId;
    const helper = (await app.prisma.weddingMember.findUniqueOrThrow({ where: { id: planner.member.id } })).userId;
    expect((await asCouple(weddingId, viewer, () => list.list(weddingId), 'view')).length).toBeGreaterThan(0);
    expect((await errorOf(asCouple(weddingId, viewer, async () => 'x', 'plan')))?.name).toBe('ForbiddenError');
    expect(await asCouple(weddingId, helper, async () => 'ok', 'plan')).toBe('ok');
    expect((await errorOf(asCouple(weddingId, helper, async () => 'x', 'money')))?.name).toBe('ForbiddenError');
    const seen = (await app.clientPortalService.getEventsForClient(helper)).find((e) => e.id === weddingId)!;
    expect(seen.coupleBudget).toBeNull();
    expect(JSON.stringify(seen)).not.toContain('DBTEST lehenga');
  });
});
