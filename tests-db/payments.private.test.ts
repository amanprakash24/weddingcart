/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runInScope } from '@/lib/ownership/scope';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Payments behind sign-in (22 Nov 2026, PR E2; decision 10 Nov Q2). Before the booking becomes a wedding, the proposal link is where the
// booking amount is paid, so it carries the payment details. Once the wedding exists, payments, receipts and UTRs leave the open link
// (the server stops sending them) and "I have paid" is done from My Wedding, signed in — with the same rules as before.
dbDescribe('Payments behind sign-in (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let proposal: typeof import('@/services/proposal.service').proposalService;
  let scopeFor: typeof import('@/lib/quotation/proposalEntry').scopeForProposalToken;
  let coupleMoney: typeof import('@/services/coupleMoney.service').coupleMoneyService;
  let asCouple: typeof import('@/lib/customer/coupleEntry').asCoupleWedding;
  const users: string[] = [];
  let couple = '';
  let stranger = '';
  let staffId = '';
  const savedEnv = { id: process.env.SHAADI_UPI_ID, name: process.env.SHAADI_UPI_NAME };

  const errorOf = async (p: Promise<unknown>) => (await p.then(() => null, (e: Error) => e)) as Error | null;
  const onLink = async <T>(t: string, fn: () => Promise<T>) => runInScope(await scopeFor(t), fn);

  async function acceptedWithLink(name: string) {
    const c = await fx.consultation({ name: `DBTEST ${name}`, weddingDate: '2027-03-01', guestCount: 200 });
    const q = await fx.acceptedQuote(c.id, { items: [fx.line('Decoration', 100000, 1, undefined, 'Decorators')], advance: 10000 });
    const booking = await app.quotationService.createBooking(q.id, {}, null);
    const token = (await app.quotationService.issueCustomerLink(q.id, staffId)).token;
    return { q, booking, token };
  }

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    proposal = (await import('@/services/proposal.service')).proposalService;
    scopeFor = (await import('@/lib/quotation/proposalEntry')).scopeForProposalToken;
    coupleMoney = (await import('@/services/coupleMoney.service')).coupleMoneyService;
    asCouple = (await import('@/lib/customer/coupleEntry')).asCoupleWedding;
    process.env.SHAADI_UPI_ID = 'shaadishopping@testbank';
    process.env.SHAADI_UPI_NAME = 'Shaadi Shopping';
    for (const n of ['couple', 'stranger']) users.push((await app.prisma.user.create({ data: { name: `DBTEST ${n} ${fx.runId}`, phone: `95${String(Date.now()).slice(-7)}${users.length}` } })).id);
    [couple, stranger] = users;
    staffId = (await app.prisma.user.findFirstOrThrow({ where: { roles: { some: { role: { in: ['SUPER_ADMIN', 'SALES', 'OPERATIONS'] } } } }, select: { id: true } })).id;
  });
  afterAll(async () => {
    process.env.SHAADI_UPI_ID = savedEnv.id;
    process.env.SHAADI_UPI_NAME = savedEnv.name;
    if (fx) await fx.purge();
    if (app && users.length) await app.prisma.user.deleteMany({ where: { id: { in: users } } });
  });

  test('before the wedding exists the link still carries payments — the booking amount is paid there', async () => {
    const { token } = await acceptedWithLink('pay on link');
    const view = await onLink(token, () => proposal.view(token, { trackView: false }));
    expect(view?.payments).not.toBeNull();
    expect(view?.myWedding).toBeNull();
  });

  test('once the wedding exists: no payments, receipts or UTRs on the open link, and no claims through it', async () => {
    const { q, booking, token } = await acceptedWithLink('private');
    await app.commercialFlow.recordPaymentForQuotation(q.id, { amount: 25000, method: 'UPI', reference: '400000000001' }, staffId);
    const wedding = await app.prisma.wedding.findFirstOrThrow({ where: { sourceBookingId: booking.id } });
    await app.prisma.wedding.update({ where: { id: wedding.id }, data: { customerId: couple } });

    const view = await onLink(token, () => proposal.view(token, { trackView: false }));
    expect(view?.myWedding).toEqual({ hasCoupleLogin: true });
    expect(view?.payments).toBeNull();
    expect(JSON.stringify(view)).not.toContain('400000000001'); // the UTR never reaches the open link
    const viaLink = await errorOf(onLink(token, () => proposal.submitPayment(token, { amount: '10000', utr: '400000000002' }, null)));
    expect(viaLink?.message).toContain('My Wedding');

    // My Wedding: the couple sends it there, signed in
    const before = await asCouple(wedding.id, couple, () => coupleMoney.claims(wedding.id));
    expect(before).toMatchObject({ canClaim: true, claims: [], inReview: 0 });
    const after = await asCouple(wedding.id, couple, () => coupleMoney.submitClaim(wedding.id, { amount: '10000', utr: '400000000002' }, null));
    expect(after.claims).toEqual([expect.objectContaining({ amount: 10000, utr: '400000000002', status: 'PENDING' })]);
    expect(after.inReview).toBe(10000);
    // never counted as money until staff verify it
    expect((await app.agreement.loadAgreementMoney(q.id)).received).toBe(25000);
    // the same UTR again, or a UTR already recorded as a payment, is refused
    expect((await errorOf(asCouple(wedding.id, couple, () => coupleMoney.submitClaim(wedding.id, { amount: '10000', utr: '400000000002' }, null))))?.name).toBe('ConflictError');
    expect((await errorOf(asCouple(wedding.id, couple, () => coupleMoney.submitClaim(wedding.id, { amount: '5000', utr: '400000000001' }, null))))?.name).toBe('ConflictError');
    // staff see the claim where they always have (one PENDING submission on the quotation)
    expect(await app.prisma.paymentSubmission.count({ where: { quotationId: q.id, status: 'PENDING' } })).toBe(1);
    // the couple's My Wedding shows it
    const [event] = await app.clientPortalService.getEventsForClient(couple);
    expect(event.money.claims.map((c) => c.utr)).toEqual(['400000000002']);
  });

  test('someone else cannot see or send claims for this wedding', async () => {
    const wedding = await app.prisma.wedding.findFirstOrThrow({ where: { customerId: couple } });
    expect((await errorOf(asCouple(wedding.id, stranger, () => coupleMoney.claims(wedding.id))))?.name).toBe('NotFoundError');
    expect((await errorOf(asCouple(wedding.id, stranger, () => coupleMoney.submitClaim(wedding.id, { amount: '1000', utr: '400000000009' }, null))))?.name).toBe('NotFoundError');
  });
});
