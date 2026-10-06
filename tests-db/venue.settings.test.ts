/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runAsSystem, runInScope, type Scope } from '@/lib/ownership/scope';
import { dbDescribe, inDays, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Phase C: a venue's own Settings, on a real database, through the real services and two real vendor logins.
// The owner of venue A sets its number and its booking rule; its next booking is made under that rule and its couple's link shows
// that number. Venue B is untouched, staff cannot change anything, and a booking already agreed keeps its rule.
dbDescribe('a venue’s own settings (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let settings: typeof import('@/services/venueSettings.service').venueSettingsService;
  let businessSvc: typeof import('@/services/venueBusiness.service').venueBusinessService;
  let proposalService: typeof import('@/services/proposal.service').proposalService;
  const users: string[] = [];
  const vendorIds: string[] = [];
  let scopeA: Extract<Scope, { kind: 'BUSINESS' }>;
  let scopeB: Extract<Scope, { kind: 'BUSINESS' }>;

  const inA = <T>(fn: () => Promise<T>) => runInScope(scopeA, fn);
  const inB = <T>(fn: () => Promise<T>) => runInScope(scopeB, fn);

  // Venue A's own couple → sent quotation (with the couple's link) → accepted → booking. Returns the agreement's frozen rule.
  async function bookForA() {
    return inA(async () => {
      const couple = await app.prisma.consultation.create({
        data: { name: `DBTEST settings couple ${fx.runId}`, phone: '9800000021', city: 'Patna', weddingDate: '2026-12-11', days: 1, guestCount: 250, message: `DBTEST venue ${fx.runId}` },
      });
      const draft = await app.quotationService.create('CONSULTATION', couple.id, { items: [fx.line('Hall hire', 200000)], advanceAmount: 50000, validUntil: inDays(10) }, null);
      await app.quotationService.send(draft.id, null);
      const { token } = await app.quotationService.issueCustomerLink(draft.id, null);
      const brand = (await proposalService.view(token))?.brand;
      await app.quotationService.accept(draft.id, { channel: 'WHATSAPP', note: 'db test' }, null);
      await app.quotationService.createBooking(draft.id, {}, null);
      const agreement = await app.prisma.commercialAgreement.findUniqueOrThrow({ where: { quotationId: draft.id }, select: { confirmationPercent: true, confirmationAmount: true, holdWindowDays: true } });
      return { quotationId: draft.id, brand, agreement };
    });
  }

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    settings = (await import('@/services/venueSettings.service')).venueSettingsService;
    businessSvc = (await import('@/services/venueBusiness.service')).venueBusinessService;
    proposalService = (await import('@/services/proposal.service')).proposalService;
    // Two venues of the test's own (never an existing vendor's row or login), each with a vendor login. Neither listing has a phone.
    const [{ id: anyVendorId }] = await fx.vendors(1);
    const { categoryId } = await app.prisma.vendor.findUniqueOrThrow({ where: { id: anyVendorId }, select: { categoryId: true } });
    for (const [i, label] of ['A', 'B'].entries()) {
      const v = await app.prisma.vendor.create({ data: { slug: `dbtest-settings-${label.toLowerCase()}-${fx.runId}`, name: `DBTEST Settings Venue ${label} ${fx.runId}`, categoryId, city: 'Patna', priceMin: 1, priceMax: 2, image: 'x', description: 'x' } });
      vendorIds.push(v.id);
      const u = await app.prisma.user.create({ data: { phone: `97000${fx.runId.replace(/\D/g, '').padEnd(4, '0').slice(0, 4)}${i}`, roles: { create: { role: 'VENDOR' } } } });
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
      // Same order as fixtures.purge(): agreements, invoices (payments cascade), bookings, quotations, then the couple.
      await app.prisma.commercialAgreement.deleteMany({ where: { businessId: { in: ids } } });
      await app.prisma.invoice.deleteMany({ where: { businessId: { in: ids } } });
      await app.prisma.booking.deleteMany({ where: { businessId: { in: ids } } });
      await app.prisma.quotation.deleteMany({ where: { businessId: { in: ids } } });
      await app.prisma.activityLog.deleteMany({ where: { consultation: { businessId: { in: ids } } } });
      await app.prisma.task.deleteMany({ where: { consultation: { businessId: { in: ids } } } });
      await app.prisma.consultation.deleteMany({ where: { businessId: { in: ids } } });
    });
    await app.prisma.businessMember.deleteMany({ where: { userId: { in: users } } });
    await app.prisma.business.deleteMany({ where: { id: { in: ids } } });
    await app.prisma.vendorProfile.deleteMany({ where: { userId: { in: users } } });
    await app.prisma.user.deleteMany({ where: { id: { in: users } } });
    await app.prisma.vendor.deleteMany({ where: { id: { in: vendorIds } } });
    if (fx) await fx.purge();
  });

  let before: Awaited<ReturnType<typeof bookForA>>;

  test('a new venue sees blanks, the defaults and its own document code', async () => {
    const s = await inA(() => settings.get());
    expect(s).toMatchObject({ contactPhone: null, confirmationPercent: null, holdWindowDays: null, shownPhone: null, defaults: { confirmationPercent: 25, holdWindowDays: 7 }, canEdit: true });
    expect(s.numberPrefix).toMatch(/^[A-Z]{3}\d*$/);
    expect((await inB(() => settings.get())).numberPrefix).not.toBe(s.numberPrefix);
  });

  test('before any setting: booked under 25% / 7 days, and the couple’s link shows no number', async () => {
    before = await bookForA();
    expect(before.agreement).toEqual({ confirmationPercent: 25, confirmationAmount: 50000, holdWindowDays: 7 });
    expect(before.brand).toMatchObject({ phone: null, isPlatform: false });
  });

  test('a wrong value is explained and nothing is saved', async () => {
    expect(await inA(() => settings.update({ contactPhone: '123', confirmationPercent: '5', holdWindowDays: '45' }))).toEqual({
      errors: { contactPhone: expect.any(String), confirmationPercent: expect.any(String), holdWindowDays: expect.any(String) },
    });
    expect(await inA(() => settings.get())).toMatchObject({ contactPhone: null, confirmationPercent: null, holdWindowDays: null });
  });

  test('the owner saves the venue’s number and rule — and only this venue’s', async () => {
    const saved = await inA(() => settings.update({ contactPhone: '+91 98765 00000', confirmationPercent: '30', holdWindowDays: '5' }));
    expect(saved).toMatchObject({ contactPhone: '9876500000', confirmationPercent: 30, holdWindowDays: 5, shownPhone: '9876500000' });
    expect(await app.prisma.business.findUniqueOrThrow({ where: { id: scopeA.businessId }, select: { contactPhone: true, confirmationPercent: true, holdWindowDays: true } })).toEqual({ contactPhone: '9876500000', confirmationPercent: 30, holdWindowDays: 5 });
    expect(await inB(() => settings.get())).toMatchObject({ contactPhone: null, confirmationPercent: null, holdWindowDays: null, shownPhone: null });
  });

  test('the next booking is made under the new rule, and the couple’s link shows the venue’s number', async () => {
    const after = await bookForA();
    expect(after.agreement).toEqual({ confirmationPercent: 30, confirmationAmount: 60000, holdWindowDays: 5 });
    expect(after.brand).toMatchObject({ phone: '9876500000', isPlatform: false });
  });

  test('the booking already agreed keeps the rule it was made with', async () => {
    const kept = await inA(() => app.prisma.commercialAgreement.findUniqueOrThrow({ where: { quotationId: before.quotationId }, select: { confirmationPercent: true, confirmationAmount: true, holdWindowDays: true } }));
    expect(kept).toEqual({ confirmationPercent: 25, confirmationAmount: 50000, holdWindowDays: 7 });
  });

  test('staff see the settings but cannot change them', async () => {
    const staff: Scope = { ...scopeA, role: 'STAFF' };
    expect(await runInScope(staff, () => settings.get())).toMatchObject({ confirmationPercent: 30, canEdit: false });
    expect(await runInScope(staff, () => settings.update({ confirmationPercent: '50' }))).toEqual({ forbidden: true });
    expect((await inA(() => settings.get())).confirmationPercent).toBe(30);
  });

  test('clearing the boxes goes back to the defaults', async () => {
    expect(await inA(() => settings.update({ contactPhone: '', confirmationPercent: '', holdWindowDays: '' }))).toMatchObject({ contactPhone: null, confirmationPercent: null, holdWindowDays: null, shownPhone: null });
  });
});
