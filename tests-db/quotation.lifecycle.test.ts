/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, inDays, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Lifecycle rules that depend on real database state — time passing, stage moves, linked rows — proven against the
// real services and schema. See tests-db/quotation.concurrency.test.ts for the races.

const errorOf = (promise: Promise<unknown>) => promise.then(() => null, (e: Error) => e);

dbDescribe('quotation lifecycle (real database)', () => {
  let app: App;
  let fx: Fixtures;

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
  });
  afterAll(async () => {
    if (fx) await fx.purge();
  });

  const setStage = (id: string, pipelineStage: 'NEW' | 'SITE_VISIT_SCHEDULED' | 'QUOTATION_SENT') =>
    app.prisma.consultation.update({ where: { id }, data: { pipelineStage } });

  test('Booked (WON) and Accepted can never be set by hand — with or without an accepted quotation — and the stage does not change', async () => {
    const c = await fx.consultation();
    await fx.sentQuote(c.id); // sent, but the customer has not accepted
    await setStage(c.id, 'QUOTATION_SENT');
    for (const toStage of ['WON', 'ACCEPTED'] as const) {
      const error = await errorOf(app.leadWorkspaceService.transitionStage('CONSULTATION', c.id, { toStage, actorId: null }));
      expect(error?.name).toBe('InvalidTransitionError');
      expect(error?.message).toContain('automatically');
    }
    expect((await app.prisma.consultation.findUniqueOrThrow({ where: { id: c.id } })).pipelineStage).toBe('QUOTATION_SENT');
  });

  test('recording the acceptance moves the lead to Accepted by itself; the manual route to Negotiation still works', async () => {
    const accepted = await fx.consultation();
    await fx.acceptedQuote(accepted.id);
    expect((await app.prisma.consultation.findUniqueOrThrow({ where: { id: accepted.id } })).pipelineStage).toBe('ACCEPTED');
    const refused = await errorOf(app.leadWorkspaceService.transitionStage('CONSULTATION', accepted.id, { toStage: 'WON', actorId: null }));
    expect(refused?.name).toBe('InvalidTransitionError');

    const viaNegotiation = await fx.consultation();
    await setStage(viaNegotiation.id, 'QUOTATION_SENT');
    const moved = await app.leadWorkspaceService.transitionStage('CONSULTATION', viaNegotiation.id, { toStage: 'NEGOTIATION', actorId: null });
    expect(moved.pipelineStage).toBe('NEGOTIATION');
  });

  test('sending a quotation moves the lead to Quotation Sent from any early stage — including New', async () => {
    const ready = await fx.consultation();
    await setStage(ready.id, 'SITE_VISIT_SCHEDULED');
    const draft = await app.quotationService.create('CONSULTATION', ready.id, { items: [fx.line('Venue', 100000)], validUntil: inDays(5) }, null);
    const sent = await app.quotationService.send(draft.id, null);
    expect(sent.stageAdvanced).toBe(true);
    expect((await app.prisma.consultation.findUniqueOrThrow({ where: { id: ready.id } })).pipelineStage).toBe('QUOTATION_SENT');

    const early = await fx.consultation(); // stage NEW: sending now catches the stage up
    const earlyDraft = await app.quotationService.create('CONSULTATION', early.id, { items: [fx.line('Venue', 100000)], validUntil: inDays(5) }, null);
    const earlySent = await app.quotationService.send(earlyDraft.id, null);
    expect(earlySent.quotation.status).toBe('SENT');
    expect(earlySent.stageAdvanced).toBe(true);
    expect((await app.prisma.consultation.findUniqueOrThrow({ where: { id: early.id } })).pipelineStage).toBe('QUOTATION_SENT');
  });

  test('a SENT quote past its date shows as EXPIRED, cannot be accepted, and frees the source for a new quote', async () => {
    const c = await fx.consultation();
    const sent = await fx.sentQuote(c.id);
    await app.prisma.quotation.update({ where: { id: sent.id }, data: { validUntil: inDays(-1) } }); // time passes

    expect((await app.quotationService.listForSource('CONSULTATION', c.id))[0].status).toBe('EXPIRED');
    const error = await errorOf(app.quotationService.accept(sent.id, { channel: 'PHONE' }, null));
    expect(error?.name).toBe('ConflictError');
    expect(error?.message).toContain('expired');
    const next = await app.quotationService.create('CONSULTATION', c.id, { items: [fx.line('Venue v2', 90000)] }, null);
    expect(next.status).toBe('DRAFT');
  });

  test('an expiry nobody has looked at yet is still caught when someone tries to accept, and is saved as EXPIRED', async () => {
    const c = await fx.consultation();
    const sent = await fx.sentQuote(c.id);
    await app.prisma.quotation.update({ where: { id: sent.id }, data: { validUntil: inDays(-1) } });
    expect((await errorOf(app.quotationService.accept(sent.id, { channel: 'PHONE' }, null)))?.name).toBe('ConflictError');
    expect((await app.prisma.quotation.findUniqueOrThrow({ where: { id: sent.id } })).status).toBe('EXPIRED');
  });

  test('revising a sent quote supersedes it; discarding the revision brings it back; an accepted deal cannot be revised', async () => {
    const c = await fx.consultation();
    const sent = await fx.sentQuote(c.id);
    const revision = await app.quotationService.revise(sent.id, null);
    expect(revision.revision).toBe(2);
    expect(revision.items).toHaveLength(1);
    expect((await app.quotationService.getById(sent.id)).status).toBe('SUPERSEDED');

    await app.quotationService.deleteDraft(revision.id);
    expect((await app.quotationService.getById(sent.id)).status).toBe('SENT');

    await app.quotationService.accept(sent.id, { channel: 'IN_PERSON' }, null);
    expect((await errorOf(app.quotationService.revise(sent.id, null)))?.name).toBe('ConflictError');
  });

  test('a draft or sent quote cannot become a booking; only an accepted one can, once', async () => {
    const c = await fx.consultation();
    const sent = await fx.sentQuote(c.id);
    expect((await errorOf(app.quotationService.createBooking(sent.id, {}, null)))?.message).toContain('acceptance');
    await app.quotationService.accept(sent.id, { channel: 'WHATSAPP' }, null);
    const booking = await app.quotationService.createBooking(sent.id, {}, null);
    expect(booking.status).toBe('NEW');
    expect((await errorOf(app.quotationService.createBooking(sent.id, {}, null)))?.message).toContain('already created');
  });

  test('a booking uses the QUOTE prices (with the discount), the source date, and a vendor line takes the vendor\'s real name', async () => {
    const [vendor] = await fx.vendors(1);
    const c = await fx.consultation({ weddingDate: '2026-11-20', guestCount: 500 });
    const accepted = await fx.acceptedQuote(c.id, {
      items: [fx.line('Catering per plate', 800, 500, vendor.id), fx.line('Custom stage', 40000, 1, undefined, 'Decorators')],
      discount: 10000,
      advance: 100000,
    });
    const booking = await app.quotationService.createBooking(accepted.id, {}, null);

    expect(booking.total).toBe(430000); // 400000 + 40000 − 10000 — the QUOTE total, not the sum of the lines
    expect(booking.weddingDate?.toISOString().slice(0, 10)).toBe('2026-11-20');
    expect(booking.guestCount).toBe(500);
    const catering = booking.items.find((i) => i.packageName === 'Catering per plate');
    expect([catering?.price, catering?.quantity, catering?.vendorName]).toEqual([800, 500, vendor.name]);
    const custom = booking.items.find((i) => i.packageName === 'Custom stage');
    expect([custom?.vendorId, custom?.vendorName]).toEqual([null, 'To be assigned']);
  });

  test('a free-text or typo\'d source date is never trusted: booking fails clearly until staff supply the date', async () => {
    const c = await fx.consultation({ weddingDate: '20 October 20202' });
    const accepted = await fx.acceptedQuote(c.id);

    const error = await errorOf(app.quotationService.createBooking(accepted.id, {}, null));
    expect(error?.name).toBe('ValidationError');
    expect(error?.message).toContain('Add the wedding date');
    expect(await app.prisma.booking.count({ where: { quotationId: accepted.id } })).toBe(0);

    const booking = await app.quotationService.createBooking(accepted.id, { weddingDate: new Date('2026-12-15') }, null);
    expect(booking.weddingDate?.toISOString().slice(0, 10)).toBe('2026-12-15');
  });

  test('once a source has converted to a wedding it can no longer be quoted or booked', async () => {
    const c = await fx.consultation();
    const { booking } = await fx.confirmedBooking(c.id, { advance: 50000 });
    await app.convertBookingToWedding(booking.id);
    expect((await errorOf(app.quotationService.create('CONSULTATION', c.id, { items: [fx.line('x', 1)] }, null)))?.name).toBe('ConversionLockedError');
  });
});
