/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runAsSystem, runInScope, type Scope } from '@/lib/ownership/scope';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';
import { validateNewEnquiry } from '@/lib/venue/enquiry';

// Phase C, first slice: a venue's OWN enquiries, on a real database, through the real services and two real vendor logins.
// Venue A adds, calls, follows up and closes its enquiry; venue B and Shaadi Shopping never see it; A never sees theirs.
dbDescribe('a venue’s own enquiries (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let enquiries: typeof import('@/services/venueEnquiry.service').venueEnquiryService;
  let businessSvc: typeof import('@/services/venueBusiness.service').venueBusinessService;
  const users: string[] = [];
  const vendorIds: string[] = [];
  let scopeA: Extract<Scope, { kind: 'BUSINESS' }>;
  let scopeB: Extract<Scope, { kind: 'BUSINESS' }>;
  let enquiryId = '';
  let platformConsultationId = '';

  const outcome = (p: Promise<unknown>) => p.then(() => null, (e: Error) => e);
  const inA = <T>(fn: () => Promise<T>) => runInScope(scopeA, fn);
  const inB = <T>(fn: () => Promise<T>) => runInScope(scopeB, fn);
  const later = (days: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + days * 86_400_000));

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    enquiries = (await import('@/services/venueEnquiry.service')).venueEnquiryService;
    businessSvc = (await import('@/services/venueBusiness.service')).venueBusinessService;
    platformConsultationId = (await fx.consultation({ name: 'DBTEST platform couple (venue test)' })).id;
    // Two venues of the test's own (never an existing vendor's row or login), each with a vendor login.
    const [{ id: anyVendorId }] = await fx.vendors(1);
    const { categoryId } = await app.prisma.vendor.findUniqueOrThrow({ where: { id: anyVendorId }, select: { categoryId: true } });
    for (const [i, label] of ['A', 'B'].entries()) {
      const v = await app.prisma.vendor.create({ data: { slug: `dbtest-venue-${label.toLowerCase()}-${fx.runId}`, name: `DBTEST Venue ${label} ${fx.runId}`, categoryId, city: 'Patna', priceMin: 1, priceMax: 2, image: 'x', description: 'x' } });
      vendorIds.push(v.id);
      const u = await app.prisma.user.create({ data: { phone: `98000${fx.runId.replace(/\D/g, '').padEnd(4, '0').slice(0, 4)}${i}`, roles: { create: { role: 'VENDOR' } } } });
      users.push(u.id);
      await app.prisma.vendorProfile.create({ data: { userId: u.id, vendorId: v.id } });
    }
    scopeA = (await businessSvc.scopeForVendorLogin(users[0]))!;
    scopeB = (await businessSvc.scopeForVendorLogin(users[1]))!;
  });

  afterAll(async () => {
    if (!app) return;
    const ids = [scopeA?.businessId, scopeB?.businessId].filter(Boolean) as string[];
    await runAsSystem('test clean-up', async () => {
      await app.prisma.task.deleteMany({ where: { consultation: { businessId: { in: ids } } } });
      await app.prisma.activityLog.deleteMany({ where: { consultation: { businessId: { in: ids } } } });
      await app.prisma.consultation.deleteMany({ where: { businessId: { in: ids } } });
      await app.prisma.businessClient.deleteMany({ where: { businessId: { in: ids } } });
    });
    await app.prisma.businessMember.deleteMany({ where: { userId: { in: users } } });
    await app.prisma.business.deleteMany({ where: { id: { in: ids } } });
    await app.prisma.vendorProfile.deleteMany({ where: { userId: { in: users } } });
    await app.prisma.user.deleteMany({ where: { id: { in: users } } });
    await app.prisma.vendor.deleteMany({ where: { id: { in: vendorIds } } });
    if (fx) await fx.purge();
  });

  test('each vendor login gets its own business, once, as its Owner', async () => {
    expect(scopeA).toMatchObject({ kind: 'BUSINESS', role: 'OWNER' });
    expect(scopeB.businessId).not.toBe(scopeA.businessId);
    expect(await businessSvc.scopeForVendorLogin(users[0])).toEqual(scopeA);
    expect(await app.prisma.business.count({ where: { id: { in: [scopeA.businessId, scopeB.businessId] }, kind: 'VENDOR' } })).toBe(2);
  });

  test('+ New Enquiry: a wrong field is explained, a good one is saved in the venue’s business — next: call', async () => {
    const bad = await inA(() => enquiries.create({ name: 'R', phone: '123', channel: 'PHONE' }, users[0]));
    expect(bad).toMatchObject({ errors: { name: expect.any(String), phone: expect.any(String) } });
    const created = await inA(() => enquiries.create({ name: 'Rahul Kumar', phone: '98765 43210', weddingDate: later(60), guestCount: '350', need: 'Lawn and veg catering', channel: 'PHONE' }, users[0]));
    enquiryId = (created as { id: string }).id;
    const row = await runAsSystem('test check', () => app.prisma.consultation.findUniqueOrThrow({ where: { id: enquiryId } }));
    expect(row).toMatchObject({ businessId: scopeA.businessId, channel: 'PHONE', guestCount: 350, phone: '9876543210' });
    const list = await inA(() => enquiries.list());
    expect(list.map((e) => e.id)).toContain(enquiryId);
    expect(list.find((e) => e.id === enquiryId)?.next).toEqual({ kind: 'CALL', label: 'Call Rahul' });
  });

  test('called → plan the next step; a follow-up → it decides; done → plan again', async () => {
    expect((await inA(() => enquiries.log(enquiryId, 'CALL', '', users[0]))).next.kind).toBe('SCHEDULE');
    expect((await outcome(inA(() => enquiries.addFollowUp(enquiryId, { date: later(-1) }, users[0]))))?.name).toBe('ValidationError');
    const withFu = await inA(() => enquiries.addFollowUp(enquiryId, { date: later(3), title: 'Share the package' }, users[0]));
    expect(withFu.next).toMatchObject({ kind: 'FOLLOW_UP_LATER' });
    const fuId = withFu.followUps[0].id;
    expect((await inA(() => enquiries.completeFollowUp(enquiryId, fuId))).next.kind).toBe('SCHEDULE');
    const detail = await inA(() => enquiries.get(enquiryId));
    expect(detail.history.map((h) => h.summary)).toEqual(expect.arrayContaining(['Called', 'Enquiry added — phone call']));
  });

  test('another venue sees nothing of it, and cannot touch it', async () => {
    expect((await inB(() => enquiries.list())).map((e) => e.id)).not.toContain(enquiryId);
    expect((await outcome(inB(() => enquiries.get(enquiryId))))?.name).toBe('NotFoundError');
    expect((await outcome(inB(() => enquiries.log(enquiryId, 'NOTE', 'hello', users[1]))))?.name).toBe('NotFoundError');
    expect((await outcome(inB(() => enquiries.close(enquiryId, 'x', users[1]))))?.name).toBe('NotFoundError');
  });

  test('Shaadi Shopping staff see nothing of it — not in the CRM, not by id', async () => {
    expect(await app.prisma.consultation.findUnique({ where: { id: enquiryId } })).toBeNull();
    expect((await outcome(app.leadWorkspaceService.getWorkspace('CONSULTATION', enquiryId)))?.name).toBe('NotFoundError');
  });

  test('…and the venue sees nothing of Shaadi Shopping’s customers', async () => {
    expect((await inA(() => enquiries.list())).map((e) => e.id)).not.toContain(platformConsultationId);
    expect((await outcome(inA(() => enquiries.get(platformConsultationId))))?.name).toBe('NotFoundError');
  });

  test('not going ahead: closed and kept, open follow-ups cancelled', async () => {
    await inA(() => enquiries.addFollowUp(enquiryId, { date: later(5) }, users[0]));
    const closed = await inA(() => enquiries.close(enquiryId, 'Booked elsewhere', users[0]));
    expect(closed.next.kind).toBe('CLOSED');
    expect(await runAsSystem('test check', () => app.prisma.task.count({ where: { consultationId: enquiryId, status: 'PENDING' } }))).toBe(0);
    expect((await inA(() => enquiries.list())).find((e) => e.id === enquiryId)?.next.kind).toBe('CLOSED');
  });

  // Vivah OS phase 1 (11 Nov 2026): one client per mobile per venue — private to the venue, like its enquiries.
  test('the same mobile at two venues: two separate clients, each private to its venue', async () => {
    const mobile = '9876501234';
    const a = (await inA(() => enquiries.create({ name: 'Neha Sharma', phone: mobile, eventType: 'wedding', functions: ['HALDI', 'SANGEET'], days: 2, budget: '8,00,000', channel: 'GOOGLE' }, users[0]))) as { id: string; repeat: boolean };
    const b = (await inB(() => enquiries.create({ name: 'Neha S', phone: mobile, eventType: 'birthday', channel: 'WALK_IN' }, users[1]))) as { id: string; repeat: boolean };
    expect([a.repeat, b.repeat]).toEqual([false, false]);
    const rows = await runAsSystem('test check', () => app.prisma.consultation.findMany({ where: { id: { in: [a.id, b.id] } }, select: { id: true, clientId: true, functions: true, days: true, totalBudget: true, assignedToId: true, client: { select: { businessId: true, phone: true } } } }));
    const ra = rows.find((r) => r.id === a.id)!;
    const rb = rows.find((r) => r.id === b.id)!;
    expect(ra).toMatchObject({ functions: ['HALDI', 'SANGEET'], days: 2, totalBudget: 800000, assignedToId: users[0], client: { businessId: scopeA.businessId, phone: mobile } });
    expect(rb.client).toEqual({ businessId: scopeB.businessId, phone: mobile });
    expect(ra.clientId).not.toBe(rb.clientId);
    // Each venue sees only its own client; neither can reach the other's.
    expect(await inA(() => app.prisma.businessClient.findMany({ where: { phone: mobile }, select: { id: true } }))).toEqual([{ id: ra.clientId! }]);
    expect(await inB(() => app.prisma.businessClient.findUnique({ where: { id: ra.clientId! } }))).toBeNull();
  });

  test('the same mobile again while it is open: from the enquiry page it is added to that enquiry; typed by the team it is a new one', async () => {
    const checked = validateNewEnquiry({ name: 'Neha Sharma', phone: '98765 01234', guestCount: '450', channel: 'INSTAGRAM' }, later(0));
    if (!checked.ok) throw new Error('test enquiry should be valid');
    const fromPage = await inA(() => enquiries.intake(checked.value, { sourceDetail: 'Enquiry page', actorId: null }));
    expect(fromPage.repeat).toBe(true);
    expect((await inA(() => enquiries.get(fromPage.id))).history[0]).toMatchObject({ summary: 'Enquired again — instagram · enquiry page', detail: expect.stringContaining('450 guests') });

    const typed = (await inA(() => enquiries.create({ name: 'Neha Sharma', phone: '98765 01234', eventType: 'engagement', channel: 'PHONE' }, users[0]))) as { id: string; repeat: boolean };
    expect(typed.repeat).toBe(false);
    expect(typed.id).not.toBe(fromPage.id);
    expect((await inA(() => enquiries.get(typed.id))).earlierEnquiries).toBe(1);
    expect(await runAsSystem('test check', () => app.prisma.businessClient.count({ where: { businessId: scopeA.businessId, phone: '9876501234' } }))).toBe(1);
  });
});
