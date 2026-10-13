/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { PLATFORM_SCOPE, runInScope } from '@/lib/ownership/scope';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, MARKER, type Fixtures } from './helpers/fixtures';

// "Delete lead" on a real database (13 Oct 2026): the founder removes a lead that is still just a lead — with its quotations,
// tasks, history and vendor requests, all or nothing. A lead that has a booking is a customer record and is refused untouched.
// Nobody but a founder may do it.
dbDescribe('Delete lead (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let svc: ReturnType<typeof import('@/services/leadDeletion.service').createLeadDeletionService>;
  let founderId = '';
  let salesId = '';
  const made = { leads: [] as string[], enquiries: [] as string[] };
  const asPlatform = <T>(fn: () => Promise<T>) => runInScope(PLATFORM_SCOPE, fn);
  const enquiryData = (vendor: { id: string; name: string }, name: string, phone: string) => ({ vendorId: vendor.id, vendorName: vendor.name, vendorCategory: 'Venues', name, phone, city: 'Patna', eventDate: '2026-12-05', eventType: 'Wedding', message: `${MARKER} ${name}` });
  const outcome = (p: Promise<unknown>) => p.then(() => null, (e: Error) => e);

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await asPlatform(() => fx.purge());
    svc = (await import('@/services/leadDeletion.service')).createLeadDeletionService({ db: app.prisma });
    founderId = (await app.prisma.user.create({ data: { name: `DBTEST founder ${fx.runId}`, roles: { create: { role: 'SUPER_ADMIN' } } } })).id;
    salesId = (await app.prisma.user.create({ data: { name: `DBTEST sales ${fx.runId}`, roles: { create: { role: 'SALES' } } } })).id;
  });

  afterAll(async () => {
    if (!app) return;
    await asPlatform(async () => {
      await app.prisma.lead.deleteMany({ where: { id: { in: made.leads } } });
      await app.prisma.enquiry.deleteMany({ where: { id: { in: made.enquiries } } });
      await fx.purge();
    });
    await app.prisma.user.deleteMany({ where: { id: { in: [founderId, salesId] } } });
  });

  test('a consultation with a sent quotation, a task, history and a vendor request: all of it goes, and only it', async () => {
    await asPlatform(async () => {
      const [vendor] = await fx.vendors(1);
      const doomed = await fx.consultation({ name: `DBTEST delete me ${fx.runId}` });
      const kept = await fx.consultation({ name: `DBTEST keep me ${fx.runId}` });
      const quote = await fx.sentQuote(doomed.id);
      const keptQuote = await fx.sentQuote(kept.id);
      await app.prisma.task.create({ data: { title: 'DBTEST call back', context: 'SALES_FOLLOWUP', consultationId: doomed.id } });
      await app.prisma.vendorEnquiry.create({ data: { vendorId: vendor.id, consultationId: doomed.id, sourceKey: `CONSULTATION:${doomed.id}`, services: 'Venue' } });
      // An enquiry that was made from this consultation stays, on its own.
      const child = await app.prisma.enquiry.create({ data: { ...enquiryData(vendor, 'DBTEST child', '9000000001'), consultationId: doomed.id } });
      made.enquiries.push(child.id);

      const preview = await svc.preview(founderId, 'CONSULTATION', doomed.id);
      expect(preview).toMatchObject({ name: `DBTEST delete me ${fx.runId}`, canDelete: true, blockers: [] });
      expect(preview.goesWith).toMatchObject({ quotations: 1, tasks: 1, vendorEnquiries: 1 });
      expect(preview.goesWith.notes).toBeGreaterThan(0); // "quotation sent" is in its history
      expect(await app.prisma.consultation.count({ where: { id: doomed.id } })).toBe(1); // a preview deletes nothing

      expect(await svc.remove(founderId, 'CONSULTATION', doomed.id)).toEqual({ deleted: true, name: `DBTEST delete me ${fx.runId}` });
      expect(await app.prisma.consultation.count({ where: { id: doomed.id } })).toBe(0);
      expect(await app.prisma.quotation.count({ where: { id: quote.id } })).toBe(0);
      expect(await app.prisma.quotationItem.count({ where: { quotationId: quote.id } })).toBe(0);
      expect(await app.prisma.task.count({ where: { consultationId: doomed.id } })).toBe(0);
      expect(await app.prisma.activityLog.count({ where: { consultationId: doomed.id } })).toBe(0);
      expect(await app.prisma.vendorEnquiry.count({ where: { consultationId: doomed.id } })).toBe(0);
      expect(await app.prisma.enquiry.findUniqueOrThrow({ where: { id: child.id } })).toMatchObject({ consultationId: null });
      // The other lead is exactly as it was.
      expect(await app.prisma.consultation.count({ where: { id: kept.id } })).toBe(1);
      expect(await app.prisma.quotation.count({ where: { id: keptQuote.id } })).toBe(1);
      // Gone is gone: a second try finds nothing.
      expect((await outcome(svc.remove(founderId, 'CONSULTATION', doomed.id)))?.name).toBe('NotFoundError');
    });
  });

  test('a lead with a booking is a customer record: refused, by name, and nothing is touched', async () => {
    await asPlatform(async () => {
      const c = await fx.consultation({ name: `DBTEST booked ${fx.runId}` });
      const { quotation, booking } = await fx.bookedQuote(c.id);
      const preview = await svc.preview(founderId, 'CONSULTATION', c.id);
      expect(preview.canDelete).toBe(false);
      expect(preview.blockers.join(' ')).toContain('booking');
      const refused = await outcome(svc.remove(founderId, 'CONSULTATION', c.id));
      expect(refused).toMatchObject({ name: 'ConflictError' });
      expect(refused?.message).toContain('customer record');
      expect(await app.prisma.consultation.count({ where: { id: c.id } })).toBe(1);
      expect(await app.prisma.quotation.count({ where: { id: quotation.id } })).toBe(1);
      expect(await app.prisma.booking.count({ where: { id: booking.id } })).toBe(1);
      expect(await app.prisma.activityLog.count({ where: { consultationId: c.id } })).toBeGreaterThan(0);
    });
  });

  test('a plain popup lead and a plain enquiry delete cleanly', async () => {
    await asPlatform(async () => {
      const [vendor] = await fx.vendors(1);
      const lead = await app.prisma.lead.create({ data: { phone: '9000000002', source: 'dbtest' } });
      const enquiry = await app.prisma.enquiry.create({ data: enquiryData(vendor, 'DBTEST plain enquiry', '9000000003') });
      made.leads.push(lead.id);
      made.enquiries.push(enquiry.id);
      expect(await svc.preview(founderId, 'LEAD', lead.id)).toMatchObject({ name: '9000000002', canDelete: true, goesWith: { quotations: 0, tasks: 0, notes: 0, vendorEnquiries: 0 } });
      expect(await svc.remove(founderId, 'LEAD', lead.id)).toMatchObject({ deleted: true });
      expect(await svc.remove(founderId, 'ENQUIRY', enquiry.id)).toMatchObject({ deleted: true, name: 'DBTEST plain enquiry' });
      expect(await app.prisma.lead.count({ where: { id: lead.id } })).toBe(0);
      expect(await app.prisma.enquiry.count({ where: { id: enquiry.id } })).toBe(0);
    });
  });

  test('only a founder: Sales and an unknown person can neither look nor delete', async () => {
    await asPlatform(async () => {
      const c = await fx.consultation({ name: `DBTEST not yours ${fx.runId}` });
      for (const actor of [salesId, '00000000-0000-4000-8000-000000000000']) {
        expect((await outcome(svc.preview(actor, 'CONSULTATION', c.id)))?.name).toBe('NotFoundError');
        expect((await outcome(svc.remove(actor, 'CONSULTATION', c.id)))?.name).toBe('NotFoundError');
      }
      expect(await app.prisma.consultation.count({ where: { id: c.id } })).toBe(1);
    });
  });
});
