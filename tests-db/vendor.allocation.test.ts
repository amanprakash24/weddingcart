/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';
import { quotedPriceFromTask } from '@/lib/booking/unassigned';

// Vendor budgets come from what was AGREED, not the full line prices (22 Nov 2026, found on WED-2026-0002: "₹3,20,000 to allocate" on an
// ₹85,500 deal). A quotation with a discount becomes a wedding whose vendor bookings and "assign a vendor" amounts add up to the agreed
// amount before tax — to the rupee.
dbDescribe('Vendor allocation follows the agreed amount (real database)', () => {
  let app: App;
  let fx: Fixtures;

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
  });
  afterAll(async () => {
    if (fx) await fx.purge();
  });

  async function weddingFrom(items: ReturnType<Fixtures['line']>[], discount: number, advance: number) {
    const c = await fx.consultation({ name: 'DBTEST allocation', weddingDate: '2027-02-10', guestCount: 500 });
    const q = await fx.acceptedQuote(c.id, { items, discount, advance });
    const booking = await app.quotationService.createBooking(q.id, {}, null);
    const money = await app.agreement.loadAgreementMoney(q.id);
    await app.commercialFlow.recordPaymentForQuotation(q.id, { amount: money.confirmationAmount, method: 'UPI' }, null);
    return app.prisma.wedding.findFirstOrThrow({ where: { sourceBookingId: booking.id } });
  }
  const vendorRows = (weddingId: string) => app.prisma.vendorBooking.findMany({ where: { weddingEvent: { weddingId } }, select: { agreedPrice: true } });
  const assignTasks = (weddingId: string) => app.prisma.task.findMany({ where: { weddingId, title: { startsWith: 'Assign a vendor for' } }, select: { description: true } });

  test('a ₹10,000 discount on ₹4,40,000 of lines: the vendor gets ₹3,90,909, the custom line ₹39,091 — together exactly ₹4,30,000', async () => {
    const [vendor] = await fx.vendors(1);
    const w = await weddingFrom([fx.line('Catering per plate', 800, 500, vendor.id), fx.line('Custom stage', 40000, 1, undefined, 'Decorators')], 10000, 100000);
    const vb = await vendorRows(w.id);
    const tasks = await assignTasks(w.id);
    expect(vb.map((v) => v.agreedPrice)).toEqual([390909]);
    expect(tasks.map((t) => quotedPriceFromTask(t.description))).toEqual([39091]);
    expect(vb[0].agreedPrice + quotedPriceFromTask(tasks[0].description)!).toBe(430000);
    expect(tasks[0].description).toContain('₹40,000 before the discount');
    const log = await app.prisma.activityLog.findFirst({ where: { weddingId: w.id, summary: { startsWith: 'No vendor assigned yet for "Custom stage"' } } });
    expect(log?.summary).toContain('₹39,091 to allocate (₹40,000 before the discount)');
  });

  test('WED-2026-0002 shape: ₹5,17,500 of lines, ₹4,32,000 off — the nine services add up to ₹85,500, not ₹5,17,500', async () => {
    const lines = [
      ['Main Gate + Passage Artificial Decorators', 40000, 8],
      ['Tilak Backdrop', 12000, 1],
      ['Haldi Decoration Natural Flower', 12000, 1],
      ['Lights', 10000, 1],
      ['Selfie Point', 0, 8],
      ['1st Floor Stairs + Doors + Gates Deoration', 6000, 8],
      ['2nd Floor Stairs + Doors + Gates Deoration', 6000, 8],
      ['1 Car Light Decoration', 4500, 1],
      ['Wedding Planning & Coordination', 21000, 3],
    ] as const;
    const w = await weddingFrom(lines.map(([name, price, qty]) => fx.line(name, price, qty, undefined, 'Decorators')), 432000, 5000);
    const amounts = (await assignTasks(w.id)).map((t) => quotedPriceFromTask(t.description) ?? 0);
    expect(amounts.length).toBe(9);
    expect(amounts.reduce((s, a) => s + a, 0)).toBe(85500);
    expect(Math.max(...amounts)).toBe(52870); // the main gate, not ₹3,20,000
  });

  test('no discount: budgets are the line prices, exactly as before', async () => {
    const [vendor] = await fx.vendors(1);
    const w = await weddingFrom([fx.line('Banquet hall hire', 200000, 1, vendor.id, 'Venue')], 0, 50000);
    expect((await vendorRows(w.id)).map((v) => v.agreedPrice)).toEqual([200000]);
  });
});
