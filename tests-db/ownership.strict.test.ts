/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { platformScoped } from '@/lib/ownership/entry';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Record ownership, Phase B3 — fail-closed, on a real database: with OWNERSHIP_UNSCOPED=error, work on owned records outside a scope
// is refused, while the same work through an entry wrapper (what every route and owned-data page uses) runs — including real
// services that await many queries and a transaction, so the scope must hold through all of them.
dbDescribe('record ownership — fail-closed (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let consultationId = '';
  const previous = process.env.OWNERSHIP_UNSCOPED;

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    consultationId = (await fx.consultation({ name: 'DBTEST strict', weddingDate: '2026-12-05' })).id;
    process.env.OWNERSHIP_UNSCOPED = 'error';
  });

  afterAll(async () => {
    if (previous === undefined) delete process.env.OWNERSHIP_UNSCOPED;
    else process.env.OWNERSHIP_UNSCOPED = previous;
    if (fx) await fx.purge();
  });

  const outcome = (p: Promise<unknown>) => p.then(() => null, (e: Error) => e);

  test('unscoped access to owned records is refused — reads, writes, and child records', async () => {
    expect((await outcome(app.prisma.wedding.count()))?.name).toBe('UnscopedAccessError');
    expect((await outcome(app.prisma.consultation.update({ where: { id: consultationId }, data: { name: 'x' } })))?.name).toBe('UnscopedAccessError');
    expect((await outcome(app.prisma.task.findMany({ where: { consultationId } })))?.name).toBe('UnscopedAccessError');
  });

  test('records that are not owned (vendors, categories) are unaffected', async () => {
    expect(await app.prisma.vendor.count()).toBeGreaterThan(0);
  });

  test('through an entry wrapper the same work runs — a real service, its queries and its transaction', async () => {
    const workspace = await platformScoped(() => app.leadWorkspaceService.getWorkspace('CONSULTATION', consultationId))();
    expect(workspace).toBeTruthy();
    const wedding = await platformScoped(async () => {
      const { booking } = await fx.confirmedBooking(consultationId);
      return app.convertBookingToWedding(booking.id);
    })();
    expect(wedding.id).toBeTruthy();
    expect(await platformScoped(() => app.prisma.weddingEvent.count({ where: { weddingId: wedding.id } }))()).toBeGreaterThan(0);
  });

  test('after the wrapper returns, the scope is gone again', async () => {
    await platformScoped(async () => app.prisma.wedding.count())();
    expect((await outcome(app.prisma.wedding.count()))?.name).toBe('UnscopedAccessError');
  });
});
