/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runAsSystem, runInScope } from '@/lib/ownership/scope';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Person → Membership → Role → Permissions, on a real database (7 Oct 2026). Two real vendor businesses; one person ("Rahul") is a
// manager in the first and an employee in the second; each business's owner still gets in through the owner link, unchanged.
// What Rahul may see is decided by the business he is working in — and the database guard keeps the two apart.
dbDescribe('people, memberships and workspaces (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let businessSvc: typeof import('@/services/venueBusiness.service').venueBusinessService;
  let enquiries: typeof import('@/services/venueEnquiry.service').venueEnquiryService;
  const owners: string[] = [];
  const vendorIds: string[] = [];
  const businessIds: string[] = [];
  let rahul = '';

  const digits = () => fx.runId.replace(/\D/g, '').padEnd(4, '0').slice(0, 4);

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    businessSvc = (await import('@/services/venueBusiness.service')).venueBusinessService;
    enquiries = (await import('@/services/venueEnquiry.service')).venueEnquiryService;
    const [{ id: anyVendorId }] = await fx.vendors(1);
    const { categoryId } = await app.prisma.vendor.findUniqueOrThrow({ where: { id: anyVendorId }, select: { categoryId: true } });
    for (const [i, label] of ['A', 'B'].entries()) {
      const v = await app.prisma.vendor.create({ data: { slug: `dbtest-member-${label.toLowerCase()}-${fx.runId}`, name: `DBTEST Member Venue ${label} ${fx.runId}`, categoryId, city: 'Patna', priceMin: 1, priceMax: 2, image: 'x', description: 'x' } });
      vendorIds.push(v.id);
      const u = await app.prisma.user.create({ data: { phone: `96000${digits()}${i}`, roles: { create: { role: 'VENDOR' } } } });
      owners.push(u.id);
      await app.prisma.vendorProfile.create({ data: { userId: u.id, vendorId: v.id } });
      // The owner link makes the business and the Owner membership on first use — exactly as before memberships existed.
      businessIds.push((await businessSvc.scopeForVendorLogin(u.id))!.businessId);
    }
    // Rahul: his own login, no vendor of his own.
    rahul = (await app.prisma.user.create({ data: { name: 'DBTEST Rahul', phone: `96000${digits()}9`, roles: { create: { role: 'VENDOR' } } } })).id;
  });

  afterAll(async () => {
    if (!app) return;
    await runAsSystem('test clean-up', async () => {
      await app.prisma.activityLog.deleteMany({ where: { consultation: { businessId: { in: businessIds } } } });
      await app.prisma.task.deleteMany({ where: { consultation: { businessId: { in: businessIds } } } });
      await app.prisma.consultation.deleteMany({ where: { businessId: { in: businessIds } } });
    });
    await app.prisma.businessMember.deleteMany({ where: { businessId: { in: businessIds } } });
    await app.prisma.business.deleteMany({ where: { id: { in: businessIds } } });
    await app.prisma.vendorProfile.deleteMany({ where: { userId: { in: owners } } });
    await app.prisma.user.deleteMany({ where: { id: { in: [...owners, rahul] } } });
    await app.prisma.vendor.deleteMany({ where: { id: { in: vendorIds } } });
    if (fx) await fx.purge();
  });

  test('an owner from before memberships existed is the Owner of their own business, with every permission', async () => {
    const scope = await businessSvc.scopeForVendorLogin(owners[0]);
    expect(scope).toMatchObject({ businessId: businessIds[0], role: 'OWNER', userId: owners[0] });
    expect(scope?.permissions).toContain('view_financials');
    expect((await businessSvc.workspaces(owners[0])).map((w) => w.businessId)).toEqual([businessIds[0]]);
  });

  test('a person who belongs to no business has no workspace and no scope', async () => {
    expect(await businessSvc.workspaces(rahul)).toEqual([]);
    expect(await businessSvc.scopeForVendorLogin(rahul)).toBeNull();
  });

  test('added to one business as a manager: he works there, without money, team or settings', async () => {
    await app.prisma.businessMember.create({ data: { businessId: businessIds[0], userId: rahul, role: 'MANAGER', jobTitle: 'Operations manager' } });
    const scope = await businessSvc.scopeForVendorLogin(rahul);
    expect(scope).toMatchObject({ businessId: businessIds[0], role: 'MANAGER' });
    expect(scope?.permissions).toEqual(['enquiries', 'quotations', 'weddings', 'tasks', 'catalog']);
  });

  test('added to a second business as an employee: now he must choose, and each choice is its own role and permissions', async () => {
    await app.prisma.businessMember.create({ data: { businessId: businessIds[1], userId: rahul, role: 'EMPLOYEE', jobTitle: 'Coordinator', grants: ['weddings'] } });
    expect((await businessSvc.workspaces(rahul)).map((w) => [w.businessId, w.role, w.jobTitle])).toEqual([[businessIds[0], 'MANAGER', 'Operations manager'], [businessIds[1], 'EMPLOYEE', 'Coordinator']]);
    expect(await businessSvc.scopeForVendorLogin(rahul)).toBeNull(); // no choice made — never dropped into one
    expect(await businessSvc.scopeForVendorLogin(rahul, businessIds[0])).toMatchObject({ role: 'MANAGER' });
    expect(await businessSvc.scopeForVendorLogin(rahul, businessIds[1])).toMatchObject({ role: 'EMPLOYEE', permissions: ['weddings'] });
  });

  test('a choice he is not a member of opens nothing', async () => {
    expect(await businessSvc.scopeForVendorLogin(rahul, 'shaadi-shopping')).toBeNull();
    expect(await businessSvc.scopeForVendorLogin(rahul, '00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  test('the business he is working in decides what he sees: an enquiry of venue A is invisible from venue B', async () => {
    const inA = (await businessSvc.scopeForVendorLogin(rahul, businessIds[0]))!;
    const inB = (await businessSvc.scopeForVendorLogin(rahul, businessIds[1]))!;
    const made = (await runInScope(inA, () => enquiries.create({ name: 'DBTEST Couple', phone: '98765 43210', channel: 'PHONE' }, rahul))) as { id: string };
    expect((await runInScope(inA, () => enquiries.list())).map((e) => e.id)).toContain(made.id);
    expect((await runInScope(inB, () => enquiries.list())).map((e) => e.id)).not.toContain(made.id);
    // The owner of venue A sees what her manager added.
    const ownerA = (await businessSvc.scopeForVendorLogin(owners[0]))!;
    expect((await runInScope(ownerA, () => enquiries.list())).map((e) => e.id)).toContain(made.id);
  });

  test('the owner gives one person money, and takes something away — it holds for that person only', async () => {
    await app.prisma.businessMember.update({ where: { businessId_userId: { businessId: businessIds[0], userId: rahul } }, data: { grants: ['view_financials'], denies: ['catalog'] } });
    expect((await businessSvc.scopeForVendorLogin(rahul, businessIds[0]))?.permissions).toEqual(['enquiries', 'quotations', 'weddings', 'tasks', 'view_financials']);
  });

  test('removed from a team: that workspace is gone, the other stays', async () => {
    await app.prisma.businessMember.update({ where: { businessId_userId: { businessId: businessIds[0], userId: rahul } }, data: { removedAt: new Date() } });
    expect((await businessSvc.workspaces(rahul)).map((w) => w.businessId)).toEqual([businessIds[1]]);
    expect(await businessSvc.scopeForVendorLogin(rahul, businessIds[0])).toMatchObject({ businessId: businessIds[1] }); // his only business now
  });
});
