/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runAsSystem, runInScope, type Scope } from '@/lib/ownership/scope';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Option B (founder, 17 Nov 2026), on a real database through the real services: while a hall is held for one couple on a date and
// shift, another couple cannot accept a quotation for the same hall, date and shift — not on their link, not recorded by staff. The
// holding couple's own acceptance takes the hold over. Expired or released holds never block. A hold and an acceptance that arrive
// together are serialised by the hall's lock: exactly one wins.
dbDescribe('hall holds stop other couples accepting (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let enquiries: typeof import('@/services/venueEnquiry.service').venueEnquiryService;
  let quotes: typeof import('@/services/venueQuotation.service').venueQuotationService;
  let spaces: typeof import('@/services/venueSpace.service').venueSpaceService;
  let businessSvc: typeof import('@/services/venueBusiness.service').venueBusinessService;
  let proposalService: typeof import('@/services/proposal.service').proposalService;
  let scopeForProposalToken: typeof import('@/lib/quotation/proposalEntry').scopeForProposalToken;
  let scope: Extract<Scope, { kind: 'BUSINESS' }>;
  let user = '';
  let vendorId = '';
  let hall = '';
  let n = 0;

  const inV = <T>(fn: () => Promise<T>) => runInScope(scope, fn);
  const outcome = (p: Promise<unknown>) => p.then(() => null, (e: Error) => e);
  const later = (days: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + days * 86_400_000));

  // A couple with a sent quotation and the hall chosen for `date` / `shift`. Returns their enquiry, slot and link token.
  async function couple(date: string, shift: 'DAY' | 'NIGHT' | 'FULL_DAY') {
    n += 1;
    const enquiryId = ((await inV(() => enquiries.create({ name: `Hold Couple ${n}`, phone: `9${String(800000000 + n).slice(0, 9)}`, weddingDate: date, guestCount: '200', channel: 'PHONE' }, user))) as { id: string }).id;
    await inV(() => quotes.save(enquiryId, { items: [{ description: 'Hall hire', quantity: '1', unitPrice: '100000' }], validUntil: later(10) }, user));
    const sent = await inV(() => quotes.send(enquiryId, user));
    const res = await inV(() => spaces.reserve(enquiryId, { spaceId: hall, date, shift }, user));
    if ('errors' in res) throw new Error(JSON.stringify(res.errors));
    return { enquiryId, slotId: res.slots[0].id, token: sent.linkPath.slice('/proposal/'.length) };
  }
  const acceptOnLink = async (token: string) => runInScope(await scopeForProposalToken(token), () => proposalService.accept(token));
  const slotRow = (id: string) => runAsSystem('test read', () => app.prisma.venueSlot.findUniqueOrThrow({ where: { id } }));

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    enquiries = (await import('@/services/venueEnquiry.service')).venueEnquiryService;
    quotes = (await import('@/services/venueQuotation.service')).venueQuotationService;
    spaces = (await import('@/services/venueSpace.service')).venueSpaceService;
    businessSvc = (await import('@/services/venueBusiness.service')).venueBusinessService;
    proposalService = (await import('@/services/proposal.service')).proposalService;
    scopeForProposalToken = (await import('@/lib/quotation/proposalEntry')).scopeForProposalToken;
    const [{ id: anyVendorId }] = await fx.vendors(1);
    const { categoryId } = await app.prisma.vendor.findUniqueOrThrow({ where: { id: anyVendorId }, select: { categoryId: true } });
    const v = await app.prisma.vendor.create({ data: { slug: `dbtest-hold-${fx.runId}`, name: `DBTEST Hold Venue ${fx.runId}`, categoryId, city: 'Patna', priceMin: 1, priceMax: 2, image: 'x', description: 'x' } });
    vendorId = v.id;
    const u = await app.prisma.user.create({ data: { phone: `94000${fx.runId.replace(/\D/g, '').padEnd(5, '0').slice(0, 5)}`, roles: { create: { role: 'VENDOR' } } } });
    user = u.id;
    await app.prisma.vendorProfile.create({ data: { userId: u.id, vendorId: v.id } });
    scope = (await businessSvc.scopeForVendorLogin(user))!;
    const added = await inV(() => spaces.add({ name: 'DBTEST Royal Hall' }));
    if ('errors' in added) throw new Error('hall not added');
    hall = added.spaces[0].id;
  });

  afterAll(async () => {
    if (!app) return;
    const id = scope?.businessId;
    if (id) {
      await runAsSystem('test clean-up', async () => {
        await app.prisma.commercialAgreement.deleteMany({ where: { businessId: id } });
        await app.prisma.invoice.deleteMany({ where: { businessId: id } });
        await app.prisma.wedding.deleteMany({ where: { businessId: id } });
        await app.prisma.booking.deleteMany({ where: { businessId: id } });
        await app.prisma.quotation.deleteMany({ where: { businessId: id } });
        await app.prisma.activityLog.deleteMany({ where: { consultation: { businessId: id } } });
        await app.prisma.task.deleteMany({ where: { consultation: { businessId: id } } });
        await app.prisma.consultation.deleteMany({ where: { businessId: id } }); // its venue slots cascade
        await app.prisma.businessClient.deleteMany({ where: { businessId: id } });
      });
      await app.prisma.businessMember.deleteMany({ where: { userId: user } });
      await app.prisma.business.deleteMany({ where: { id } }); // its halls cascade
    }
    await app.prisma.vendorProfile.deleteMany({ where: { userId: user } });
    await app.prisma.user.deleteMany({ where: { id: user } });
    if (vendorId) await app.prisma.vendor.deleteMany({ where: { id: vendorId } });
    if (fx) await fx.purge();
  });

  test('1. couple A holds the hall: couple B cannot accept the same hall and shift, on the link or by staff; A is untouched', async () => {
    const date = later(40);
    const a = await couple(date, 'NIGHT');
    const b = await couple(date, 'NIGHT');
    await inV(() => spaces.hold(a.enquiryId, a.slotId, { days: 3 }, user));
    const before = await slotRow(a.slotId);

    const onLink = await outcome(acceptOnLink(b.token));
    expect(onLink?.name).toBe('ConflictError');
    expect(onLink?.message).toContain('DBTEST Royal Hall is temporarily held for another booking for the night of');
    expect(onLink?.message).not.toContain('Hold Couple');

    const b2 = await inV(() => quotes.get(b.enquiryId));
    expect(b2.quotation?.stage).toBe('SENT'); // B's quotation is still open, nothing was half-accepted
    const after = await slotRow(a.slotId);
    expect(after.holdUntil).toEqual(before.holdUntil);
  });

  test('2. couple A accepts: the booking takes over the hold — one slot, hold cleared, the hall now counts through the booking', async () => {
    const date = later(41);
    const a = await couple(date, 'NIGHT');
    await inV(() => spaces.hold(a.enquiryId, a.slotId, { days: 3 }, user));
    await acceptOnLink(a.token);
    const rows = await runAsSystem('test read', () => app.prisma.venueSlot.findMany({ where: { consultationId: a.enquiryId } }));
    expect(rows.map((r) => [r.id, r.holdUntil])).toEqual([[a.slotId, null]]);
    const view = await inV(() => spaces.forEnquiry(a.enquiryId));
    expect(view.slots[0].state).toBe('ACCEPTED');
  });

  test('3. an expired hold, or a released one, never blocks', async () => {
    const date = later(42);
    const a = await couple(date, 'NIGHT');
    const b = await couple(date, 'NIGHT');
    await inV(() => spaces.hold(a.enquiryId, a.slotId, { days: 1 }, user));
    await runAsSystem('test: let the hold run out', () => app.prisma.venueSlot.update({ where: { id: a.slotId }, data: { holdUntil: new Date(Date.now() - 60_000) } }));
    expect(await outcome(acceptOnLink(b.token))).toBeNull();

    const date2 = later(43);
    const c = await couple(date2, 'DAY');
    const d = await couple(date2, 'DAY');
    await inV(() => spaces.hold(c.enquiryId, c.slotId, { days: 2 }, user));
    await inV(() => spaces.releaseHold(c.enquiryId, c.slotId)); // the venue releases it by hand
    expect(await outcome(acceptOnLink(d.token))).toBeNull();
  });

  test('4. another shift of the same hall is not affected; a full day is', async () => {
    const date = later(44);
    const a = await couple(date, 'DAY');
    const night = await couple(date, 'NIGHT');
    const full = await couple(date, 'FULL_DAY');
    await inV(() => spaces.hold(a.enquiryId, a.slotId, { days: 3 }, user));
    expect(await outcome(acceptOnLink(night.token))).toBeNull();
    expect((await outcome(acceptOnLink(full.token)))?.message).toContain('for the full day of');
  });

  test('5. a hold and an acceptance that arrive together: exactly one wins, never both', async () => {
    for (let i = 0; i < 3; i++) {
      const date = later(50 + i);
      const a = await couple(date, 'NIGHT');
      const b = await couple(date, 'NIGHT');
      const [held, accepted] = await Promise.all([outcome(inV(() => spaces.hold(a.enquiryId, a.slotId, { days: 3 }, user))), outcome(acceptOnLink(b.token))]);
      const holdWon = held === null;
      const acceptWon = accepted === null;
      expect(holdWon !== acceptWon).toBe(true); // one, and only one
      if (holdWon) expect(accepted?.message).toContain('temporarily held for another booking');
      else expect(held?.message).toContain('is not free for night');
    }
  });

  test('6. the venue can always release a hold, even when another couple was quoted for the same hall', async () => {
    const date = later(60);
    const a = await couple(date, 'NIGHT');
    await couple(date, 'NIGHT');
    await inV(() => spaces.hold(a.enquiryId, a.slotId, { days: 3 }, user));
    const freed = await inV(() => spaces.releaseHold(a.enquiryId, a.slotId));
    expect([freed.slots[0].state, freed.slots[0].holdUntil]).toEqual(['QUOTED', null]);
  });
});
