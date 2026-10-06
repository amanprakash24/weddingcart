/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runAsSystem, runInScope, type Scope } from '@/lib/ownership/scope';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Record ownership, Phase B (docs/wedding-os/15-record-ownership.md §4.7): TWO businesses on a real database, through the app's own
// database client and services. Neither can read, count, change, delete or quote the other's records — and nothing says the
// other's records exist. (Only lib/ownership/scope is imported at the top: it does not touch the database.)
dbDescribe('record ownership — two businesses cannot see each other (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let venue: Scope;
  let venueBusinessId = '';
  let platformConsultationId = '';
  let venueConsultationId = '';
  let venueLeadId = '';

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    // Shaadi Shopping's record (no scope = Shaadi Shopping during Phase B).
    platformConsultationId = (await fx.consultation({ name: 'DBTEST platform couple' })).id;
    // A venue running its own business.
    venueBusinessId = (await app.prisma.business.create({ data: { name: `DBTEST Venue ${fx.runId}`, kind: 'VENDOR', commercialStatus: 'SAAS' } })).id;
    venue = { kind: 'BUSINESS', businessId: venueBusinessId, role: 'OWNER' };
    await runInScope(venue, async () => {
      venueConsultationId = (await app.prisma.consultation.create({
        data: { name: 'DBTEST venue own couple', phone: '9800000001', weddingDate: '2026-12-01', days: 1, guestCount: 200, message: `DBTEST venue ${fx.runId}` },
      })).id;
      venueLeadId = (await app.prisma.lead.create({ data: { phone: '9800000002', source: 'phone' } })).id;
    });
  });

  afterAll(async () => {
    if (!app) return;
    await runAsSystem('test clean-up', async () => {
      await app.prisma.lead.deleteMany({ where: { businessId: venueBusinessId } });
      await app.prisma.consultation.deleteMany({ where: { businessId: venueBusinessId } });
    });
    if (venueBusinessId) await app.prisma.business.deleteMany({ where: { id: venueBusinessId } });
    if (fx) await fx.purge();
  });

  test('records created in the venue’s scope belong to the venue — the code never said so', async () => {
    const rows = await runAsSystem('test check', () => app.prisma.consultation.findMany({ where: { id: { in: [venueConsultationId, platformConsultationId] } }, select: { id: true, businessId: true } }));
    expect(Object.fromEntries(rows.map((r) => [r.id, r.businessId]))).toEqual({ [venueConsultationId]: venueBusinessId, [platformConsultationId]: 'shaadi-shopping' });
  });

  test('Shaadi Shopping cannot see the venue’s own customers', async () => {
    expect(await app.prisma.consultation.findUnique({ where: { id: venueConsultationId } })).toBeNull();
    expect(await app.prisma.lead.findFirst({ where: { id: venueLeadId } })).toBeNull();
    expect(await app.prisma.consultation.count({ where: { id: { in: [venueConsultationId, platformConsultationId] } } })).toBe(1);
    const all = await app.prisma.consultation.findMany({ where: { name: { startsWith: 'DBTEST' } }, select: { id: true } });
    expect(all.map((r) => r.id)).not.toContain(venueConsultationId);
  });

  test('…and cannot change or delete them (they simply are not found)', async () => {
    expect(await app.prisma.consultation.updateMany({ where: { id: venueConsultationId }, data: { name: 'hacked' } })).toEqual({ count: 0 });
    expect(await app.prisma.lead.deleteMany({ where: { id: venueLeadId } })).toEqual({ count: 0 });
    const err = await app.prisma.consultation.update({ where: { id: venueConsultationId }, data: { name: 'hacked' } }).then(() => null, (e: { code?: string }) => e);
    expect(err?.code).toBe('P2025');
    const still = await runAsSystem('test check', () => app.prisma.consultation.findUniqueOrThrow({ where: { id: venueConsultationId } }));
    expect(still.name).toBe('DBTEST venue own couple');
  });

  test('the venue cannot see, change or quote Shaadi Shopping’s customers', async () => {
    await runInScope(venue, async () => {
      expect(await app.prisma.consultation.findUnique({ where: { id: platformConsultationId } })).toBeNull();
      expect(await app.prisma.consultation.updateMany({ where: { id: platformConsultationId }, data: { name: 'hacked' } })).toEqual({ count: 0 });
      // Through a real service: the workspace and a quotation for another business's customer are "not found", nothing more.
      const ws = await app.leadWorkspaceService.getWorkspace('CONSULTATION', platformConsultationId).then(() => null, (e: { name?: string }) => e);
      expect(ws?.name).toBe('NotFoundError');
    });
  });

  test('naming the other business explicitly is refused, never widened', async () => {
    await runInScope(venue, async () => {
      const read = await app.prisma.consultation.findMany({ where: { businessId: 'shaadi-shopping' } }).then(() => null, (e: Error) => e);
      expect(read?.name).toBe('ScopeViolationError');
      const write = await app.prisma.lead.create({ data: { phone: '9800000003', businessId: 'shaadi-shopping' } }).then(() => null, (e: Error) => e);
      expect(write?.name).toBe('ScopeViolationError');
    });
  });

  test('inside a transaction the same rules apply', async () => {
    await runInScope(venue, () =>
      app.prisma.$transaction(async (tx) => {
        expect(await tx.consultation.findUnique({ where: { id: platformConsultationId } })).toBeNull();
        expect(await tx.consultation.findUnique({ where: { id: venueConsultationId } })).not.toBeNull();
      })
    );
  });
});
