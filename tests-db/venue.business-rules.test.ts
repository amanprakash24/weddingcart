/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { PLATFORM_SCOPE, runAsSystem, runInScope, type Scope } from '@/lib/ownership/scope';
import { dbDescribe, inDays, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Phase C 2b-1: what differs per business, on a real database, through the real services.
//   • numbers — a venue's documents carry its own code and count on their own (SWA-QTN-…); Shaadi Shopping's stay QTN- / INV- (D6)
//   • the confirmation rule — a venue's own (here 30% / 5 days) is frozen into its agreements; Shaadi Shopping's stays 25% / 7 days
//   • the couple's link — it runs as the business that owns the quotation, and shows that business's name and number (D8)
dbDescribe('per-business numbers, rules and proposal links (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let proposalService: typeof import('@/services/proposal.service').proposalService;
  let scopeForProposalToken: typeof import('@/lib/quotation/proposalEntry').scopeForProposalToken;
  let newCustomerToken: typeof import('@/lib/quotation/proposal').newCustomerToken;
  const venues: { id: string; name: string; scope: Scope }[] = [];
  const first: { quotationId: string; number: string; token: string }[] = [];
  let prefixA = '';
  let platformQuotationId = '';
  let platformToken = '';

  const inVenue = <T>(i: number, fn: () => Promise<T>) => runInScope(venues[i].scope, fn);

  // A venue's own couple and a sent quotation for them, with the couple's link.
  async function venueSentQuote(i: number) {
    return inVenue(i, async () => {
      const couple = await app.prisma.consultation.create({
        data: { name: `DBTEST venue couple ${fx.runId}`, phone: '9800000011', weddingDate: '2026-12-09', days: 1, guestCount: 300, message: `DBTEST venue ${fx.runId}` },
      });
      const draft = await app.quotationService.create('CONSULTATION', couple.id, { items: [fx.line('Hall hire', 200000)], advanceAmount: 50000, validUntil: inDays(10) }, null);
      await app.quotationService.send(draft.id, null);
      const { token } = await app.quotationService.issueCustomerLink(draft.id, null);
      return { quotationId: draft.id, number: draft.quotationNumber, token };
    });
  }

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    proposalService = (await import('@/services/proposal.service')).proposalService;
    scopeForProposalToken = (await import('@/lib/quotation/proposalEntry')).scopeForProposalToken;
    newCustomerToken = (await import('@/lib/quotation/proposal')).newCustomerToken;
    // Venue A sets its own rule and number; venue B sets nothing (the platform rule, no number of its own).
    for (const data of [
      { name: `Swayamvar DBTEST ${fx.runId}`, confirmationPercent: 30, holdWindowDays: 5, contactPhone: '98765 00000' },
      { name: `Swayamvar DBTEST ${fx.runId} B` },
    ]) {
      const b = await app.prisma.business.create({ data: { ...data, kind: 'VENDOR', commercialStatus: 'SAAS' } });
      venues.push({ id: b.id, name: b.name, scope: { kind: 'BUSINESS', businessId: b.id, role: 'OWNER' } });
    }
  });

  afterAll(async () => {
    if (!app) return;
    const ids = venues.map((v) => v.id);
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
    await app.prisma.business.deleteMany({ where: { id: { in: ids } } });
    if (fx) await fx.purge();
  });

  test('a venue’s quotation carries the venue’s own code, counted from 1', async () => {
    first.push(await venueSentQuote(0));
    prefixA = (await app.prisma.business.findUniqueOrThrow({ where: { id: venues[0].id }, select: { numberPrefix: true } })).numberPrefix ?? '';
    expect(prefixA).toMatch(/^SWA\d*$/);
    expect(first[0].number).toMatch(new RegExp(`^${prefixA}-QTN-\\d{6}-0001$`));
  });

  test('a second venue gets a different code and its own count; Shaadi Shopping’s numbers are unchanged', async () => {
    first.push(await venueSentQuote(1));
    const prefixB = (await app.prisma.business.findUniqueOrThrow({ where: { id: venues[1].id }, select: { numberPrefix: true } })).numberPrefix ?? '';
    expect(prefixB).toMatch(/^SWA\d*$/);
    expect(prefixB).not.toBe(prefixA);
    expect(first[1].number).toMatch(new RegExp(`^${prefixB}-QTN-\\d{6}-0001$`));
    // The venue's next one follows its own last number.
    expect((await venueSentQuote(0)).number).toMatch(new RegExp(`^${prefixA}-QTN-\\d{6}-0002$`));

    const platform = await fx.sentQuote((await fx.consultation()).id);
    platformQuotationId = platform.id;
    platformToken = (await app.quotationService.issueCustomerLink(platform.id, null)).token;
    expect(platform.quotationNumber).toMatch(/^QTN-\d{6}-\d{4}$/);
  });

  test('the couple’s link runs as the business that owns the quotation', async () => {
    expect(await scopeForProposalToken(first[0].token)).toEqual({ kind: 'BUSINESS', businessId: venues[0].id, role: 'STAFF' });
    expect(await scopeForProposalToken(platformToken)).toEqual({ kind: 'BUSINESS', businessId: 'shaadi-shopping', role: 'STAFF' });
    expect(await scopeForProposalToken(newCustomerToken())).toEqual(PLATFORM_SCOPE);
    expect(await scopeForProposalToken('not-a-token')).toEqual(PLATFORM_SCOPE);
  });

  test('…and shows that business: the venue’s name and number, or Shaadi Shopping', async () => {
    const venueView = await runInScope(await scopeForProposalToken(first[0].token), () => proposalService.view(first[0].token));
    expect(venueView?.number).toBe(first[0].number);
    expect(venueView?.brand).toEqual({ name: venues[0].name, phone: '9876500000', isPlatform: false });
    // No number of its own and no listing: none is shown — never Shaadi Shopping's.
    const noPhone = await runInScope(await scopeForProposalToken(first[1].token), () => proposalService.view(first[1].token));
    expect(noPhone?.brand).toEqual({ name: venues[1].name, phone: null, isPlatform: false });
    const platformView = await runInScope(await scopeForProposalToken(platformToken), () => proposalService.view(platformToken));
    expect(platformView?.brand).toEqual({ name: 'Shaadi Shopping', phone: null, isPlatform: true });
  });

  test('a venue’s link opens nothing in another business’s records', async () => {
    expect(await proposalService.view(first[0].token)).toBeNull(); // as Shaadi Shopping
    expect(await inVenue(1, () => proposalService.view(first[0].token))).toBeNull();
    expect(await inVenue(0, () => proposalService.view(platformToken))).toBeNull();
  });

  test('the venue’s own rule is frozen into its agreement, and its invoice carries its code', async () => {
    const { quotationId } = first[0];
    await inVenue(0, async () => {
      await app.quotationService.accept(quotationId, { channel: 'WHATSAPP', note: 'db test' }, null);
      await app.quotationService.createBooking(quotationId, {}, null);
      const agreement = await app.prisma.commercialAgreement.findUniqueOrThrow({ where: { quotationId } });
      expect(agreement).toMatchObject({ agreementTotal: 200000, confirmationPercent: 30, confirmationAmount: 60000, holdWindowDays: 5 });
      const invoice = await app.prisma.invoice.findFirstOrThrow({ where: { quotationId }, select: { invoiceNumber: true } });
      expect(invoice.invoiceNumber).toMatch(new RegExp(`^${prefixA}-INV-\\d{6}-0001$`));
    });
  });

  test('a venue that set no rule, and Shaadi Shopping, book under 25% / 7 days', async () => {
    await inVenue(1, async () => {
      await app.quotationService.accept(first[1].quotationId, { channel: 'WHATSAPP', note: 'db test' }, null);
      await app.quotationService.createBooking(first[1].quotationId, {}, null);
      expect(await app.prisma.commercialAgreement.findUniqueOrThrow({ where: { quotationId: first[1].quotationId } })).toMatchObject({ confirmationPercent: 25, confirmationAmount: 50000, holdWindowDays: 7 });
    });
    await app.quotationService.accept(platformQuotationId, { channel: 'WHATSAPP', note: 'db test' }, null);
    await app.quotationService.createBooking(platformQuotationId, {}, null);
    const agreement = await app.prisma.commercialAgreement.findUniqueOrThrow({ where: { quotationId: platformQuotationId } });
    expect(agreement).toMatchObject({ confirmationPercent: 25, holdWindowDays: 7 });
    const invoice = await app.prisma.invoice.findFirstOrThrow({ where: { quotationId: platformQuotationId }, select: { invoiceNumber: true } });
    expect(invoice.invoiceNumber).toMatch(/^INV-\d{6}-\d{4}$/);
  });
});
