/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, inDays, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// V1 model: a wedding can be completed without any vendor ever confirming. PLANNING -> COMPLETED is allowed once the wedding's
// last day has arrived — vendors, open tasks and unpaid money never block it. Real services, real database (staging only).
dbDescribe('completing a wedding that no vendor confirmed (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let weddingId = '';

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    const consultation = await fx.consultation({ weddingDate: '2026-12-05' });
    const { booking } = await fx.confirmedBooking(consultation.id);
    weddingId = (await app.convertBookingToWedding(booking.id)).id;
  });
  afterAll(async () => {
    if (fx) await fx.purge();
  });

  const outcome = (p: Promise<unknown>) => p.then(() => null, (e: { name?: string; message?: string }) => e);

  test('a fresh PLANNING wedding with its date ahead cannot be completed yet — and nothing changes', async () => {
    const before = await app.prisma.wedding.findUniqueOrThrow({ where: { id: weddingId } });
    expect(before.status).toBe('PLANNING');
    const error = await outcome(app.weddingWorkspaceService.transitionStatus(weddingId, 'COMPLETED'));
    expect(error?.name).toBe('InvalidTransitionError');
    const after = await app.prisma.wedding.findUniqueOrThrow({ where: { id: weddingId } });
    expect(after.status).toBe('PLANNING');
    expect(after.completedAt).toBeNull();
  });

  test('once the day has passed it completes with zero confirmed vendors, an unpaid balance and open tasks', async () => {
    // Move the whole wedding into the past, then make it vendorless. Everything else stays as the conversion made it.
    const past = inDays(-3);
    await app.prisma.wedding.update({ where: { id: weddingId }, data: { primaryDate: past } });
    await app.prisma.weddingEvent.updateMany({ where: { weddingId }, data: { date: past } });
    await app.prisma.vendorBooking.deleteMany({ where: { weddingEvent: { weddingId } } });

    expect(await app.prisma.vendorBooking.count({ where: { weddingEvent: { weddingId } } })).toBe(0);
    expect(await app.prisma.task.count({ where: { weddingId, status: { in: ['PENDING', 'IN_PROGRESS'] } } })).toBeGreaterThan(0);
    const invoices = await app.prisma.invoice.findMany({ where: { weddingId } });
    expect(invoices.length).toBeGreaterThan(0);
    // Money V1: the booking was confirmed on its 25%, so its (only) invoice is paid — the rest of the agreement is still unpaid.
    expect(invoices.every((i) => i.status === 'PAID')).toBe(true);
    const money = (await app.weddingWorkspaceService.getWorkspace(weddingId)).finance.agreement?.money;
    expect(money?.outstanding ?? 0).toBeGreaterThan(0);

    const done = await app.weddingWorkspaceService.transitionStatus(weddingId, 'COMPLETED');
    expect(done.status).toBe('COMPLETED');

    const stored = await app.prisma.wedding.findUniqueOrThrow({ where: { id: weddingId } });
    expect(stored.status).toBe('COMPLETED');
    expect(stored.completedAt).not.toBeNull();
    // the invoice and tasks are untouched — completion never rewrites money
    expect(await app.prisma.invoice.count({ where: { weddingId } })).toBe(invoices.length);
  });

  test('a completed wedding is final — it cannot be moved again', async () => {
    const error = await outcome(app.weddingWorkspaceService.transitionStatus(weddingId, 'PLANNING'));
    expect(error?.name).toBe('InvalidTransitionError');
  });
});
