/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runAsSystem, runInScope, type Scope } from '@/lib/ownership/scope';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Decision D4 on a real database: a venue adds its own enquiry for a couple Shaadi Shopping already brought to THAT venue → linked,
// commission applies, both sides told. A different venue, a lost Shaadi Shopping record, or a different mobile → nothing linked.
dbDescribe('a couple who came through Shaadi Shopping (D4, real database)', () => {
  let app: App;
  let fx: Fixtures;
  let enquiries: typeof import('@/services/venueEnquiry.service').venueEnquiryService;
  const users: string[] = [];
  const vendorIds: string[] = [];
  const scopes: Extract<Scope, { kind: 'BUSINESS' }>[] = [];
  let platformConsultationId = '';
  const COUPLE = '9811122233';
  const LOST_COUPLE = '9811122244';

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    enquiries = (await import('@/services/venueEnquiry.service')).venueEnquiryService;
    const businesses = (await import('@/services/venueBusiness.service')).venueBusinessService;
    const [{ id: anyVendorId }] = await fx.vendors(1);
    const { categoryId } = await app.prisma.vendor.findUniqueOrThrow({ where: { id: anyVendorId }, select: { categoryId: true } });
    for (const [i, label] of ['A', 'B'].entries()) {
      const v = await app.prisma.vendor.create({ data: { slug: `dbtest-match-${label.toLowerCase()}-${fx.runId}`, name: `DBTEST Match Venue ${label}`, categoryId, city: 'Patna', priceMin: 1, priceMax: 2, image: 'x', description: 'x' } });
      vendorIds.push(v.id);
      const u = await app.prisma.user.create({ data: { phone: `97${String(Date.now()).slice(-7)}${i}`, roles: { create: { role: 'VENDOR' } } } });
      users.push(u.id);
      await app.prisma.vendorProfile.create({ data: { userId: u.id, vendorId: v.id } });
      scopes.push((await businesses.scopeForVendorLogin(u.id))!);
    }
    // Shaadi Shopping's couple, for whom it asked venue A about availability.
    platformConsultationId = (await fx.consultation({ name: 'DBTEST D4 couple', phone: COUPLE })).id;
    await app.prisma.vendorEnquiry.create({ data: { vendorId: vendorIds[0], sourceKey: `CONSULTATION:${platformConsultationId}`, consultationId: platformConsultationId, services: 'Venue' } });
    // A couple Shaadi Shopping LOST, also with venue A.
    const lost = (await fx.consultation({ name: 'DBTEST D4 lost couple' })).id;
    await app.prisma.consultation.update({ where: { id: lost }, data: { phone: LOST_COUPLE, pipelineStage: 'LOST' } });
    await app.prisma.consultationVendorSelection.create({ data: { consultationId: lost, vendorId: vendorIds[0], serviceKey: 'venue' } });
  });

  afterAll(async () => {
    if (!app) return;
    const ids = scopes.map((s) => s.businessId);
    await runAsSystem('test clean-up', async () => {
      await app.prisma.activityLog.deleteMany({ where: { consultation: { businessId: { in: ids } } } });
      await app.prisma.task.deleteMany({ where: { consultation: { businessId: { in: ids } } } });
      await app.prisma.consultation.deleteMany({ where: { businessId: { in: ids } } });
      await app.prisma.vendorEnquiry.deleteMany({ where: { vendorId: { in: vendorIds } } });
      await app.prisma.consultationVendorSelection.deleteMany({ where: { vendorId: { in: vendorIds } } });
    });
    await app.prisma.businessMember.deleteMany({ where: { userId: { in: users } } });
    await app.prisma.business.deleteMany({ where: { id: { in: ids } } });
    await app.prisma.vendorProfile.deleteMany({ where: { userId: { in: users } } });
    await app.prisma.user.deleteMany({ where: { id: { in: users } } });
    await app.prisma.vendor.deleteMany({ where: { id: { in: vendorIds } } });
    if (fx) await fx.purge();
  });

  const add = (venue: number, phone: string) =>
    runInScope(scopes[venue], async () => {
      const r = (await enquiries.create({ name: 'DBTEST D4 Rahul', phone, channel: 'PHONE' }, users[venue])) as { id: string };
      return enquiries.get(r.id);
    });

  test('venue A adds Shaadi Shopping’s couple → linked, told “through Shaadi Shopping”, and Shaadi Shopping is told on its record', async () => {
    const e = await add(0, `+91 ${COUPLE}`);
    expect(e.viaShaadiShopping).toBe(true);
    expect(e.history.map((h) => h.summary)).toContain('This couple came to you through Shaadi Shopping — commission applies to this booking');
    const stored = await runAsSystem('test check', () => app.prisma.consultation.findUniqueOrThrow({ where: { id: e.id }, select: { platformMatch: true, businessId: true } }));
    expect(stored).toEqual({ platformMatch: `CONSULTATION:${platformConsultationId}`, businessId: scopes[0].businessId });
    const note = await app.prisma.activityLog.findFirst({ where: { consultationId: platformConsultationId, summary: { contains: 'added this couple to its own Vivah OS enquiries' } } });
    expect(note?.summary).toContain('DBTEST Match Venue A');
  });

  test('the venue sees only the flag — nothing of Shaadi Shopping’s record', async () => {
    const e = await add(0, COUPLE);
    expect(JSON.stringify(e)).not.toContain(platformConsultationId);
    expect(JSON.stringify(e)).not.toContain('DBTEST D4 couple');
  });

  test('a different venue adding the same couple is NOT linked (Shaadi Shopping never brought them to it)', async () => {
    expect((await add(1, COUPLE)).viaShaadiShopping).toBe(false);
  });

  test('a couple Shaadi Shopping lost, or a different mobile, is not linked', async () => {
    expect((await add(0, LOST_COUPLE)).viaShaadiShopping).toBe(false);
    expect((await add(0, '9811199999')).viaShaadiShopping).toBe(false);
  });
});
