/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runAsSystem, runInScope, type Scope } from '@/lib/ownership/scope';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Record ownership, Phase B2: records that belong to their business THROUGH a parent — a wedding's functions, vendor bookings,
// guests, tasks and timeline; a quotation's lines; an enquiry's activity. On a real database, through the app's own client.
dbDescribe('record ownership — child records follow their parent (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let venue: Scope;
  let venueBusinessId = '';
  let platformConsultationId = '';
  let platformWeddingId = '';
  let platformGuestId = '';
  let venueConsultationId = '';
  let venueTaskId = '';

  const refused = (p: Promise<unknown>) => p.then(() => null, (e: Error) => e);

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    // Shaadi Shopping: a real wedding made by the real conversion — with functions, vendor bookings, tasks, timeline, activity.
    platformConsultationId = (await fx.consultation({ name: 'DBTEST platform children', weddingDate: '2026-12-05' })).id;
    const { booking } = await fx.confirmedBooking(platformConsultationId);
    platformWeddingId = (await app.convertBookingToWedding(booking.id)).id;
    platformGuestId = (await app.prisma.guest.create({ data: { weddingId: platformWeddingId, name: 'DBTEST guest' } })).id;
    // A venue with its own enquiry and a follow-up task on it.
    venueBusinessId = (await app.prisma.business.create({ data: { name: `DBTEST Venue children ${fx.runId}`, kind: 'VENDOR' } })).id;
    venue = { kind: 'BUSINESS', businessId: venueBusinessId, role: 'OWNER' };
    await runInScope(venue, async () => {
      venueConsultationId = (await app.prisma.consultation.create({
        data: { name: 'DBTEST venue children', phone: '9800000011', weddingDate: '2026-12-01', days: 1, guestCount: 100, message: `DBTEST venue ${fx.runId}` },
      })).id;
      venueTaskId = (await app.prisma.task.create({ data: { context: 'SALES_FOLLOWUP', title: 'Call the couple', consultationId: venueConsultationId } })).id;
    });
  });

  afterAll(async () => {
    if (!app) return;
    await runAsSystem('test clean-up', async () => {
      await app.prisma.task.deleteMany({ where: { consultationId: venueConsultationId } });
      await app.prisma.activityLog.deleteMany({ where: { consultationId: venueConsultationId } });
      await app.prisma.consultation.deleteMany({ where: { businessId: venueBusinessId } });
      await app.prisma.guest.deleteMany({ where: { id: platformGuestId } });
    });
    if (venueBusinessId) await app.prisma.business.deleteMany({ where: { id: venueBusinessId } });
    if (fx) await fx.purge();
  });

  test('the platform wedding really has children (so the next checks are not vacuous)', async () => {
    expect(await app.prisma.weddingEvent.count({ where: { weddingId: platformWeddingId } })).toBeGreaterThan(0);
    expect(await app.prisma.vendorBooking.count({ where: { weddingEvent: { weddingId: platformWeddingId } } })).toBeGreaterThan(0);
    expect(await app.prisma.task.count({ where: { weddingId: platformWeddingId } })).toBeGreaterThan(0);
    expect(await app.prisma.activityLog.count({ where: { weddingId: platformWeddingId } })).toBeGreaterThan(0);
    expect(await app.prisma.quotationItem.count({ where: { quotation: { consultationId: platformConsultationId } } })).toBeGreaterThan(0);
  });

  test('the venue sees none of a Shaadi Shopping wedding’s functions, vendors, guests, tasks, timeline, activity or quote lines', async () => {
    await runInScope(venue, async () => {
      expect(await app.prisma.weddingEvent.count({ where: { weddingId: platformWeddingId } })).toBe(0);
      expect(await app.prisma.vendorBooking.findMany({ where: { weddingEvent: { weddingId: platformWeddingId } } })).toEqual([]);
      expect(await app.prisma.guest.findUnique({ where: { id: platformGuestId } })).toBeNull();
      expect(await app.prisma.task.count({ where: { weddingId: platformWeddingId } })).toBe(0);
      expect(await app.prisma.timelineMilestone.count({ where: { weddingId: platformWeddingId } })).toBe(0);
      expect(await app.prisma.activityLog.count({ where: { weddingId: platformWeddingId } })).toBe(0);
      expect(await app.prisma.quotationItem.count({ where: { quotation: { consultationId: platformConsultationId } } })).toBe(0);
      // Through the real service.
      expect((await refused(app.weddingWorkspaceService.getWorkspace(platformWeddingId)))?.name).toBe('NotFoundError');
    });
  });

  test('…cannot change or delete them', async () => {
    await runInScope(venue, async () => {
      expect(await app.prisma.guest.updateMany({ where: { id: platformGuestId }, data: { name: 'hacked' } })).toEqual({ count: 0 });
      expect((await refused(app.prisma.guest.update({ where: { id: platformGuestId }, data: { name: 'hacked' } })) as { code?: string } | null)?.code).toBe('P2025');
      expect(await app.prisma.task.deleteMany({ where: { weddingId: platformWeddingId } })).toEqual({ count: 0 });
    });
    expect((await app.prisma.guest.findUniqueOrThrow({ where: { id: platformGuestId } })).name).toBe('DBTEST guest');
  });

  test('…and cannot hang its own records off them: a guest, a task, a quotation, a function', async () => {
    await runInScope(venue, async () => {
      expect((await refused(app.prisma.guest.create({ data: { weddingId: platformWeddingId, name: 'intruder' } })))?.name).toBe('ScopeViolationError');
      expect((await refused(app.prisma.task.create({ data: { context: 'WEDDING_TASK', title: 'x', wedding: { connect: { id: platformWeddingId } } } })))?.name).toBe('ScopeViolationError');
      expect((await refused(app.prisma.weddingEvent.create({ data: { weddingId: platformWeddingId, type: 'SANGEET', date: new Date('2026-12-04'), city: 'Patna' } })))?.name).toBe('ScopeViolationError');
      expect((await refused(app.prisma.quotation.create({
        data: { quotationNumber: `DBTEST-X-${fx.runId}`, subtotal: 1, total: 1, advanceAmount: 0, consultation: { connect: { id: platformConsultationId } } },
      })))?.name).toBe('ScopeViolationError');
    });
    expect(await app.prisma.guest.count({ where: { weddingId: platformWeddingId, name: 'intruder' } })).toBe(0);
  });

  test('Shaadi Shopping cannot see the venue’s follow-up tasks; the venue sees and changes its own', async () => {
    expect(await app.prisma.task.findUnique({ where: { id: venueTaskId } })).toBeNull();
    expect(await app.prisma.task.updateMany({ where: { id: venueTaskId }, data: { title: 'hacked' } })).toEqual({ count: 0 });
    await runInScope(venue, async () => {
      expect((await app.prisma.task.findUniqueOrThrow({ where: { id: venueTaskId } })).title).toBe('Call the couple');
      await app.prisma.task.update({ where: { id: venueTaskId }, data: { status: 'DONE' } });
      expect((await app.prisma.task.findUniqueOrThrow({ where: { id: venueTaskId } })).status).toBe('DONE');
    });
  });
});
