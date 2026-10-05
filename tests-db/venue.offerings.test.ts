/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runAsSystem, runInScope, type Scope } from '@/lib/ownership/scope';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Phase C: "What we offer", on a real database, through the real services and two real vendor logins. Venue A lists what it offers
// for Haldi and the Reception; the list feeds its quotation form, a line keeps its function, and the couple's page groups by it.
// Venue B's list is its own — neither can see or change the other's.
dbDescribe('what a venue offers, and functions on its quotations (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let offerings: typeof import('@/services/venueOffering.service').venueOfferingService;
  let enquiries: typeof import('@/services/venueEnquiry.service').venueEnquiryService;
  let quotes: typeof import('@/services/venueQuotation.service').venueQuotationService;
  let businessSvc: typeof import('@/services/venueBusiness.service').venueBusinessService;
  let proposalService: typeof import('@/services/proposal.service').proposalService;
  let scopeForProposalToken: typeof import('@/lib/quotation/proposalEntry').scopeForProposalToken;
  const users: string[] = [];
  const vendorIds: string[] = [];
  let scopeA: Extract<Scope, { kind: 'BUSINESS' }>;
  let scopeB: Extract<Scope, { kind: 'BUSINESS' }>;
  let haldiDecorId = '';
  let bLawnId = '';

  const outcome = (p: Promise<unknown>) => p.then(() => null, (e: Error) => e);
  const inA = <T>(fn: () => Promise<T>) => runInScope(scopeA, fn);
  const inB = <T>(fn: () => Promise<T>) => runInScope(scopeB, fn);
  const later = (days: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + days * 86_400_000));
  const names = (list: { name: string }[]) => list.map((o) => o.name);

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    offerings = (await import('@/services/venueOffering.service')).venueOfferingService;
    enquiries = (await import('@/services/venueEnquiry.service')).venueEnquiryService;
    quotes = (await import('@/services/venueQuotation.service')).venueQuotationService;
    businessSvc = (await import('@/services/venueBusiness.service')).venueBusinessService;
    proposalService = (await import('@/services/proposal.service')).proposalService;
    scopeForProposalToken = (await import('@/lib/quotation/proposalEntry')).scopeForProposalToken;
    // Two venues of the test's own (never an existing vendor's row or login), each with a vendor login.
    const [{ id: anyVendorId }] = await fx.vendors(1);
    const { categoryId } = await app.prisma.vendor.findUniqueOrThrow({ where: { id: anyVendorId }, select: { categoryId: true } });
    for (const [i, label] of ['A', 'B'].entries()) {
      const v = await app.prisma.vendor.create({ data: { slug: `dbtest-offer-${label.toLowerCase()}-${fx.runId}`, name: `DBTEST Offer Venue ${label} ${fx.runId}`, categoryId, city: 'Patna', priceMin: 1, priceMax: 2, image: 'x', description: 'x' } });
      vendorIds.push(v.id);
      const u = await app.prisma.user.create({ data: { phone: `94000${fx.runId.replace(/\D/g, '').padEnd(4, '0').slice(0, 4)}${i}`, roles: { create: { role: 'VENDOR' } } } });
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
      await app.prisma.quotation.deleteMany({ where: { businessId: { in: ids } } });
      await app.prisma.activityLog.deleteMany({ where: { consultation: { businessId: { in: ids } } } });
      await app.prisma.task.deleteMany({ where: { consultation: { businessId: { in: ids } } } });
      await app.prisma.consultation.deleteMany({ where: { businessId: { in: ids } } });
    });
    await app.prisma.businessMember.deleteMany({ where: { userId: { in: users } } });
    await app.prisma.business.deleteMany({ where: { id: { in: ids } } }); // its offerings go with it
    await app.prisma.vendorProfile.deleteMany({ where: { userId: { in: users } } });
    await app.prisma.user.deleteMany({ where: { id: { in: users } } });
    await app.prisma.vendor.deleteMany({ where: { id: { in: vendorIds } } });
    if (fx) await fx.purge();
  });

  test('a venue starts with an empty list, adds what it offers, and a wrong value is explained', async () => {
    expect(await inA(() => offerings.list())).toEqual([]);
    expect(await inA(() => offerings.create({ function: 'HALDI', name: '', price: 'ask' }))).toEqual({ errors: { name: expect.any(String), price: expect.any(String) } });
    await inA(() => offerings.create({ function: 'RECEPTION', name: 'Banquet hall', price: '2,00,000' }));
    await inA(() => offerings.create({ function: 'RECEPTION', name: 'Veg plate', price: '900', perPlate: true }));
    const list = await inA(() => offerings.create({ function: 'HALDI', name: 'Haldi decoration', price: '25000' }));
    if ('errors' in list) throw new Error(JSON.stringify(list.errors));
    expect(names(list).sort()).toEqual(['Banquet hall', 'Haldi decoration', 'Veg plate']);
    expect(list.find((o) => o.name === 'Veg plate')).toMatchObject({ function: 'RECEPTION', price: 900, perPlate: true });
    haldiDecorId = list.find((o) => o.name === 'Haldi decoration')!.id;
  });

  test('each venue has its own list — neither sees nor changes the other’s', async () => {
    const mine = await inB(() => offerings.create({ function: 'HALDI', name: 'B lawn', price: '30000' }));
    if ('errors' in mine) throw new Error(JSON.stringify(mine.errors));
    expect(names(mine)).toEqual(['B lawn']);
    bLawnId = mine[0].id;
    expect(names(await inA(() => offerings.list()))).not.toContain('B lawn');
    expect((await outcome(inA(() => offerings.update(bLawnId, { function: 'HALDI', name: 'hacked', price: '1' }))))?.name).toBe('NotFoundError');
    expect((await outcome(inA(() => offerings.remove(bLawnId))))?.name).toBe('NotFoundError');
    expect((await outcome(inB(() => offerings.remove(haldiDecorId))))?.name).toBe('NotFoundError');
    expect(await inB(() => offerings.list())).toEqual([{ id: bLawnId, function: 'HALDI', name: 'B lawn', price: 30000, perPlate: false }]);
  });

  test('change and remove its own', async () => {
    const changed = await inA(() => offerings.update(haldiDecorId, { function: 'HALDI', name: 'Haldi decoration (marigold)', price: '28000' }));
    expect('errors' in changed ? null : changed.find((o) => o.id === haldiDecorId)).toMatchObject({ name: 'Haldi decoration (marigold)', price: 28000 });
    const extra = await inA(() => offerings.create({ function: 'MEHNDI', name: 'Mehndi seating', price: '5000' }));
    const extraId = ('errors' in extra ? [] : extra).find((o) => o.name === 'Mehndi seating')!.id;
    expect(names(await inA(() => offerings.remove(extraId)))).not.toContain('Mehndi seating');
  });

  test('the quotation form gets the venue’s own list; a line keeps its function; the couple’s page groups by function', async () => {
    const enquiryId = ((await inA(() => enquiries.create({ name: 'Rahul Kumar', phone: '98765 43210', weddingDate: later(60), channel: 'PHONE' }, users[0]))) as { id: string }).id;
    const state = await inA(() => quotes.get(enquiryId));
    expect(names(state.offerings).sort()).toEqual(['Banquet hall', 'Haldi decoration (marigold)', 'Veg plate']);

    const saved = await inA(() =>
      quotes.save(enquiryId, { items: [{ description: 'Haldi decoration (marigold)', quantity: '1', unitPrice: '28000', function: 'HALDI' }, { description: 'Banquet hall', quantity: '1', unitPrice: '200000', function: 'RECEPTION' }, { description: 'Veg plate (per plate)', quantity: '300', unitPrice: '900', function: 'RECEPTION' }], validUntil: later(7) }, users[0])
    );
    if ('errors' in saved) throw new Error(JSON.stringify(saved.errors));
    expect(saved.quotation?.items.map((i) => i.function)).toEqual(['HALDI', 'RECEPTION', 'RECEPTION']);
    expect(saved.quotation?.total).toBe(498000);

    const token = (await inA(() => quotes.send(enquiryId, users[0]))).linkPath.slice('/proposal/'.length);
    const page = await runInScope(await scopeForProposalToken(token), () => proposalService.view(token));
    expect(page?.items.map((i) => [i.functionLabel, i.description])).toEqual([['Haldi', 'Haldi decoration (marigold)'], ['Reception', 'Banquet hall'], ['Reception', 'Veg plate (per plate)']]);

    // "Add an event": the couple's open link shows what THIS venue offers — never venue B's list.
    expect(page?.addable.map((g) => [g.label, g.items.map((o) => o.name)])).toEqual([['Haldi', ['Haldi decoration (marigold)']], ['Reception', ['Banquet hall', 'Veg plate']]]);
    expect(page?.addable[1].items[1].price).toBe('₹900 per plate');

    // The couple asks to add the Haldi, ticking the venue's decoration — and, tampering, venue B's lawn. Only the venue's own counts.
    const asCouple = async <T>(fn: () => Promise<T>) => runInScope(await scopeForProposalToken(token), fn);
    expect((await outcome(asCouple(() => proposalService.requestEvent(token, { function: 'MEHNDI' }))))?.name).toBe('ValidationError'); // nothing listed for it
    await asCouple(() => proposalService.requestEvent(token, { function: 'HALDI', offeringIds: [haldiDecorId, bLawnId], note: 'About 150 guests' }));

    // The venue sees it as a change request, in its own words and prices; the quotation itself is untouched.
    const after = (await inA(() => quotes.get(enquiryId))).quotation;
    expect(after?.stage).toBe('CHANGES');
    expect(after?.changesNote).toContain('Please add Haldi: Haldi decoration (marigold) (from ₹28,000).\nAbout 150 guests');
    expect(after?.changesNote).not.toContain('B lawn');
    expect(after?.total).toBe(498000);
    expect(after?.items).toHaveLength(3);
    expect((await asCouple(() => proposalService.view(token)))?.changesRequested).toBe(true);
  });

  test('a function that is not on the list is refused, and a line without one is fine', async () => {
    const enquiryId = ((await inA(() => enquiries.create({ name: 'Priya Singh', phone: '98765 43211', channel: 'WALK_IN' }, users[0]))) as { id: string }).id;
    expect(await inA(() => quotes.save(enquiryId, { items: [{ description: 'Hall', quantity: '1', unitPrice: '1000', function: 'BACHELOR_PARTY' }], validUntil: later(7) }, users[0]))).toEqual({ errors: { 'items.0.function': expect.any(String) } });
    const saved = await inA(() => quotes.save(enquiryId, { items: [{ description: 'Hall', quantity: '1', unitPrice: '1000' }], validUntil: later(7) }, users[0]));
    expect('quotation' in saved && saved.quotation?.items[0].function).toBeNull();
  });

  test('another venue’s quotation form never shows this venue’s list', async () => {
    const enquiryId = ((await inB(() => enquiries.create({ name: 'Amit Raj', phone: '98765 43212', channel: 'PHONE' }, users[1]))) as { id: string }).id;
    expect(names((await inB(() => quotes.get(enquiryId))).offerings)).toEqual(['B lawn']);
  });
});
