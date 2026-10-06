/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Record ownership, Phase A (docs/wedding-os/15-record-ownership.md): on a real database, the platform business exists exactly once
// and everything the app creates today — unchanged code — belongs to it, all the way from the enquiry to the wedding's money.
dbDescribe('record ownership — Phase A foundation (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let consultationId = '';
  let weddingId = '';

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    consultationId = (await fx.consultation({ weddingDate: '2026-12-05' })).id;
    const { booking } = await fx.confirmedBooking(consultationId);
    weddingId = (await app.convertBookingToWedding(booking.id)).id;
  });
  afterAll(async () => {
    if (fx) await fx.purge();
  });

  test('Shaadi Shopping is the one platform business', async () => {
    const platform = await app.prisma.business.findMany({ where: { kind: 'PLATFORM' } });
    expect(platform.map((b) => [b.id, b.name])).toEqual([['shaadi-shopping', 'Shaadi Shopping']]);
    expect(platform[0].commercialStatus).toBeNull();
  });

  test('everything created by today’s code belongs to Shaadi Shopping — enquiry, quotation, booking, agreement, wedding, invoices, payments', async () => {
    const owners = new Set<string>();
    const consultation = await app.prisma.consultation.findUniqueOrThrow({ where: { id: consultationId }, select: { businessId: true } });
    owners.add(consultation.businessId);
    const quotations = await app.prisma.quotation.findMany({ where: { consultationId }, select: { id: true, businessId: true } });
    quotations.forEach((q) => owners.add(q.businessId));
    const quotationIds = quotations.map((q) => q.id);
    (await app.prisma.booking.findMany({ where: { quotationId: { in: quotationIds } }, select: { businessId: true } })).forEach((b) => owners.add(b.businessId));
    (await app.prisma.commercialAgreement.findMany({ where: { quotationId: { in: quotationIds } }, select: { businessId: true } })).forEach((a) => owners.add(a.businessId));
    owners.add((await app.prisma.wedding.findUniqueOrThrow({ where: { id: weddingId }, select: { businessId: true } })).businessId);
    const invoices = await app.prisma.invoice.findMany({ where: { quotationId: { in: quotationIds } }, select: { businessId: true, payments: { select: { businessId: true } } } });
    invoices.forEach((i) => { owners.add(i.businessId); i.payments.forEach((p) => owners.add(p.businessId)); });

    expect(quotations.length).toBeGreaterThan(0);
    expect(invoices.length).toBeGreaterThan(0);
    expect([...owners]).toEqual(['shaadi-shopping']);
  });

  test('a business that still owns records cannot be deleted', async () => {
    const error = await app.prisma.business.delete({ where: { id: 'shaadi-shopping' } }).then(() => null, (e: { code?: string }) => e);
    expect(error).not.toBeNull();
    expect(await app.prisma.business.count({ where: { id: 'shaadi-shopping' } })).toBe(1);
  });
});
